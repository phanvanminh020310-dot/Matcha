/**
 * Khối giao diện “Đồng bộ Turso” trong Cài đặt.
 * Cho phép dán địa chỉ + 2 token, kiểm tra kết nối, đẩy/tải dữ liệu và xem mốc đồng bộ.
 */
import { useState } from 'react'
import { CheckCircle2, Cloud, Database, Download, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Field, Input, Switch } from './ui'
import { formatDateTime } from '../lib/format'
import {
  loadTurso, saveTurso, tursoCanWrite, tursoDelta, tursoPullAll, tursoPushAll, tursoReady, tursoTest, tursoWriteMode,
  type SyncProgress, type TursoConfig,
} from '../lib/turso'

export function TursoPanel() {
  const [cfg, setCfg] = useState<TursoConfig>(() => loadTurso())
  const [busy, setBusy] = useState<null | 'test' | 'push' | 'pull' | 'delta'>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null)
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  const update = (patch: Partial<TursoConfig>) => {
    const next = { ...loadTurso(), ...cfg, ...patch }
    setCfg(next)
    saveTurso(next)
  }

  const run = async (kind: 'test' | 'push' | 'pull' | 'delta') => {
    setBusy(kind)
    setProgress(null)
    try {
      if (kind === 'test') {
        setResult(await tursoTest(cfg))
      } else if (kind === 'push') {
        const res = await tursoPushAll(cfg, setProgress)
        setCfg(loadTurso())
        setResult({ ok: true, message: `Đã đẩy ${res.rows.toLocaleString('vi-VN')} dòng lên Turso` })
      } else if (kind === 'pull') {
        const res = await tursoPullAll(cfg, setProgress)
        setCfg(loadTurso())
        setResult({ ok: true, message: `Đã tải ${res.rows.toLocaleString('vi-VN')} dòng từ Turso về máy` })
        window.dispatchEvent(new CustomEvent('matcha:db-refresh'))
      } else {
        const res = await tursoDelta(cfg, setProgress)
        setCfg(loadTurso())
        setResult({
          ok: true,
          message: res.full
            ? `Máy chưa có mốc đồng bộ → đã tải toàn bộ ${res.applied.toLocaleString('vi-VN')} dòng`
            : `${res.applied.toLocaleString('vi-VN')} thay đổi mới (đến seq ${res.lastSeq.toLocaleString('vi-VN')})`,
        })
        if (res.applied > 0) window.dispatchEvent(new CustomEvent('matcha:db-refresh'))
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message })
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const ready = tursoReady(cfg)
  const canWrite = tursoCanWrite(cfg)
  const mode = tursoWriteMode(cfg)
  const modeLabel = mode === 'full' ? 'Máy được ghi (đầy đủ)' : mode === 'order' ? 'Máy chỉ ghi đơn & khách' : 'Chỉ xem'

  return (
    <Card>
      <CardHeader
        icon={<Database size={16} />}
        title="Đồng bộ Turso (dữ liệu nhiều máy)"
        subtitle="Turso giữ bản chuẩn; máy khác chỉ tải phần thay đổi nên rất nhẹ"
        right={
          <div className="flex items-center gap-2">
            {ready && <Badge tone={mode === 'full' ? 'green' : mode === 'order' ? 'blue' : 'amber'} dot>{modeLabel}</Badge>}
            <Switch checked={cfg.enabled} onChange={(v) => update({ enabled: v })} label="bật turso" />
          </div>
        }
      />

      <div className="space-y-3">
        <div className={`rounded-xl border p-2.5 text-[11.5px] leading-relaxed ${
          ready && cfg.enabled
            ? 'border-matcha-200 bg-matcha-50 text-matcha-900 dark:border-matcha-800 dark:bg-matcha-900/20 dark:text-matcha-100'
            : ready
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-100'
              : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
        }`}>
          <p className="font-semibold">
            {ready && cfg.enabled
              ? `✔ Máy này ĐÃ NỐI Turso — quyền: ${modeLabel}`
              : ready
                ? '⚠️ Đã điền cấu hình nhưng ĐỒNG BỘ ĐANG TẮT — bật công tắc ở góc phải tiêu đề'
                : '✖ Máy này CHƯA nối Turso — dữ liệu chỉ nằm trên máy này'}
          </p>
          <p className="mt-1">
            {ready && cfg.enabled
              ? 'Mở app là máy tự hỏi phần thay đổi mới (chỉ vài KB). Máy có quyền ghi thì thay đổi được tự đẩy lên ngay sau mỗi thao tác.'
              : ready
                ? 'Đang tắt thì máy không nhận và không gửi thay đổi nào. Bật công tắc “Đồng bộ Turso” là đồng bộ chạy lại bình thường.'
                : 'Cách nhanh nhất: ở máy đang chạy đúng, vào “Chia sẻ cho người khác” bên dưới để tạo link, rồi mở link đó trên máy này — app tự điền hết, không phải dán token bằng tay.'}
          </p>
        </div>

        <details className="rounded-xl bg-ink-50 p-2.5 text-[11.5px] leading-relaxed text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <summary className="cursor-pointer font-semibold text-ink-700 dark:text-ink-200">Cần điền những ô nào? (giải thích ngắn)</summary>
          <ul className="mt-2 space-y-1.5">
            <li>• <b>Địa chỉ database</b>: địa chỉ “sổ cái” của chuỗi (ai cũng cần, giống nhau trên mọi máy).</li>
            <li>• <b>Token CHỈ ĐỌC</b>: để máy này <b>NHẬN</b> dữ liệu về. Máy xem / máy nhân viên chỉ cần ô này.</li>
            <li>• <b>Token GHI</b>: để máy này <b>GỬI</b> thay đổi lên (bán hàng, nhập kho, sửa thực đơn). Chỉ đặt trên máy của chủ chuỗi.</li>
            <li>• <b>Token ĐẶT HÀNG</b>: máy thu ngân — chỉ ghi được đơn &amp; khách, không sửa thực đơn/danh mục.</li>
            <li>• Điền xong nhớ bật công tắc <b>Đồng bộ Turso</b> ở góc phải tiêu đề.</li>
          </ul>
          <p className="mt-2">Máy chỉ có Token CHỈ ĐỌC vẫn <b>đồng bộ</b> (nhận dữ liệu mới), chỉ là không đẩy được thay đổi lên.</p>
        </details>

        <Field label="Địa chỉ database" hint="Dạng libsql://matcha-….turso.io (lấy trong Turso → database → Connect)">
          <Input value={cfg.url} placeholder="libsql://matcha-…turso.io" onChange={(e) => update({ url: e.target.value })} />
        </Field>
        <Field label="Token GHI (chỉ đặt trên máy của chủ chuỗi)" hint="Cho phép đẩy dữ liệu lên. Bỏ trống nếu máy này chỉ đọc.">
          <Input type="password" value={cfg.tokenRw} placeholder="eyJ…" onChange={(e) => update({ tokenRw: e.target.value })} />
        </Field>
        <Field label="Token CHỈ ĐỌC" hint="Turso chặn mọi lệnh ghi bằng token này — dùng cho máy xem và link chia sẻ.">
          <Input type="password" value={cfg.tokenRo} placeholder="eyJ…" onChange={(e) => update({ tokenRo: e.target.value })} />
        </Field>
        <Field
          label="Token ĐẶT HÀNG (tuỳ chọn)"
          hint="Token giới hạn theo bảng: chỉ thêm/sửa ĐƠN & KHÁCH, không sửa thực đơn/danh mục. Dùng cho máy thu ngân hoặc đối tác đặt hàng."
        >
          <Input type="password" value={cfg.tokenOrder} placeholder="eyJ…" onChange={(e) => update({ tokenOrder: e.target.value })} />
        </Field>
        <details className="rounded-xl bg-ink-50 p-2.5 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-800 dark:text-ink-400">
          <summary className="cursor-pointer font-semibold text-ink-600 dark:text-ink-300">Cách tạo token ĐẶT HÀNG (dán vào Terminal trên máy tính)</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-ink-900 p-2 text-[10.5px] text-ink-100">{`turso db tokens create matcha \
  -p all:data_read \
  -p orders:data_add,data_update \
  -p order_items:data_add,data_update \
  -p order_item_toppings:data_add,data_update \
  -p payments:data_add,data_update \
  -p order_events:data_add,data_update \
  -p customers:data_add,data_update \
  -p customer_addresses:data_add,data_update \
  -p loyalty_accounts:data_add,data_update \
  -p loyalty_ledger:data_add,data_update \
  -p shifts:data_add,data_update \
  -p shift_cash_txns:data_add,data_update \
  -p dining_tables:data_add,data_update \
  -p print_jobs:data_add,data_update`}</pre>
          <p className="mt-1">Turso sẽ chặn mọi lệnh ghi vào bảng khác (thực đơn, danh mục, kho…). Không cần sửa gì trong app.</p>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<RefreshCw size={15} />} disabled={!ready || busy !== null} onClick={() => run('test')}>
            {busy === 'test' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
          </Button>
          <Button variant="primary" icon={<Upload size={15} />} disabled={!ready || !canWrite || busy !== null} onClick={() => run('push')}>
            {busy === 'push' ? 'Đang đẩy…' : 'Đẩy dữ liệu lên'}
          </Button>
          <Button icon={<Download size={15} />} disabled={!ready || busy !== null} onClick={() => run('pull')}>
            {busy === 'pull' ? 'Đang tải…' : 'Tải toàn bộ về máy'}
          </Button>
          <Button variant="ghost" icon={<Cloud size={15} />} disabled={!ready || busy !== null} onClick={() => run('delta')}>
            {busy === 'delta' ? 'Đang đồng bộ…' : 'Đồng bộ thay đổi'}
          </Button>
        </div>

        {result && (
          <div className={`rounded-xl p-2.5 text-[11.5px] ${result.ok ? 'bg-matcha-50 text-matcha-800 dark:bg-matcha-900/20 dark:text-matcha-200' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20'}`}>
            {result.ok ? <CheckCircle2 className="mr-1 inline" size={13} /> : '⚠️'} {result.message}
            {result.latency ? ` · ${result.latency} ms` : ''}
          </div>
        )}

        {progress && (
          <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-ink-800">
            <div className="flex justify-between text-[11px] text-ink-500">
              <span>{progress.done ? 'Hoàn tất' : progress.table}</span>
              <span>{progress.index}/{progress.total} · {progress.rows.toLocaleString('vi-VN')} dòng</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
              <div className="h-full rounded-full bg-matcha-600 transition-all" style={{ width: `${(progress.index / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-400">
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> Mốc thay đổi: seq {cfg.lastSeq.toLocaleString('vi-VN')}</span>
          {cfg.lastSync && <span>Đồng bộ cuối: {formatDateTime(cfg.lastSync)}</span>}
          {cfg.lastRows > 0 && <span>{cfg.lastRows.toLocaleString('vi-VN')} dòng</span>}
        </div>

        <p className="rounded-xl bg-ink-50 p-2.5 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-800 dark:text-ink-400">
          Máy có token GHI: đẩy đơn mới lên Turso. Máy chỉ có token CHỈ ĐỌC: Turso chặn mọi lệnh ghi ở tầng máy chủ — dù mở
          DevTools cũng không sửa được dữ liệu. Bảng quản trị (tài khoản admin, phiên, mã đồng bộ) không bao giờ được tải về máy.
        </p>
      </div>
    </Card>
  )
}
