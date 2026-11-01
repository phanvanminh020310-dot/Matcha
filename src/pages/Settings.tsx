import { useEffect, useState } from 'react'
import { Building2, ClipboardList, Cloud, CreditCard, Database, Download, Eye, Grid3x3, Lock, RefreshCw, Save, Share2, Shield, Store, Upload } from 'lucide-react'
import { getAuditLogs, getBranches, getTables, updateTablePosition } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader, ResetDataButton } from '../components/layout/AppShell'
import { AdminGate, LockedNotice } from '../components/AdminGate'
import { TursoPanel } from '../components/TursoPanel'
import { adminChangePassword, adminLogout, adminUnlocked, adminUsername } from '../lib/adminAuth'
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, Switch, Tabs, Textarea } from '../components/ui'
import { dbSizeBytes, run } from '../lib/db'
import { REALTIME_SQL } from '../lib/realtime'
import { RLS_SQL } from '../lib/rls'
import { buildSeedSQL, checkToken, checkWritePermission, cloudCounts, flushCloudSave, keyWarning, loadCloud, localCounts, pullAll, pushAll, refreshWritePermission, saveCloud, testCloud, toPgDDL, tokenPermission, tokenWarning, type CloudConfig, type SyncProgress } from '../lib/cloud'
import { downloadFile } from '../lib/format'
import { buildShareLink, mintOrderShare, mintShareToken, type ShareMode } from '../lib/share'
import { PERM_GROUPS, getRoles, permsOf } from '../lib/permissions'
import { METHOD_LABEL, cx, formatDateTime, formatVND } from '../lib/format'

const PERM_LABEL: Record<string, string> = {
  'pos.sell': 'Bán hàng tại quầy', 'pos.discount': 'Giảm giá đơn', 'pos.cancel': 'Huỷ đơn', 'pos.shift': 'Quản lý ca',
  'kds.view': 'Xem KDS', 'kds.update': 'Cập nhật KDS', 'bo.dashboard': 'Dashboard', 'bo.products': 'Sản phẩm',
  'bo.recipes': 'Công thức', 'bo.inventory': 'Kho', 'bo.purchasing': 'Mua hàng', 'bo.customers': 'Khách hàng',
  'bo.promotions': 'Khuyến mãi', 'bo.orders': 'Đơn hàng', 'bo.staff': 'Nhân sự', 'bo.finance': 'Tài chính',
  'bo.reports': 'Báo cáo', 'bo.settings': 'Cài đặt', 'admin.data': 'Data Explorer', 'admin.erp': 'ERP Simulator',
}

