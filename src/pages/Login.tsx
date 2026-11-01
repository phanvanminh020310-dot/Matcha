import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, KeyRound, Loader2, Lock, Mail, ShieldCheck, Sparkles, Store, Zap } from 'lucide-react'
import { useApp } from '../store/app'
import { getUserByEmail, getUsers } from '../lib/api'
import { useSql } from '../hooks/useDb'
import {type Role} from '../lib/rbac'
import { Button, Field, Input } from '../components/ui'
import { AdminGate } from '../components/AdminGate'
import { adminUnlocked } from '../lib/adminAuth'
import { cx, ROLE_LABEL } from '../lib/format'

const FEATURES = [
  'POS bán hàng chuyên sâu: size, mức đường/đá, topping, nhiều phương thức thanh toán',
  'KDS realtime + màn hình gọi số cho khách, đồng bộ tức thì giữa các màn hình',
  'Back-office ERP: công thức BOM trừ kho tự động, mua hàng, CRM, tài chính, báo cáo',
  'Data Explorer: ERD tương tác, SQL console chỉ đọc, xem cấu trúc 28 bảng',
]

export function LoginPage() {
  const navigate = useNavigate()
  const login = useApp((s) => s.login)
  const toast = useApp((s) => s.toast)
  const users = useSql(() => getUsers(), [])
  const [email, setEmail] = useState('owner@matcha.vn')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [gateOpen, setGateOpen] = useState(false)
  const [unlocked, setUnlocked] = useState(() => adminUnlocked())

  const demoUsers = useMemo(() => {
    const wanted: Role[] = ['owner', 'manager', 'cashier', 'barista', 'accountant']
    return wanted.map((r) => users.find((u) => u.role === r)).filter(Boolean) as typeof users
  }, [users])

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    const u = getUserByEmail(email.trim())
    if (!u) return setError('Không tìm thấy tài khoản với email này')
    if (u.password !== password) return setError('Mật khẩu không đúng (demo: 123456)')
    login(u)
    toast({ title: `Xin chào ${u.name}!`, description: `Bạn đăng nhập với vai trò ${ROLE_LABEL[u.role as Role]}`, tone: 'success' })
    navigate('/pos')
  }

  const quickLogin = (userEmail: string) => {
    setBusy(userEmail)
    const u = getUserByEmail(userEmail)
    if (!u) { setBusy(null); return }
    setTimeout(() => {
      login(u)
      navigate('/pos')
      setBusy(null)
    }, 180)
  }

  return (
    <>
    <AdminGate open={gateOpen} onClose={() => setGateOpen(false)} onUnlocked={() => setUnlocked(true)} />
    <div className="grid min-h-dvh bg-cream-100 lg:grid-cols-[1.05fr_1fr] dark:bg-ink-950">
      {/* -------- brand panel -------- */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-matcha-800 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-95">
          <div className="absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-matcha-600/60 blur-3xl" />
          <div className="absolute bottom-0 right-[-80px] h-[380px] w-[380px] rounded-full bg-caramel-500/30 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,.14),transparent_45%)]" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-xl backdrop-blur">🍵</div>
            <div>
              <p className="text-[15px] font-semibold">Matcha POS</p>
              <p className="text-[11.5px] text-white/60">Quản lý bán hàng chuỗi trà sữa &amp; cà phê</p>
            </div>
          </div>

          <h1 className="mt-14 max-w-lg text-[38px] font-semibold leading-[1.1] tracking-tight">
            Bán một ly trà sữa,
            <br />
            <span className="text-matcha-200">cả hệ thống tự động cập nhật.</span>
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/70">
            Từ quầy POS tới bếp, kho nguyên liệu, khách hàng thân thiết và báo cáo lãi lỗ — tất cả trên một
            cơ sở dữ liệu quan hệ chạy ngay trong trình duyệt.
          </p>

          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5 text-[13px] leading-relaxed text-white/80">
                <Check size={16} className="mt-0.5 shrink-0 text-matcha-300" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Zap size={18} /></div>
          <div className="text-[12.5px] leading-snug text-white/80">
            <p className="font-semibold text-white">Không cần cài đặt, không cần đăng ký</p>
            3 chi nhánh · 47 món · 4.000+ đơn mẫu · dữ liệu tự nạp trong ~3 giây
          </div>
        </div>
      </div>

      {/* -------- form panel -------- */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-7 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-matcha-600 text-lg text-white">🍵</div>
              <div>
                <p className="text-[15px] font-semibold text-ink-900 dark:text-ink-50">Matcha POS</p>
                <p className="text-[11px] text-ink-400">Chuỗi trà sữa &amp; cà phê</p>
              </div>
            </div>
          </div>

          <h2 className="text-[26px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">Đăng nhập hệ thống</h2>
          <p className="mt-1 text-[13.5px] text-ink-500 dark:text-ink-400">
            Dùng tài khoản demo bên dưới — bấm một lần là vào ngay.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3.5">
            <Field label="Email" required>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="ten@matcha.vn" />
              </div>
            </Field>
            <Field label="Mật khẩu" required error={error}>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input className="pl-9" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
            </Field>
            <Button type="submit" variant="primary" size="lg" block icon={<ArrowRight size={17} />}>Đăng nhập</Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Đăng nhập nhanh</span>
            <div className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
          </div>

          <div className="space-y-2">
            {demoUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => quickLogin(u.email)}
                disabled={!!busy}
                className={cx(
                  'group flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-white px-3.5 py-3 text-left transition-all',
                  'hover:border-matcha-400 hover:shadow-soft disabled:opacity-60 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-matcha-600',
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-200 text-base dark:bg-ink-800">{u.avatar_emoji ?? '🧑'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-ink-900 dark:text-ink-50">{u.name}</span>
                    <span className="rounded-full bg-matcha-50 px-2 py-0.5 text-[10.5px] font-medium text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300">
                      {ROLE_LABEL[u.role as Role]}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-400">
                    <KeyRound size={11} /> {u.email} · 123456
                    <span className="hidden items-center gap-1 sm:flex"><Store size={11} /> CN {u.branch_id}</span>
                  </span>
                </span>
                {busy === u.email ? <Loader2 size={16} className="animate-spin text-matcha-600" /> : <ArrowRight size={16} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-matcha-600" />}
              </button>
            ))}
          </div>

          <p className="mt-6 flex items-start gap-2 rounded-xl bg-ink-100/70 p-3 text-[11.5px] leading-relaxed text-ink-500 dark:bg-ink-900 dark:text-ink-400">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-matcha-600" />
            Đây là bản demo: mật khẩu lưu dạng plaintext và toàn bộ dữ liệu nằm trong IndexedDB của trình duyệt bạn.
            <span className="mt-2 block">
              Thông tin kết nối cơ sở dữ liệu chỉ mở được bằng <b>tài khoản quản trị riêng</b>:{' '}
              <button className="font-semibold text-matcha-700 underline dark:text-matcha-300" onClick={() => setGateOpen(true)}>
                {unlocked ? '✅ đã mở khoá — vào Cài đặt → Cơ sở dữ liệu' : 'mở khoá quản trị CSDL'}
              </button>
            </span>
            Không nhập dữ liệu thật.
          </p>
        </div>
      </div>
    </div>
    </>
  )
}
