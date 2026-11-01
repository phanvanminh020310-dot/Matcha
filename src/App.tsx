import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Toaster } from './components/ui'
import { CloudSyncWatcher } from './components/CloudSyncWatcher'
import { useApp } from './store/app'
import { initDatabase, type InitProgress } from './lib/db'
import { checkWritePermission, clearCloudError, loadCloud, pullAll, saveCloud, setCloudError } from './lib/cloud'
import { setReadOnlyMode } from './lib/db'
import { ensureRoles } from './lib/permissions'
import { refreshRbac } from './lib/rbac'
import { LoginPage } from './pages/Login'
import { POSPage } from './pages/POS'
import { KDSPage } from './pages/KDS'
import { DisplayPage } from './pages/Display'
import { DashboardPage } from './pages/Dashboard'
import { OrdersPage } from './pages/Orders'
import { ProductsPage } from './pages/Products'
import { RecipesPage } from './pages/Recipes'
import { InventoryPage } from './pages/Inventory'
import { PurchasingPage } from './pages/Purchasing'
import { CustomersPage } from './pages/Customers'
import { PromotionsPage } from './pages/Promotions'
import { StaffPage } from './pages/Staff'
import { FinancePage } from './pages/Finance'
import { ReportsPage } from './pages/Reports'
import { SettingsPage } from './pages/Settings'
import { DataExplorerPage } from './pages/DataExplorer'
import { AdminDataPage } from './pages/AdminData'
import { RolesPage } from './pages/Roles'
import { ErpSimulatorPage } from './pages/ErpSimulator'
import { DeliveryPage, TrackingPage } from './pages/Delivery'
import { DriverPage } from './pages/Driver'
import { JoinPage } from './pages/Join'
import { PrintStudioPage } from './pages/PrintStudio'

/* ------------------------------ Boot screen ----------------------------- */
function BootScreen({ progress }: { progress: InitProgress[] }) {
  const last = progress[progress.length - 1]
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-matcha-900 px-6 text-white">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-3xl bg-matcha-500/30" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-4xl backdrop-blur">🍵</div>
      </div>
      <div className="text-center">
        <p className="text-[22px] font-semibold tracking-tight">Matcha POS</p>
        <p className="mt-1 text-[13px] text-white/60">Đang chuẩn bị cơ sở dữ liệu trong trình duyệt…</p>
      </div>
      <div className="w-[min(92vw,420px)] rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
        <div className="flex items-center justify-between text-[12px] text-white/80">
          <span>{last?.step ?? 'Khởi động'}</span>
          <span className="text-white/50">{last?.detail}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-matcha-300 transition-all duration-500" style={{ width: `${Math.min(100, progress.length * 22)}%` }} />
        </div>
        <ul className="mt-3 space-y-1 text-[11px] text-white/50">
          {progress.slice(-3).map((p, i) => (
            <li key={i}>• {p.step}{p.detail ? ` — ${p.detail}` : ''}</li>
          ))}
        </ul>
      </div>
      <p className="max-w-sm text-center text-[11px] leading-relaxed text-white/40">
        SQLite (WASM) · dữ liệu demo 90 ngày được sinh một lần và lưu vào IndexedDB.
        Lần mở sau sẽ tải lại ngay từ bộ nhớ máy.
      </p>
    </div>
  )
}

function TrackRoute() {
  const { code } = useParams<{ code: string }>()
  return <TrackingPage code={code ?? ''} />
}