export function SettingsPage() {
  const { branchId, toast } = useApp()
  const [tab, setTab] = useState<'store' | 'tables' | 'rbac' | 'audit' | 'cloud' | 'system'>('store')
  const [unlocked, setUnlocked] = useState(() => adminUnlocked())
  const [gateOpen, setGateOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const branches = useSql(() => getBranches(), [])
  const tables = useSql(() => getTables(branchId), [branchId])
  const audit = useSql(() => getAuditLogs(80), [])
  const rbacRoles = useSql(() => getRoles(), [])
  const branch = branches.find((b) => b.id === branchId)
  const [form, setForm] = useState({ name: branch?.name ?? '', address: branch?.address ?? '', phone: branch?.phone ?? '', vat: (branch?.vat_rate ?? 0.08) * 100 })

  return (
    <div>
      <PageHeader icon={<Store size={20} />} title="Cài đặt hệ thống" description="Thông tin cửa hàng, sơ đồ bàn, phân quyền, nhật ký và dữ liệu"
        actions={
          unlocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-matcha-50 px-2 py-1 text-[11px] font-semibold text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-200">
                🔓 Quản trị: {adminUsername() ?? 'admin'}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPwOpen(true)}>Đổi mật khẩu</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await adminLogout(); setUnlocked(false); setTab('store'); toast({ title: 'Đã khoá khu vực quản trị', tone: 'success' }) }}>Khoá</Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" icon={<Lock size={14} />} onClick={() => setGateOpen(true)}>Quản trị CSDL</Button>
          )
        } />
      <Tabs value={tab} onChange={setTab} className="mb-3" tabs={[
        { value: 'store', label: 'Cửa hàng' }, { value: 'tables', label: 'Sơ đồ bàn' }, { value: 'rbac', label: 'Phân quyền' },
        { value: 'audit', label: 'Nhật ký' },
        // Tab cơ sở dữ liệu CHỈ xuất hiện sau khi mở khoá bằng tài khoản quản trị
        ...(unlocked ? [{ value: 'cloud' as const, label: 'Cơ sở dữ liệu 🔒' }] : []),
        { value: 'system', label: 'Hệ thống' },
      ]} />

      <AdminGate open={gateOpen} onClose={() => setGateOpen(false)} onUnlocked={() => { setUnlocked(true); setTab('cloud') }} />

      {pwOpen && (
        <ChangeAdminPassword onClose={() => { setPwOpen(false); setUnlocked(adminUnlocked()) }} />
      )}

      {tab === 'cloud' && (unlocked ? <CloudDatabase /> : <LockedNotice onUnlock={() => setGateOpen(true)} />)}

      {tab === 'store' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Thông tin chi nhánh" subtitle={branch?.code} icon={<Building2 size={16} />} />
            <div className="space-y-3 p-4">
              <Field label="Tên chi nhánh"><Input value={form.name || branch?.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Địa chỉ"><Input value={form.address || branch?.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              <Field label="Hotline"><Input value={form.phone || branch?.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Thuế VAT (%)" hint="Áp dụng cho hoá đơn mới"><Input type="number" value={form.vat} onChange={(e) => setForm({ ...form, vat: Number(e.target.value) })} /></Field>
              <Button variant="primary" icon={<Save size={15} />} onClick={() => {
                run('UPDATE branches SET name = ?, address = ?, phone = ?, vat_rate = ? WHERE id = ?', [form.name || branch?.name || '', form.address || branch?.address || '', form.phone || branch?.phone || '', form.vat / 100, branchId])
                toast({ title: 'Đã lưu thông tin chi nhánh', tone: 'success' })
              }}>Lưu thay đổi</Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Phương thức thanh toán" subtitle="Bật/tắt theo nhu cầu từng chi nhánh" icon={<CreditCard size={16} />} />
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {Object.entries(METHOD_LABEL).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px] text-ink-700 dark:text-ink-200">{v}</span>
                  <Switch checked={k !== 'credit'} onChange={() => toast({ title: 'Cấu hình mẫu', description: 'Bản demo chưa lưu cấu hình phương thức thanh toán.', tone: 'info' })} label={v} />
                </li>
              ))}
            </ul>
            <p className="border-t border-ink-100 px-4 py-3 text-[11.5px] text-ink-400 dark:border-ink-800">
              Máy in hoá đơn (K80) và tem ly được mô phỏng qua hộp thoại in của trình duyệt — CSS in đã chuẩn hoá khổ 80mm.
            </p>
          </Card>
        </div>
      )}

      {tab === 'tables' && (
        <Card>
          <CardHeader title="Sơ đồ bàn" subtitle="Kéo thả để sắp xếp vị trí (toạ độ lưu vào bảng dining_tables)" icon={<Grid3x3 size={16} />} />
          <div className="relative m-4 h-[420px] overflow-hidden rounded-2xl border border-ink-200 bg-[radial-gradient(circle,#d9e2db_1px,transparent_1px)] [background-size:18px_18px] dark:border-ink-700 dark:bg-[radial-gradient(circle,#2a322c_1px,transparent_1px)]">
            {tables.map((t) => (
              <div key={t.id} className="absolute cursor-move select-none rounded-xl border border-matcha-300 bg-white px-3 py-2 text-[11.5px] font-medium text-ink-800 shadow-soft dark:border-matcha-700 dark:bg-ink-900 dark:text-ink-100"
                style={{ left: t.x, top: t.y }}
                draggable
                onDragEnd={(e) => {
                  const parent = e.currentTarget.parentElement!.getBoundingClientRect()
                  updateTablePosition(t.id, Math.round(e.clientX - parent.left - 30), Math.round(e.clientY - parent.top - 16))
                }}>
                <p className="font-semibold">{t.name}</p>
                <p className="text-[10px] text-ink-400">{t.zone} · {t.seats} chỗ</p>
              </div>
            ))}
          </div>
          <p className="px-4 pb-4 text-[11.5px] text-ink-400">Có {tables.length} bàn tại chi nhánh này. Kéo thả để mô phỏng lại cách bố trí mặt bằng.</p>
        </Card>
      )}

      {tab === 'rbac' && (
        <Card className="overflow-hidden">
          <CardHeader title="Ma trận phân quyền (RBAC động)" subtitle="Đọc trực tiếp từ bảng roles — sửa ở màn hình Vai trò & phân quyền"
            icon={<Shield size={16} />}
            right={<Button size="sm" variant="primary" onClick={() => { location.hash = '#/roles' }}>Quản trị phân quyền</Button>} />
          <div className="max-h-[calc(100dvh-280px)] overflow-auto">
            <table className="table-base">
              <thead>
                <tr><th>Quyền</th>{rbacRoles.map((r) => <th key={r.id} className="text-center">{r.name}</th>)}</tr>
              </thead>
              <tbody>
                {PERM_GROUPS.map((g) => (
                  <>
                    <tr key={g.module} className="bg-ink-50 dark:bg-ink-800">
                      <td colSpan={rbacRoles.length + 1} className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{g.icon} {g.label}</td>
                    </tr>
                    {g.perms.map((perm) => (
                      <tr key={perm.code}>
                        <td className="text-ink-700 dark:text-ink-200">{perm.label}<span className="ml-1.5 font-mono text-[10px] text-ink-400">{perm.code}</span></td>
                        {rbacRoles.map((r) => (
                          <td key={r.id} className="text-center">
                            {permsOf(r).includes(perm.code) ? <span className="text-matcha-600">✓</span> : <span className="text-ink-300">–</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'audit' && (
        <Card className="overflow-hidden">
          <CardHeader title="Nhật ký hoạt động" subtitle={`${audit.length} bản ghi gần nhất`} icon={<ClipboardList size={16} />} />
          <table className="table-base">
            <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Bảng</th><th>Bản ghi</th><th>Giá trị sau</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-ink-500">{formatDateTime(a.created_at)}</td>
                  <td className="font-medium text-ink-900 dark:text-ink-50">{a.user_name ?? 'Hệ thống'}</td>
                  <td><Badge tone="gray">{a.action}</Badge></td>
                  <td className="font-mono text-[11.5px] text-ink-500">{a.entity}</td>
                  <td className="text-ink-500">{a.entity_id}</td>
                  <td className="max-w-[280px] truncate font-mono text-[10.5px] text-ink-400">{a.after_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'system' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Cơ sở dữ liệu" subtitle="SQLite WASM + IndexedDB" icon={<Database size={16} />} />
            <div className="space-y-2 p-4 text-[12.5px]">
              <Row label="Kích thước CSDL" value={`${(dbSizeBytes() / 1048576).toFixed(2)} MB`} />
              <Row label="Engine" value="sql.js (SQLite 3 WASM)" />
              <Row label="Lưu trữ" value="IndexedDB — tồn tại qua reload" />
              <Row label="Múi giờ" value="Asia/Ho_Chi_Minh (UTC+7)" />
              <Row label="Tiền tệ" value="VND — 45.000 ₫" />
              <div className="pt-2"><ResetDataButton /></div>
              <p className="text-[11.5px] leading-relaxed text-ink-400">
                Bản demo chạy hoàn toàn phía trình duyệt: không có server, không có tài khoản, dữ liệu chỉ nằm trên máy bạn.
                Reset sẽ sinh lại bộ dữ liệu 90 ngày (~3 giây).
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Chi nhánh trong chuỗi" icon={<Store size={16} />} />
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {branches.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-ink-900 dark:text-ink-50">{b.name}</p>
                    <Badge tone="green">VAT {Math.round(b.vat_rate * 100)}%</Badge>
                  </div>
                  <p className="text-[11.5px] text-ink-400">{b.address}, {b.city} · {b.phone}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}


/** ISO (UTC) → giờ Việt Nam */
function vnTime(iso: string | null) {
  if (!iso) return '—'
  const t = new Date(new Date(iso).getTime() + 7 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)}/${t.getUTCFullYear()} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`
}

/* ------------------------- Cơ sở dữ liệu thật (Postgres) ------------------------- */
function CloudDatabase() {
  const { toast } = useApp()
  const [cfg, setCfg] = useState<CloudConfig>(() => loadCloud())
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [busy, setBusy] = useState<'push' | 'pull' | 'connect' | null>(null)
  const [diff, setDiff] = useState<{ table: string; local: number; cloud: number }[] | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [shareMode, setShareMode] = useState<ShareMode>('ro')
  const [shareLabel, setShareLabel] = useState('')
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [newToken, setNewToken] = useState<{ token: string; sql: string } | null>(null)
  const [tokenState, setTokenState] = useState<{ ok: boolean; message: string } | null>(null)
  const [checkingToken, setCheckingToken] = useState(false)
  const tokenMsg = tokenWarning(cfg.token)
  // Mã hiện tại có quyền ghi? false = máy này dùng LINK CHỈ XEM → ẩn toàn bộ thông tin kết nối
  const [canWrite, setCanWrite] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    if (!cfg.url || !cfg.key) return
    void checkWritePermission(cfg).then((w) => { if (alive) setCanWrite(w) })
    return () => { alive = false }
  }, [cfg.url, cfg.key, cfg.token])
  // Chẩn đoán mã đang dùng: server nói mã có đọc được / ghi được không
  const [perm, setPerm] = useState<{ valid: boolean | null; write: boolean | null } | null>(null)
  const [permBusy, setPermBusy] = useState(false)
  const checkPerm = async () => {
    setPermBusy(true)
    try { setPerm(await tokenPermission(cfg)) } finally { setPermBusy(false) }
  }
  useEffect(() => { if (cfg.url && cfg.key) void checkPerm() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cfg.url, cfg.key])
  const readOnly = canWrite === false
  // Quản trị CSDL đã mở khoá thì LUÔN thấy đầy đủ ô nhập — kể cả khi máy đang bị chặn ghi
  // (mã đồng bộ hết hiệu lực/bị thu hồi) — để dán mã mới và khôi phục quyền ghi.
  const adminMode = adminUnlocked()
  const [diffBusy, setDiffBusy] = useState(false)
  const counts = localCounts()
  const totalRows = counts.reduce((sum, c) => sum + c.rows, 0)
  let host = ''
  try { host = new URL(cfg.url).host } catch { host = '' }

  if (readOnly && !adminMode) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Máy này đang ở chế độ CHỈ XEM" subtitle="Dùng link chia sẻ chỉ-đọc do chủ chuỗi gửi" icon={<Eye size={16} />} />
          <div className="space-y-3 p-4 text-[12.5px] text-ink-600 dark:text-ink-300">
            <p className="rounded-xl bg-amber-50 p-2.5 text-[11.5px] leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Bạn xem được toàn bộ dữ liệu (đơn, kho, khách, báo cáo) nhưng <b>không sửa/xoá/đẩy dữ liệu lên cloud</b> — Postgres chặn mọi thao tác ghi.
              Thông tin kết nối (anon key, mã đồng bộ) đã được ẩn trên máy này.
            </p>
            <div className="space-y-1">
              <Row label="Máy chủ dữ liệu" value={host || '—'} />
              <Row label="Lần tải gần nhất" value={cfg.lastSync ? vnTime(cfg.lastSync) : '—'} />
              <Row label="Số dòng đã tải" value={cfg.lastRows ? cfg.lastRows.toLocaleString('vi-VN') : totalRows.toLocaleString('vi-VN')} />
              <Row label="Quyền" value="Chỉ đọc (không ghi được)" />
            </div>
            <Button variant="primary" icon={<Download size={15} />} disabled={!!busy} onClick={() => runSync('pull')}>
              {busy === 'pull' ? 'Đang tải…' : 'Tải dữ liệu mới nhất từ cloud'}
            </Button>
            {progress && <p className="text-[11px] text-ink-400">{progress.done ? 'Hoàn tất' : `Đang tải ${progress.table}`} · {progress.index}/{progress.total} bảng</p>}
            <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
              Cần quyền nhập liệu? Nhờ chủ chuỗi vào <b>Cài đặt → Cơ sở dữ liệu → Chia sẻ cho người khác</b> tạo link <b>“Làm việc (được ghi)”</b> rồi gửi lại.
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Dữ liệu trên máy này" subtitle={`${counts.length} bảng · ${totalRows.toLocaleString('vi-VN')} dòng`} icon={<Database size={16} />} />
          <div className="max-h-[300px] overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-1">
              {counts.map((c) => (
                <div key={c.table} className="flex items-center justify-between rounded-lg bg-ink-50 px-2 py-1 text-[11px] dark:bg-ink-800">
                  <span className="truncate font-mono text-ink-500">{c.table}</span>
                  <span className="font-semibold tabular-nums">{c.rows.toLocaleString('vi-VN')}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const update = (patch: Partial<CloudConfig>) => {
    const next = { ...cfg, ...patch }
    setCfg(next)
    saveCloud(next)
  }

  const runSync = async (mode: 'push' | 'pull') => {
    setBusy(mode)
    setProgress(null)
    try {
      const res = mode === 'push' ? await pushAll(cfg, setProgress) : await pullAll(cfg, setProgress)
      setCfg(loadCloud())
      toast({ title: mode === 'push' ? 'Đã đẩy dữ liệu lên Postgres' : 'Đã tải dữ liệu từ Postgres', description: `${res.rows.toLocaleString('vi-VN')} dòng · ${new Date().toLocaleTimeString('vi-VN')}`, tone: 'success' })
      if (mode === 'pull') setTimeout(async () => { await flushCloudSave(); location.reload() }, 1200)
    } catch (e) {
      toast({ title: 'Đồng bộ thất bại', description: (e as Error).message.slice(0, 160), tone: 'error' })
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  /** Máy mới: kiểm tra → lưu cấu hình → tải toàn bộ dữ liệu → bật tự đồng bộ. */
  const connectThisMachine = async () => {
    if (!cfg.url || !cfg.key) {
      toast({ title: 'Thiếu thông tin', description: 'Cần Project URL và anon key trước đã.', tone: 'error' })
      return
    }
    setBusy('connect')
    setProgress(null)
    try {
      const t = await testCloud(cfg)
      setResult(t)
      if (!t.ok) throw new Error(t.message)
      const res = await pullAll({ ...cfg, autoSync: true }, setProgress)
      saveCloud({ ...cfg, autoSync: true, lastSync: new Date().toISOString(), lastRows: res.rows })
      setCfg(loadCloud())
      toast({ title: 'Đã kết nối máy này với cloud', description: `${res.rows.toLocaleString('vi-VN')} dòng đã tải về · tự đồng bộ đã bật`, tone: 'success' })
      setTimeout(async () => { await flushCloudSave(); location.reload() }, 1400)
    } catch (e) {
      toast({ title: 'Kết nối thất bại', description: (e as Error).message.slice(0, 180), tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  /** So sánh số dòng từng bảng: máy này ↔ cloud. */
  const compareNow = async () => {
    setDiffBusy(true)
    try {
      const cloud = await cloudCounts(cfg)
      const local = new Map(counts.map((c) => [c.table, c.rows]))
      const rows = Object.keys(cloud)
        .map((t) => ({ table: t, local: local.get(t) ?? 0, cloud: cloud[t] }))
        .filter((r) => r.local !== r.cloud)
      setDiff(rows)
      toast({
        title: rows.length ? `${rows.length} bảng lệch giữa máy này và cloud` : 'Máy này khớp hoàn toàn với cloud',
        description: rows.length ? 'Bấm "Kết nối & tải toàn bộ" để lấy dữ liệu cloud về' : 'Số dòng mọi bảng bằng nhau',
        tone: rows.length ? 'error' : 'success',
      })
    } catch (e) {
      toast({ title: 'Không đối chiếu được', description: (e as Error).message.slice(0, 160), tone: 'error' })
    } finally { setDiffBusy(false) }
  }

  return (
    <div className="space-y-3">
      {adminMode && (
        <Card>
          <CardHeader title="Quyền ghi của máy này" subtitle="Máy chủ Postgres trả lời trực tiếp — không phải suy đoán"
            icon={<Shield size={16} />} />
          <div className="space-y-2 p-4 text-[12px] text-ink-600 dark:text-ink-300">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx('rounded-lg px-2 py-1 text-[11.5px] font-semibold',
                perm?.valid === true ? 'bg-matcha-50 text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-200'
                  : perm?.valid === false ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/25 dark:text-rose-200'
                    : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>
                Mã đọc dữ liệu: {perm === null ? 'đang kiểm tra…' : perm.valid === null ? 'không kiểm tra được' : perm.valid ? 'hợp lệ ✅' : 'KHÔNG hợp lệ ❌'}
              </span>
              <span className={cx('rounded-lg px-2 py-1 text-[11.5px] font-semibold',
                perm?.write === true ? 'bg-matcha-50 text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-200'
                  : perm?.write === false ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
                    : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>
                Quyền ghi: {perm === null ? '…' : perm.write === null ? 'không kiểm tra được' : perm.write ? 'được ghi ✅' : 'CHỈ ĐỌC ⚠️'}
              </span>
              <Button size="sm" variant="secondary" disabled={permBusy} onClick={() => { void checkPerm() }}>{permBusy ? 'Đang kiểm tra…' : 'Kiểm tra lại'}</Button>
              <Button size="sm" variant="primary" disabled={permBusy} onClick={async () => {
                setPermBusy(true)
                const p = await tokenPermission(cfg)
                setPerm(p)
                const can = await refreshWritePermission()
                setCanWrite(can)
                setPermBusy(false)
                if (can === true) toast({ title: 'Đã có quyền ghi ✅', description: 'Máy này thêm/sửa/xoá dữ liệu được ngay, không cần tải lại trang.', tone: 'success' })
                else toast({ title: 'Vẫn CHỈ ĐỌC', description: p.valid === false ? 'Mã đang dùng là mã chỉ đọc hoặc đã bị thu hồi — dán mã mới của chủ chuỗi.' : 'Chưa kiểm tra được quyền ghi — xem lại Project URL / anon key.', tone: 'error' })
              }}>Khôi phục quyền ghi</Button>
            </div>
            {perm?.write === false && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11.5px] leading-relaxed text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                <p className="font-semibold">⚠️ Máy này đang ở chế độ CHỈ XEM</p>
                <p className="mt-0.5">
                  {perm.valid === true
                    ? 'Mã trên máy ĐỌC được nhưng KHÔNG có quyền ghi — đây là mã “Chỉ xem” (link chỉ đọc) hoặc mã đã bị thu hồi quyền ghi.'
                    : 'Mã trên máy không còn hiệu lực (đã bị thu hồi hoặc gõ sai).'}
                  {' '}Dán <b>mã đồng bộ GHI</b> của chủ chuỗi vào ô “Mã đồng bộ” bên dưới → bấm <b>Kiểm tra lại</b> → <b>Khôi phục quyền ghi</b>.
                </p>
                {cfg.token && (
                  <p className="mt-1 font-mono text-[10.5px] text-amber-800/80 dark:text-amber-200/80">
                    mã đang dùng: {cfg.token.slice(0, 10)}…{cfg.token.slice(-6)} ({cfg.token.length} ký tự)
                  </p>
                )}
              </div>
            )}
            {perm?.write === true && (
              <p className="text-[11.5px] text-matcha-800 dark:text-matcha-200">Máy này đang có quyền ghi đầy đủ — không bị chặn thao tác nào.</p>
            )}
          </div>
        </Card>
      )}
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="Kết nối Postgres (Supabase / Neon)" subtitle="Nơi lưu dữ liệu thật, nhiều máy dùng chung" icon={<Cloud size={16} />} />
        <div className="space-y-3 p-4">
          <Field label="Project URL" hint="Supabase → Settings → API → Project URL, dạng https://xxxx.supabase.co">
            <Input value={cfg.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://abcdefgh.supabase.co" />
          </Field>
          <Field label="Anon / service key" hint="Supabase → Settings → API → anon public key. Key chỉ lưu trong máy bạn.">
            <Input type="password" value={cfg.key} onChange={(e) => update({ key: e.target.value })} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." />
          </Field>
          <Field label="Mã đồng bộ (sync token)" hint="Bắt buộc khi cloud đã bật RLS: mã có dạng mk_ + 64 ký tự hex. DB chỉ lưu SHA-256 của mã.">
            <div className="flex gap-1.5">
              <Input type={showToken ? 'text' : 'password'} value={cfg.token ?? ''} onChange={(e) => { update({ token: e.target.value }); setTokenState(null) }} placeholder="mk_… (xem file MATCHA-cloud-token.txt)" className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => setShowToken((v) => !v)}>{showToken ? 'Ẩn' : 'Hiện'}</Button>
              <Button size="sm" variant="secondary" disabled={checkingToken || !cfg.url || !cfg.key} onClick={async () => {
                setCheckingToken(true)
                setTokenState(await checkToken(cfg))
                setCheckingToken(false)
              }}>{checkingToken ? 'Đang kiểm tra…' : 'Kiểm tra mã'}</Button>
            </div>
          </Field>
          {tokenMsg && (
            <p className="rounded-xl bg-rose-50 p-2 text-[11px] leading-relaxed text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
              ⚠️ {tokenMsg}
            </p>
          )}
          <button className="text-left text-[11px] text-matcha-700 underline dark:text-matcha-300" onClick={async () => {
            const bytes = crypto.getRandomValues(new Uint8Array(32))
            const token = 'mk_' + [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('')
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
            const hash = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('')
            const sql = `insert into public.sync_tokens (label, token_hash, note)\nvalues ('Máy mới ${new Date().toLocaleDateString('vi-VN')}', '${hash}', 'cấp lại mã');`
            setNewToken({ token, sql })
            setLostOpen(true)
          }}>Quên / mất mã đồng bộ? Sinh mã mới tại đây →</button>
          {tokenState && (
            <p className={cx('rounded-xl p-2 text-[11px] leading-relaxed', tokenState.ok ? 'bg-matcha-50 text-matcha-800 dark:bg-matcha-900/20 dark:text-matcha-200' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-200')}>
              {tokenState.ok ? '✅' : '❌'} {tokenState.message}
            </p>
          )}
          {keyWarning(cfg.key) && (
            <p className="rounded-xl bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">⚠️ {keyWarning(cfg.key)}</p>
          )}
          <label className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-[12px] dark:bg-ink-800">
            <span className="text-ink-600 dark:text-ink-300">Tự tải dữ liệu từ cloud khi mở app <span className="text-ink-400">(tối đa 60 phút/lần để tiết kiệm băng thông)</span></span>
            <Switch checked={cfg.autoSync} onChange={(v) => update({ autoSync: v })} label="auto sync" />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-[12px] dark:bg-ink-800">
            <span className="text-ink-600 dark:text-ink-300">Theo dõi thay đổi realtime (báo khi máy khác sửa dữ liệu)</span>
            <Switch checked={cfg.realtime !== false} onChange={(v) => update({ realtime: v })} label="realtime" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<RefreshCw size={15} />} disabled={testing || !cfg.url || !cfg.key} onClick={async () => {
              setTesting(true)
              const r = await testCloud(cfg)
              setResult(r)
              setTesting(false)
            }}>{testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</Button>
            <Button variant="primary" icon={<Upload size={15} />} disabled={!!busy || !cfg.url || !!tokenMsg} onClick={() => runSync('push')}>
              {busy === 'push' ? 'Đang đẩy…' : 'Đẩy dữ liệu lên'}
            </Button>
            <Button icon={<Download size={15} />} disabled={!!busy || !cfg.url || !!tokenMsg} onClick={() => runSync('pull')}>
              {busy === 'pull' ? 'Đang tải…' : 'Tải từ cloud'}
            </Button>
            <Button variant="ghost" icon={<RefreshCw size={15} />} disabled={!!busy || !cfg.url} onClick={async () => {
              if (!confirm('Xoá toàn bộ dữ liệu trên cloud rồi nạp lại từ máy này? Dùng khi cloud bị lệch.')) return
              setBusy('push')
              setProgress(null)
              try {
                const res = await pushAll(cfg, setProgress, 'replace')
                setCfg(loadCloud())
                toast({ title: 'Đã ghi đè cloud bằng dữ liệu máy này', description: `${res.rows.toLocaleString('vi-VN')} dòng`, tone: 'success' })
              } catch (e) {
                toast({ title: 'Ghi đè thất bại', description: (e as Error).message.slice(0, 160), tone: 'error' })
              } finally { setBusy(null); setProgress(null) }
            }}>Xoá &amp; đẩy lại</Button>
          </div>
          {result && (
            <div className={cx('rounded-xl p-2.5 text-[11.5px]', result.ok ? 'bg-matcha-50 text-matcha-800 dark:bg-matcha-900/20 dark:text-matcha-200' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20')}>
              {result.ok ? '✅' : '⚠️'} {result.message}{result.latency ? ` · ${result.latency} ms` : ''}
            </div>
          )}
          {progress && (
            <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-ink-800">
              <div className="flex justify-between text-[11px] text-ink-500">
                <span>{progress.done ? 'Hoàn tất' : `Bảng ${progress.table}`}</span>
                <span>{progress.index}/{progress.total} · {progress.rows.toLocaleString('vi-VN')} dòng</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
                <div className="h-full rounded-full bg-matcha-600 transition-all" style={{ width: `${(progress.index / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {cfg.lastSync && <p className="text-[11px] text-ink-400">Lần đồng bộ cuối: {vnTime(cfg.lastSync)} · {cfg.lastRows.toLocaleString('vi-VN')} dòng</p>}
        </div>
      </Card>

      <TursoPanel />

      {lostOpen && newToken && (
        <Modal open onClose={() => setLostOpen(false)} title="Cấp lại mã đồng bộ" footer={
          <>
            <Button variant="ghost" onClick={() => setLostOpen(false)}>Đóng</Button>
            <Button variant="primary" onClick={() => { update({ token: newToken.token }); setLostOpen(false); setTokenState(null) }}>Dùng mã này cho máy này</Button>
          </>
        }>
          <div className="space-y-3 text-[12.5px]">
            <p className="rounded-xl bg-amber-50 p-2.5 text-[11.5px] leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Postgres chỉ lưu <b>hash</b> của mã, không lưu mã gốc — nên không xem lại được mã cũ, chỉ cấp mã mới.
            </p>
            <div>
              <p className="mb-1 font-semibold">1. Mã mới (lưu vào file kín, ví dụ MATCHA-cloud-token.txt):</p>
              <div className="flex gap-2">
                <Input readOnly value={newToken.token} className="font-mono text-[11.5px]" />
                <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(newToken.token); toast({ title: 'Đã copy mã', tone: 'success' }) }}>Copy</Button>
              </div>
            </div>
            <div>
              <p className="mb-1 font-semibold">2. Chạy SQL này trong Supabase → SQL Editor → Run:</p>
              <Textarea readOnly rows={4} value={newToken.sql} className="font-mono text-[11px]" />
              <Button size="sm" className="mt-1" onClick={() => { void navigator.clipboard.writeText(newToken.sql); toast({ title: 'Đã copy SQL', tone: 'success' }) }}>Copy SQL</Button>
            </div>
            <p className="text-[11px] text-ink-500 dark:text-ink-400">3. Quay lại đây bấm <b>“Dùng mã này cho máy này”</b> → <b>Kiểm tra mã</b> → <b>Kết nối &amp; tải toàn bộ dữ liệu</b>. Các máy khác dùng chung mã này (mỗi máy có thể có mã riêng, đều hợp lệ).</p>
          </div>
        </Modal>
      )}

      <div className="space-y-3">
        <Card>
          <CardHeader title="Chia sẻ cho người khác (gửi link là dùng được)" subtitle="Link mang sẵn địa chỉ Postgres + mã truy cập — người nhận KHÔNG phải dán gì" icon={<Share2 size={16} />} />
          <div className="space-y-2 p-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
              <Field label="Người nhận là ai (để đặt tên mã)">
                <Input value={shareLabel} onChange={(e) => setShareLabel(e.target.value)} placeholder="VD: Quản lý Q3" className="h-9 text-[12.5px]" />
              </Field>
              <Field
                label="Quyền của link"
                hint={
                  shareMode === 'ro'
                    ? 'Chỉ xem: máy chủ chặn MỌI thao tác ghi — xem đơn, doanh thu, thực đơn nhưng không thêm/sửa/xoá được gì. An toàn gửi cho khách/đối tác xem báo cáo.'
                    : shareMode === 'order'
                      ? 'Đặt hàng: thêm/sửa ĐƠN & KHÁCH nhưng KHÔNG sửa thực đơn, danh mục, kho (cần token ĐẶT HÀNG ở khối Đồng bộ Turso).'
                      : 'Làm việc: người nhận thêm/sửa mọi dữ liệu (thực đơn, danh mục, kho, nhân sự…) — chỉ gửi cho nhân viên tin cậy.'
                }
              >
                <Select value={shareMode} onChange={(e) => { setShareMode(e.target.value as ShareMode); setShareLink(null) }} className="h-9 text-[12.5px]">
                  <option value="ro">Chỉ xem (chỉ đọc)</option>
                  <option value="rw">Làm việc (được ghi)</option>
                  <option value="order">Đặt hàng (chỉ ghi đơn &amp; khách)</option>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Share2 size={15} />} disabled={shareBusy || !!tokenMsg || !cfg.url || !cfg.key} onClick={async () => {
                setShareBusy(true)
                setShareLink(null)
                try {
                  // Mỗi link cấp 1 mã RIÊNG (thu hồi được từng người), không dùng lại mã của máy này
                  const r = shareMode === 'order'
                    ? mintOrderShare()
                    : await mintShareToken(cfg, shareLabel || (shareMode === 'ro' ? 'Link chỉ xem' : 'Link làm việc'), shareMode === 'rw')
                  if (!r.ok || !r.token) throw new Error(r.message ?? 'Không tạo được mã chia sẻ')
                  const token = r.token
                  const link = buildShareLink({ url: r.url ?? cfg.url, key: r.key ?? cfg.key, token, mode: shareMode, label: shareLabel })
                  setShareLink(link)
                  await navigator.clipboard.writeText(link).catch(() => { /* trình duyệt chặn clipboard */ })
                  toast({ title: 'Đã tạo link dùng chung', description: 'Đã copy vào clipboard — gửi qua Zalo/Messenger là dùng được', tone: 'success' })
                } catch (e) {
                  toast({ title: 'Không tạo được link', description: (e as Error).message.slice(0, 160), tone: 'error' })
                } finally { setShareBusy(false) }
              }}>{shareBusy ? 'Đang tạo link…' : 'Tạo link & copy'}</Button>
              {shareLink && (
                <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(shareLink); toast({ title: 'Đã copy link', tone: 'success' }) }}>Copy lại</Button>
              )}
            </div>
            {shareLink && (
              <div className="space-y-1">
                <Input readOnly value={shareLink} className="font-mono text-[10.5px]" onFocus={(e) => e.currentTarget.select()} />
                <p className="text-[11px] text-ink-500 dark:text-ink-400">
                  Mở link này trên máy/điện thoại khác: app <b>tự cấu hình cloud, tự tải toàn bộ dữ liệu</b> rồi vào màn đăng nhập.
                  {shareMode === 'ro' && ' Đây là token CHỈ ĐỌC: người nhận xem được nhưng Turso chặn mọi thao tác ghi.'}
                  {shareMode === 'order' && ' Đây là token ĐẶT HÀNG: thêm/sửa đơn & khách được, còn thực đơn/danh mục/kho thì Turso chặn.'}
                  {shareMode === 'rw' && ' Đây là token GHI ĐẦY ĐỦ: chỉ gửi cho nhân viên tin cậy.'}
                </p>
                <a className="text-[11px] text-matcha-700 underline dark:text-matcha-300" href={shareLink} target="_blank" rel="noreferrer">Mở thử link này ↗</a>
              </div>
            )}
            <p className="rounded-xl bg-ink-50 p-2 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-800 dark:text-ink-400">
              ⚠️ Ai có link là vào được với đúng quyền của link đó. Đừng đăng link lên mạng xã hội; thu hồi bằng cách vào Supabase → bảng <code>sync_tokens</code> → đặt <code>active = false</code>.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Máy mới? Bấm 1 nút là xong" subtitle="Dán URL + anon key + mã đồng bộ vào ô bên trái, rồi bấm nút này" icon={<Cloud size={16} />} />
          <div className="space-y-2 p-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Download size={15} />} disabled={!!busy || !cfg.url || !cfg.key || !!tokenMsg} onClick={connectThisMachine}>
                {busy === 'connect' ? 'Đang kết nối & tải…' : 'Kết nối & tải toàn bộ dữ liệu'}
              </Button>
              <Button variant="secondary" icon={<RefreshCw size={15} />} disabled={diffBusy || !cfg.url || !cfg.key} onClick={compareNow}>
                {diffBusy ? 'Đang đối chiếu…' : 'Đối chiếu máy này ↔ cloud'}
              </Button>
            </div>
            {tokenMsg && (
              <p className="rounded-xl bg-rose-50 p-2.5 text-[11.5px] leading-relaxed text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
                ⚠️ <b>Chưa kết nối được:</b> {tokenMsg} Dán mã đúng vào ô <b>“Mã đồng bộ (sync token)”</b> ở cột bên trái — mã này <b>khác</b> anon key (mã dài ~67 ký tự, bắt đầu bằng <code>mk_</code>, xem file <code>MATCHA-cloud-token.txt</code>).
              </p>
            )}
            <p className="text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
              Nút đầu tiên sẽ: kiểm tra kết nối → tải <b>toàn bộ</b> dữ liệu trên Postgres về máy này → bật <b>tự đồng bộ khi mở app</b>.
              Dùng cho máy thứ 2 trở đi (máy thu ngân, laptop quản lý…). Dữ liệu cloud <b>không bị ghi đè</b> bởi thao tác này.
            </p>
            {diff && (
              <div className="max-h-[200px] overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700">
                <table className="w-full text-[11.5px]">
                  <thead className="sticky top-0 bg-ink-50 text-left text-[10.5px] uppercase text-ink-400 dark:bg-ink-800">
                    <tr><th className="px-2 py-1">Bảng</th><th className="px-2 py-1 text-right">Máy này</th><th className="px-2 py-1 text-right">Cloud</th></tr>
                  </thead>
                  <tbody>
                    {diff.length === 0 && <tr><td colSpan={3} className="px-2 py-3 text-center text-matcha-700 dark:text-matcha-300">Khớp hoàn toàn ✅</td></tr>}
                    {diff.slice(0, 60).map((r) => (
                      <tr key={r.table} className="border-t border-ink-100 dark:border-ink-800">
                        <td className="px-2 py-1 font-mono text-ink-500">{r.table}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.local.toLocaleString('vi-VN')}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-semibold">{r.cloud < 0 ? '—' : r.cloud.toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Bước 1 — Tạo bảng trên Postgres" subtitle="Chạy file SQL một lần trong SQL Editor" icon={<Database size={16} />} />
          <div className="space-y-2 p-4 text-[12px] text-ink-600 dark:text-ink-300">
            <ol className="list-inside list-decimal space-y-1">
              <li>Tạo project miễn phí tại supabase.com (hoặc neon.tech).</li>
              <li>Tải <b>schema.sql</b> bên dưới → mở SQL Editor → dán → Run.</li>
              <li>Dán Project URL + anon key vào ô bên trái → Kiểm tra kết nối.</li>
              <li>Chạy <b>realtime.sql</b> (báo thay đổi giữa các máy) và <b>rls.sql</b> (chỉ thiết bị có mã đồng bộ mới được ghi) — hoặc bỏ qua nếu cloud đã cấu hình sẵn.</li>
              <li>Bấm <b>Đẩy dữ liệu lên</b> để đưa {totalRows.toLocaleString('vi-VN')} dòng hiện có lên cloud (hoặc bấm <b>Tải từ cloud</b> nếu đã có dữ liệu).</li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="primary" size="sm" icon={<Download size={14} />} onClick={() => {
                downloadFile('matcha-schema.sql', toPgDDL(), 'text/plain;charset=utf-8')
                toast({ title: 'Đã tải schema.sql', description: '75 bảng + chỉ mục + RLS cho anon key', tone: 'success' })
              }}>schema.sql (75 bảng + RLS)</Button>
              <Button size="sm" icon={<Download size={14} />} onClick={() => {
                const sql = buildSeedSQL()
                downloadFile('matcha-seed.sql', sql, 'text/plain;charset=utf-8')
                toast({ title: 'Đã tải seed.sql', description: `${(sql.length / 1024 / 1024).toFixed(1)} MB dữ liệu thật đang chạy`, tone: 'success' })
              }}>seed.sql (dữ liệu hiện có)</Button>
              <Button size="sm" variant="ghost" onClick={async () => {
                await navigator.clipboard.writeText(toPgDDL())
                toast({ title: 'Đã copy schema Postgres', tone: 'success' })
              }}>Copy schema</Button>
              <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => {
                downloadFile('matcha-realtime.sql', REALTIME_SQL, 'text/plain;charset=utf-8')
                toast({ title: 'Đã tải realtime.sql', description: 'Chạy 1 lần để bật realtime cho 11 bảng', tone: 'success' })
              }}>realtime.sql</Button>
              <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => {
                downloadFile('matcha-rls.sql', RLS_SQL, 'text/plain;charset=utf-8')
                toast({ title: 'Đã tải rls.sql', description: 'Siết quyền ghi: chỉ thiết bị có mã đồng bộ mới ghi được', tone: 'success' })
              }}>rls.sql</Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Dữ liệu cục bộ" subtitle={`${counts.length} bảng · ${totalRows.toLocaleString('vi-VN')} dòng trong SQLite WASM (IndexedDB)`} icon={<Database size={16} />} />
          <div className="max-h-[240px] overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-1">
              {counts.map((c) => (
                <div key={c.table} className="flex items-center justify-between rounded-lg bg-ink-50 px-2 py-1 text-[11px] dark:bg-ink-800">
                  <span className="truncate font-mono text-ink-500">{c.table}</span>
                  <span className="font-semibold tabular-nums">{c.rows.toLocaleString('vi-VN')}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
    </div>
  )
}

function ChangeAdminPassword({ onClose }: { onClose: () => void }) {
  const { toast } = useApp()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    if (newPw !== confirm) { setErr('Mật khẩu nhập lại không khớp.'); return }
    setBusy(true); setErr(null)
    const r = await adminChangePassword(oldPw, newPw)
    setBusy(false)
    if (!r.ok) { setErr(r.message ?? 'Không đổi được'); return }
    toast({ title: 'Đã đổi mật khẩu quản trị', description: 'Mọi phiên quản trị đã bị huỷ — đăng nhập lại bằng mật khẩu mới.', tone: 'success' })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Đổi mật khẩu quản trị" footer={
      <>
        <Button variant="ghost" onClick={onClose}>Huỷ</Button>
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</Button>
      </>
    }>
      <div className="space-y-3">
        <Field label="Mật khẩu hiện tại"><Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="off" /></Field>
        <Field label="Mật khẩu mới" hint="Tối thiểu 10 ký tự, nên có chữ hoa, số và ký tự đặc biệt."><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="off" /></Field>
        <Field label="Nhập lại mật khẩu mới"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
        {err && <p className="rounded-xl bg-rose-50 p-2 text-[11.5px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">{err}</p>}
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-ink-500">{label}</span><span className="font-medium text-ink-800 dark:text-ink-100">{value}</span></div>
}
