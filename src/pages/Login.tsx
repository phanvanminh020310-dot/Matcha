import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, Loader2, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useApp } from '../store/app'
import { getUserByEmail, getUsers } from '../lib/api'
import { useSql } from '../hooks/useDb'
import type { Role } from '../lib/rbac'
import { Button, Field, Input } from '../components/ui'
import { AdminGate } from '../components/AdminGate'
import { adminUnlocked } from '../lib/adminAuth'
import { hashPassword, isLocked, passwordProblem, verifyPassword } from '../lib/passwords'
import { run } from '../lib/db'
import { ROLE_LABEL } from '../lib/format'

const LAST_EMAIL = 'matcha.login.email'
const LAST_NAME = 'matcha.login.name'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useApp((s) => s.login)
  const toast = useApp((s) => s.toast)
  const users = useSql(() => getUsers(), [])

  // Chưa có tài khoản nào đăng nhập được (máy mới, hoặc dữ liệu mẫu bị khoá) → thiết lập quản trị đầu tiên
  const hasLoginAccount = users.some((u) => u.is_active && !isLocked(u.password))
  const setupMode = users.length === 0 || !hasLoginAccount

  const [email, setEmail] = useState(() => localStorage.getItem(LAST_EMAIL) ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)
  const [unlocked, setUnlocked] = useState(() => adminUnlocked())

  // ----- thiết lập lần đầu -----
  const [name, setName] = useState(() => localStorage.getItem(LAST_NAME) ?? '')
  const [pw2, setPw2] = useState('')

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = getUserByEmail(email.trim())
      if (!u) { setError('Không tìm thấy tài khoản với email này.'); return }
      if (!u.is_active) { setError('Tài khoản đã bị vô hiệu hoá — liên hệ chủ chuỗi.'); return }
      if (isLocked(u.password)) { setError('Tài khoản này chưa đặt mật khẩu — liên hệ chủ chuỗi để cấp lại.'); return }
      const v = await verifyPassword(password, u.password)
      if (!v.ok) { setError('Mật khẩu không đúng.'); return }
      // Dữ liệu cũ lưu mật khẩu chữ thường → nâng cấp thành hash ngay lần đăng nhập đầu tiên
      if (v.legacy) {
        try { run('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(password), u.id]) } catch { /* chỉ xem */ }
      }
      localStorage.setItem(LAST_EMAIL, u.email)
      login(u)
      toast({ title: `Xin chào ${u.name}!`, description: `Vai trò ${ROLE_LABEL[u.role as Role]}`, tone: 'success' })
      navigate('/pos')
    } finally {
      setBusy(false)
    }
  }

  const createFirstAdmin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    const problem = passwordProblem(password)
    if (!name.trim()) return setError('Nhập tên người quản trị.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Email chưa đúng định dạng.')
    if (problem) return setError(problem)
    if (password !== pw2) return setError('Hai lần nhập mật khẩu không khớp.')
    setBusy(true)
    try {
      const hash = await hashPassword(password)
      const owner = users.find((u) => u.role === 'owner') ?? users[0]
      if (owner) {
        // Giữ nguyên bản ghi (không phá liên kết dữ liệu cũ), chỉ đặt lại email/mật khẩu
        run('UPDATE users SET email = ?, name = ?, password = ?, is_active = 1 WHERE id = ?', [email.trim().toLowerCase(), name.trim(), hash, owner.id])
      } else {
        run('INSERT INTO users (name, email, phone, password, role, branch_id, salary, is_active, hired_at, avatar_emoji) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [name.trim(), email.trim().toLowerCase(), '', hash, 'owner', 1, 0, 1, new Date().toISOString().slice(0, 10), '👑'])
      }
      const created = getUserByEmail(email.trim().toLowerCase())
      if (!created) return setError('Không tạo được tài khoản — thử lại.')
      localStorage.setItem(LAST_EMAIL, created.email)
      login(created)
      toast({ title: 'Đã tạo tài khoản quản trị đầu tiên', description: 'Vào Nhân sự để tạo thêm tài khoản theo vai trò.', tone: 'success' })
      navigate('/pos')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AdminGate open={gateOpen} onClose={() => setGateOpen(false)} onUnlocked={() => setUnlocked(true)} />

      <div className="relative flex min-h-dvh items-center justify-center bg-cream-100 px-4 py-10 dark:bg-ink-950">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-24 h-[380px] w-[380px] rounded-full bg-matcha-200/40 blur-3xl dark:bg-matcha-900/20" />
          <div className="absolute -bottom-32 -right-24 h-[380px] w-[380px] rounded-full bg-caramel-200/30 blur-3xl dark:bg-caramel-900/10" />
        </div>

        <div className="relative w-full max-w-[400px]">
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-matcha-600 text-lg text-white shadow-soft">🍵</div>
            <div>
              <p className="text-[15px] font-semibold leading-tight text-ink-900 dark:text-ink-50">Matcha POS</p>
              <p className="text-[11px] text-ink-400">Quản lý chuỗi trà sữa &amp; cà phê</p>
            </div>
          </div>

          <div className="rounded-3xl border border-ink-200/80 bg-white p-6 shadow-soft dark:border-ink-800 dark:bg-ink-900">
            <h1 className="text-[20px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">
              {setupMode ? 'Thiết lập quản trị lần đầu' : 'Đăng nhập'}
            </h1>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500 dark:text-ink-400">
              {setupMode
                ? 'Tạo tài khoản quản trị (toàn quyền). Sau khi vào app, mở Nhân sự để tạo tài khoản cho từng vai trò.'
                : 'Nhập tài khoản do chủ chuỗi cấp.'}
            </p>

            {setupMode ? (
              <form onSubmit={createFirstAdmin} className="mt-5 space-y-3">
                <Field label="Tên người quản trị" required>
                  <div className="relative">
                    <UserRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <Input className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Minh Anh" autoComplete="name" />
                  </div>
                </Field>
                <Field label="Email đăng nhập" required>
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <Input className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@matcha.vn" autoComplete="username" inputMode="email" />
                  </div>
                </Field>
                <Field label="Mật khẩu" required hint="Tối thiểu 8 ký tự, có chữ và số">
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <Input className="pl-9" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  </div>
                </Field>
                <Field label="Nhập lại mật khẩu" required>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <Input className="pl-9" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
                  </div>
                </Field>
                {error && <p className="rounded-xl bg-rose-50 p-2.5 text-[11.5px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">{error}</p>}
                <Button type="submit" variant="primary" size="lg" block disabled={busy} icon={busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}>
                  {busy ? 'Đang tạo…' : 'Tạo tài khoản quản trị'}
                </Button>
              </form>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-3">
                <Field label="Email" required>
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <Input className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="ten@matcha.vn" inputMode="email" autoFocus />
                  </div>
                </Field>
                <Field label="Mật khẩu" required>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <Input className="pl-9" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  </div>
                </Field>
                {error && <p className="rounded-xl bg-rose-50 p-2.5 text-[11.5px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">{error}</p>}
                <Button type="submit" variant="primary" size="lg" block disabled={busy} icon={busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}>
                  {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
                </Button>
              </form>
            )}
          </div>

          <div className="mt-4 flex flex-col items-center gap-1.5 text-center">
            <button className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500 transition-colors hover:text-matcha-700 dark:text-ink-400 dark:hover:text-matcha-300" onClick={() => setGateOpen(true)}>
              <KeyRound size={13} /> {unlocked ? 'Quản trị CSDL: đã mở khoá' : 'Quản trị cơ sở dữ liệu'}
            </button>
            <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <ShieldCheck size={12} className="text-matcha-600" /> Quên mật khẩu? Chủ chuỗi cấp lại trong Nhân sự.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