function Protected({ children }: { children: React.ReactNode }) {
  const user = useApp((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <AppShell>{children}</AppShell>
}

function AppRoutes() {
  const user = useApp((s) => s.user)
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/pos" replace /> : <LoginPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/display" element={<DisplayPage />} />
      <Route path="/track/:code" element={<TrackRoute />} />
      <Route path="/pos" element={<Protected><POSPage /></Protected>} />
      <Route path="/kds" element={<Protected><KDSPage /></Protected>} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/orders" element={<Protected><OrdersPage /></Protected>} />
      <Route path="/products" element={<Protected><ProductsPage /></Protected>} />
      <Route path="/recipes" element={<Protected><RecipesPage /></Protected>} />
      <Route path="/inventory" element={<Protected><InventoryPage /></Protected>} />
      <Route path="/purchasing" element={<Protected><PurchasingPage /></Protected>} />
      <Route path="/delivery" element={<Protected><DeliveryPage /></Protected>} />
      <Route path="/driver" element={<Protected><DriverPage /></Protected>} />
      <Route path="/print" element={<Protected><PrintStudioPage /></Protected>} />
      <Route path="/customers" element={<Protected><CustomersPage /></Protected>} />
      <Route path="/promotions" element={<Protected><PromotionsPage /></Protected>} />
      <Route path="/staff" element={<Protected><StaffPage /></Protected>} />
      <Route path="/finance" element={<Protected><FinancePage /></Protected>} />
      <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="/admin" element={<Protected><AdminDataPage /></Protected>} />
      <Route path="/roles" element={<Protected><RolesPage /></Protected>} />
      <Route path="/data" element={<Protected><DataExplorerPage /></Protected>} />
      <Route path="/erp" element={<Protected><ErpSimulatorPage /></Protected>} />
      <Route path="*" element={<Navigate to={user ? '/pos' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<InitProgress[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    initDatabase((p) => { if (mounted) setProgress((prev) => [...prev, p]) })
      .then(async () => {
        if (!mounted) return
        ensureRoles()
        refreshRbac()
        setReady(true)
        // Nếu user đã cấu hình Postgres cloud và bật tự đồng bộ → kéo dữ liệu mới nhất về máy
        const cloud = loadCloud()
        // LINK CHỈ XEM: kiểm tra quyền ghi 1 lần khi mở app → chặn ghi ở mọi màn hình
        try {
          const canWrite = await checkWritePermission(cloud)
          setReadOnlyMode(canWrite === false)
          if (canWrite === false) {
            console.info('[matcha][cloud] chế độ CHỈ XEM — đã chặn thao tác ghi')
            window.dispatchEvent(new CustomEvent('matcha:readonly', { detail: true }))
          }
        } catch { /* không kiểm tra được → coi như bình thường */ }

        // Máy mới (chưa từng tải) mà đã có cấu hình cloud → tự tải ngay lần đầu,
        // không cần người dùng nhớ bật "tự đồng bộ".
        const firstRun = !cloud.lastSync && !!cloud.token
        const justSynced = !!cloud.lastSync && Date.now() - new Date(cloud.lastSync).getTime() < 120000
        if (cloud.url && cloud.key && (cloud.autoSync || firstRun) && !justSynced) {
          console.info('[matcha][cloud] auto-pull bắt đầu', cloud.url)
          try {
            const res = await pullAll(cloud, (p) => { if (!p.done) console.info(`[matcha][cloud] ${p.table} ${p.rows}`) })
            console.info('[matcha][cloud] auto-pull xong', res.rows, 'dòng')
            if (firstRun) saveCloud({ ...loadCloud(), autoSync: true })
            ensureRoles() // cloud có thể trống bảng roles → tạo lại vai trò mặc định
            refreshRbac()
            clearCloudError()
            if (res.rows > 0) window.dispatchEvent(new CustomEvent('matcha:db-refresh'))
          } catch (e) {
            const msg = (e as Error).message
            console.warn('[matcha][cloud] auto-pull lỗi:', msg)
            // Hiện banner cảnh báo (thường là: cloud bật RLS mà chưa nhập Mã đồng bộ).
            // Lưu lại rồi phát sự kiện: watcher có thể chưa kịp mount khi lỗi xảy ra lúc khởi động.
            setCloudError(msg)
            window.dispatchEvent(new CustomEvent('matcha:cloud-error', { detail: msg }))
          }
        } else {
          console.info('[matcha][cloud] chưa cấu hình auto-sync', { autoSync: cloud.autoSync, url: !!cloud.url, key: !!cloud.key })
        }
      })
      .catch((e) => { if (mounted) setError(String(e)) })
    return () => { mounted = false }
  }, [])

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cream-100 p-6 text-center">
        <p className="text-lg font-semibold text-ink-900">Không khởi tạo được cơ sở dữ liệu</p>
        <p className="max-w-md text-sm text-ink-500">{error}</p>
        <p className="max-w-md text-xs text-ink-400">
          Trình duyệt cần hỗ trợ WebAssembly + IndexedDB. Hãy thử Chrome/Edge/Safari bản mới, hoặc tắt chế độ ẩn danh nghiêm ngặt.
        </p>
      </div>
    )
  }
  if (!ready) return <BootScreen progress={progress} />

  return (
    <HashRouter>
      <AppRoutes />
      <Toaster />
      <CloudSyncWatcher />
    </HashRouter>
  )
}
