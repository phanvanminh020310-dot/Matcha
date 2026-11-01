import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useApp } from '../store/app'
import { getUserByEmail } from '../lib/api'
import type { Role } from '../lib/rbac'
import { Button, Field, Input } from '../components/ui'
import { hashPassword, isLocked, verifyPassword } from '../lib/passwords'
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASS, ensureDefaultAdmin, lastAdminRepair, markDefaultPassword } from '../lib/defaultAdmin'
import { runDoctor, type DoctorCheck } from '../lib/doctor'
import { resetDatabase, run } from '../lib/db'
import { ROLE_LABEL } from '../lib/format'

const LAST_EMAIL = 'matcha.login.email'

/** Đăng nhập — LUÔN là form đăng nhập, không có màn "thiết lập lần đầu".
 *  Tài khoản admin/admin@123 là mặc định của hệ thống: nếu máy này chưa có
 *  (máy mới, DB trống, hoặc tài khoản bị khoá) thì tự tạo/khôi phục rồi cho vào. */
export function LoginPage() {
  const navigate = useNavigate()
  const login = useApp((s) => s.login)
  const toast = useApp((s) => s.toast)

  const [email, setEmail] = useState(() => localStorage.getItem(LAST_EMAIL) || DEFAULT_ADMIN_EMAIL)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [diag, setDiag] = useState<DoctorCheck[] | null>(null)
  const [fixing, setFixing] = useState(false)

  /** Nút sửa nhanh: tạo lại tài khoản admin; nếu vẫn lỗi thì khởi tạo lại CSDL trên máy này. */
  const quickFix = async (nuclear = false) => {
    setFixing(true)
    try {
      if (nuclear) {
        await resetDatabase()
      }
      const r = await ensureDefaultAdmin()
      if (r.ok) {
        localStorage.setItem(LAST_EMAIL, DEFAULT_ADMIN_EMAIL)
        window.location.reload()
        return
      }
      setError(`Vẫn chưa sửa được: ${r.error ?? 'không rõ lỗi'}`)
      setDiag(await runDoctor().catch(() => null))
    } catch (e) {
      setError((e as Error).message)
      setDiag(await runDoctor().catch(() => null))
    } finally {
      setFixing(false)
    }
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const mail = email.trim().toLowerCase()
      const isDefaultPair = mail === DEFAULT_ADMIN_EMAIL && password === DEFAULT_ADMIN_PASS

      let u = getUserByEmail(mail)

      // Tài khoản mặc định của hệ thống: nếu máy này chưa có / bị khoá / mất mật khẩu
      // thì tự tạo–khôi phục TRƯỚC khi kiểm tra mật khẩu (để lỗi báo đúng bản chất).
      if ((isDefaultPair || mail === DEFAULT_ADMIN_EMAIL) && (!u || !u.is_active || isLocked(u.password))) {
        const repair = await ensureDefaultAdmin()
        u = getUserByEmail(mail)
        if (!u && !repair.ok) {
          setError(`Máy này chưa có tài khoản quản trị và không tạo được: ${repair.error ?? 'không rõ lỗi'}`)
          setDiag(await runDoctor().catch(() => null))
          return
        }
      }

      if (!u) {
        setError('Không tìm thấy tài khoản với email này.')
        setDiag(await runDoctor().catch(() => null))
        return
      }
      if (!u.is_active) { setError('Tài khoản đã bị vô hiệu hoá — liên hệ chủ chuỗi.'); return }
      if (isLocked(u.password)) { setError('Tài khoản này chưa đặt mật khẩu — liên hệ chủ chuỗi để cấp lại.'); return }

      const v = await verifyPassword(password, u.password)
      if (!v.ok) {
        setError(mail === DEFAULT_ADMIN_EMAIL
          ? 'Mật khẩu không đúng. Máy mới dùng mật khẩu mặc định: admin@123'
          : 'Mật khẩu không đúng.')
        return
      }

      // Dữ liệu cũ lưu mật khẩu chữ thường → nâng cấp thành hash ngay lần đăng nhập đầu tiên
      if (v.legacy) {
        try { run('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(password), u.id]) } catch { /* chỉ xem */ }
      }

      localStorage.setItem(LAST_EMAIL, u.email)
      markDefaultPassword(password === DEFAULT_ADMIN_PASS)
      login(u)
      toast({ title: `Xin chào ${u.name}!`, description: `Vai trò ${ROLE_LABEL[u.role as Role]}`, tone: 'success' })
      navigate('/pos')
    } catch (err) {
      setError((err as Error).message || 'Không đăng nhập được — thử lại.')
      setDiag(await runDoctor().catch(() => null))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
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
            <h1 className="text-[20px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">Đăng nhập</h1>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500 dark:text-ink-400">Nhập tài khoản do chủ chuỗi cấp.</p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <Field label="Tài khoản" required>
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
              {error && <p className="rounded-xl bg-rose-50 p-2.5 text-[11.5px] leading-relaxed text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">{error}</p>}
              <Button type="submit" variant="primary" size="lg" block disabled={busy} icon={busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}>
                {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
              </Button>
            </form>
          </div>

          {diag && (
            <div className="mt-3 rounded-2xl border border-ink-200 bg-white/80 p-3 text-left dark:border-ink-800 dark:bg-ink-900/70">
              <p className="mb-2 text-[11.5px] font-semibold text-ink-700 dark:text-ink-200">Chẩn đoán máy này</p>
              <ul className="space-y-1.5">
                {diag.map((c) => (
                  <li key={c.label} className="text-[11px] leading-snug">
                    <span className={c.ok ? 'text-matcha-700' : 'text-rose-600'}>{c.ok ? '✔' : '✖'}</span>{' '}
                    <b className="text-ink-700 dark:text-ink-200">{c.label}:</b>{' '}
                    <span className="text-ink-500 dark:text-ink-400">{c.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" disabled={fixing} onClick={() => void quickFix(false)}
                  className="rounded-lg bg-matcha-600 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">
                  {fixing ? 'Đang sửa…' : 'Sửa tài khoản trên máy này'}
                </button>
                <button type="button" disabled={fixing} onClick={() => { if (confirm('Khởi tạo lại dữ liệu trên MÁY NÀY? Dữ liệu trên Turso/máy chủ vẫn giữ nguyên và sẽ được tải lại.')) void quickFix(true) }}
                  className="rounded-lg border border-ink-300 px-2.5 py-1.5 text-[11px] font-medium text-ink-600 disabled:opacity-50 dark:border-ink-700 dark:text-ink-300">
                  Khởi tạo lại dữ liệu máy này
                </button>
              </div>
              <p className="mt-2 text-[10.5px] text-ink-400">
                Kết quả sửa gần nhất: {lastAdminRepair()?.ok ? 'đã sửa được' : (lastAdminRepair()?.error ?? 'chưa chạy')}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            <p className="w-full rounded-xl border border-matcha-200 bg-matcha-50 px-3 py-2 text-[11.5px] leading-relaxed text-matcha-900 dark:border-matcha-800 dark:bg-matcha-900/20 dark:text-matcha-100">
              <KeyRound size={12} className="mr-1 inline" />
              Lần đầu vào: tài khoản <b>admin</b> · mật khẩu <b>admin@123</b>
              <span className="block text-[11px] text-matcha-700 dark:text-matcha-300">
                Vào xong hãy đổi mật khẩu ở <b>Cài đặt → Đổi mật khẩu</b>, rồi tạo tài khoản nhân viên trong <b>Nhân sự</b>.
              </span>
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <ShieldCheck size={12} className="text-matcha-600" /> Quên mật khẩu? Chủ chuỗi cấp lại trong Nhân sự.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
