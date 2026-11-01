/**
 * Băng trạng thái kết nối: máy này đã nối cơ sở dữ liệu chung (Turso/máy chủ) hay
 * mới chỉ đang chạy dữ liệu riêng trong trình duyệt.
 *
 * Vì sao cần: app chạy local-first — mỗi máy giữ một bản SQLite trong trình duyệt.
 * Máy chưa nối thì vẫn thêm/sửa được nhưng dữ liệu CHỈ nằm trên máy đó, máy khác
 * không thấy. Nếu để im lặng, người dùng tưởng đang nhập vào hệ thống chung.
 */
import { useMemo, useState } from 'react'
import { CloudOff, Link2, Loader2, X } from 'lucide-react'
import { loadCloud } from '../lib/cloud'
import { isTursoUrl, loadTurso, saveTurso, tursoReady } from '../lib/turso'
import { decodeShare } from '../lib/share'

/** Mã chia sẻ nằm sau "#/join?c=…" — nhận cả link đầy đủ lẫn mã trần. */
function extractCode(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const m = /[?&]c=([A-Za-z0-9_-]+)/.exec(s)
  if (m) return m[1]
  if (/^[A-Za-z0-9_-]{40,}$/.test(s)) return s
  return null
}

export function ConnectionBanner() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const state = useMemo(() => {
    const t = loadTurso()
    const c = loadCloud()
    if (tursoReady(t)) {
      return { connected: true, off: !t.enabled, kind: 'Turso', host: t.url.replace(/^(libsql|turso|https?):\/\//i, '').split('/')[0] }
    }
    if (c.url && c.key) {
      return { connected: true, off: false, kind: 'Máy chủ', host: c.url.replace(/^https?:\/\//i, '').split('/')[0] }
    }
    return { connected: false, off: false, kind: '', host: '' }
  }, [])

  if (state.connected && !state.off) return null

  const connect = () => {
    setError('')
    const code = extractCode(text)
    const payload = code ? decodeShare(code) : null
    if (!code || !payload) {
      setError('Không đọc được link/mã này. Copy lại toàn bộ link do máy đang chạy tốt gửi (dạng …#/join?c=…).')
      return
    }
    setBusy(true)
    // Đi qua trang Join quen thuộc: nạp cấu hình → tải dữ liệu → vào app
    location.hash = `#/join?c=${code}`
    location.reload()
  }

  return (
    <>
      {state.off ? (
        <div className="flex w-full flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-900 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-100 sm:px-5">
          <CloudOff size={13} className="shrink-0" />
          <span className="font-semibold">Đồng bộ đang TẮT</span>
          <span className="hidden sm:inline">— máy đã có cấu hình Turso nhưng công tắc đang tắt: không nhận, không gửi thay đổi.</span>
          <button
            onClick={() => {
              const t = loadTurso()
              saveTurso({ ...t, enabled: true })
              location.reload()
            }}
            className="rounded-lg bg-amber-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-900"
          >
            Bật đồng bộ ngay
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full flex-wrap items-center gap-2 border-b border-rose-200 bg-rose-50 px-3 py-1.5 text-left text-[11.5px] text-rose-900 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100 sm:px-5"
        >
          <CloudOff size={13} className="shrink-0" />
          <span className="font-semibold">Máy này CHƯA nối cơ sở dữ liệu chung</span>
          <span className="hidden sm:inline">— dữ liệu chỉ nằm trên máy này, máy khác không thấy. Bấm để nối.</span>
          <span className="sm:hidden">— nối ngay →</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[520px] rounded-2xl border border-ink-200 bg-white p-4 shadow-xl dark:border-ink-700 dark:bg-ink-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink-900 dark:text-ink-50">Nối máy này vào cơ sở dữ liệu chung</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
                  Lấy link ở máy đang chạy đúng: <b>Cài đặt → Cơ sở dữ liệu → Chia sẻ cho người khác → Tạo link</b>,
                  rồi dán vào đây. Chỉ cần làm <b>một lần cho mỗi máy</b> — máy sẽ nhớ.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"><X size={16} /></button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Dán link (…/#/join?c=…) hoặc mã đồng bộ"
              className="w-full resize-none rounded-xl border border-ink-200 bg-white p-2.5 text-[12px] text-ink-800 outline-none focus:border-matcha-500 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100"
            />
            {error && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-[11.5px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">{error}</p>}
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-ink-400">Link có chứa quyền truy cập — đừng đăng công khai.</p>
              <button onClick={connect} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-matcha-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-matcha-700 disabled:opacity-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Nối &amp; tải dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Gợi ý ngắn dùng ở trang Cài đặt: máy này đang nối vào đâu. */
export function connectionSummary(): { connected: boolean; label: string } {
  const t = loadTurso()
  if (tursoReady(t)) {
    const mode = t.tokenRw ? 'được ghi' : t.tokenOrder ? 'đặt hàng' : 'chỉ đọc'
    return { connected: true, label: `${isTursoUrl(t.url) ? 'Turso' : t.url} · ${mode}` }
  }
  const c = loadCloud()
  if (c.url && c.key) return { connected: true, label: `${c.url} · máy chủ riêng` }
  return { connected: false, label: 'chưa nối — dữ liệu chỉ nằm trên máy này' }
}

/** Thẻ trạng thái ngắn gọn (dùng trong Cài đặt → Cơ sở dữ liệu). */
export function ConnectionSummaryCard() {
  const t = loadTurso()
  const c = loadCloud()
  const connected = tursoReady(t) || (!!c.url && !!c.key)
  if (connected && tursoReady(t) && !t.enabled) {
    return (
      <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-100">
        <p className="font-semibold">⚠️ Đồng bộ đang TẮT</p>
        <p className="mt-1 leading-relaxed">Máy đã có cấu hình Turso nhưng công tắc “Đồng bộ Turso” đang tắt → không nhận, không gửi thay đổi. Bật công tắc ở khung bên dưới.</p>
      </div>
    )
  }
  if (!connected) {
    return (
      <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        <p className="font-semibold">Máy này chưa nối cơ sở dữ liệu chung</p>
        <p className="mt-1 leading-relaxed">
          Dữ liệu vẫn thêm/sửa được nhưng <b>chỉ nằm trên máy này</b>. Trên thanh trên cùng có băng đỏ
          “Bấm để nối” — dán link chia sẻ từ máy đang chạy đúng là xong (chỉ làm 1 lần).
        </p>
      </div>
    )
  }
  const mode = tursoReady(t) ? (t.tokenRw ? 'được ghi (toàn quyền)' : t.tokenOrder ? 'đặt hàng (hạn chế)' : 'chỉ đọc') : 'máy chủ riêng'
  const host = tursoReady(t) ? t.url : c.url
  return (
    <div className="mb-3 rounded-2xl border border-matcha-200 bg-matcha-50 p-3 text-[12px] text-matcha-900 dark:border-matcha-800 dark:bg-matcha-900/20 dark:text-matcha-100">
      <p className="font-semibold">✔ Máy này đã nối cơ sở dữ liệu chung</p>
      <p className="mt-1 break-all leading-relaxed">
        {host} · quyền: <b>{mode}</b>
        {t.lastSync ? <> · đồng bộ lần cuối: <b>{new Date(t.lastSync).toLocaleString('vi-VN')}</b></> : null}
      </p>
    </div>
  )
}
