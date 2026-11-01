/**
 * Xác thực QUẢN TRỊ CSDL trên Turso (không cần Supabase).
 *
 * Nhiều lớp như bản Postgres:
 *  1. Mật khẩu lưu **bcrypt** trong bảng `admin_accounts` trên Turso — mã nguồn app không có mật khẩu.
 *  2. Sai 5 lần → khoá 15 phút (đếm và khoá ghi thẳng vào database).
 *  3. Phiên 55 phút lưu trong sessionStorage (đóng tab là mất).
 *  4. Chỉ máy giữ **token GHI** mới mở được cấu hình CSDL.
 *
 * Vì Turso không chạy được hàm phía máy chủ như Postgres, việc so khớp bcrypt làm ngay
 * trên máy bằng bcryptjs (thuần JS, không cần WASM).
 */
import bcrypt from 'bcryptjs'
import { tursoClient, loadTurso, tursoWriteMode } from './turso'
import { run } from './db'

const SKEY = 'matcha.admin.session'
const MAX_FAILS = 5
const LOCK_MINUTES = 15

interface Session { token: string; username: string; until: number }

const now = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const randToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(24))
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function audit(action: string, detail: string) {
  try {
    run(
      `INSERT INTO audit_logs (action, entity, entity_id, detail, created_at) VALUES (?,?,?,?, datetime('now','localtime'))`,
      [action, 'admin_accounts', 0, detail],
    )
  } catch { /* chế độ chỉ xem hoặc CSDL chưa sẵn sàng */ }
}

function writeSession(s: Session) {
  try { sessionStorage.setItem(SKEY, JSON.stringify(s)) } catch { /* bỏ qua */ }
}

/** Đã cấu hình Turso và máy này giữ token ghi chưa (điều kiện dùng xác thực Turso). */
export function adminTursoAvailable(): boolean {
  const cfg = loadTurso()
  return cfg.enabled && !!cfg.url && tursoWriteMode(cfg) === 'full'
}

const asTime = (v: string) => new Date(String(v).replace(' ', 'T'))

/** Đăng nhập quản trị bằng tài khoản lưu trên Turso. */
export async function adminLoginTurso(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
  const cfg = loadTurso()
  if (!cfg.enabled || !cfg.url) return { ok: false, message: 'Chưa bật Turso trên máy này.' }
  if (tursoWriteMode(cfg) !== 'full') {
    return {
      ok: false,
      message: 'Máy này chỉ có token ĐỌC/ĐẶT HÀNG nên không mở được cấu hình CSDL. Mở trên máy của chủ chuỗi (máy giữ token GHI).',
    }
  }
  const user = username.trim().toLowerCase()
  if (!user || !password) return { ok: false, message: 'Nhập tài khoản và mật khẩu quản trị.' }

  const db = tursoClient(cfg)
  let row
  try {
    const r = await db.all(
      'SELECT username, pass_hash, is_active, failed_count, locked_until FROM admin_accounts WHERE lower(username) = ? LIMIT 1',
      [user],
    )
    row = r.rows[0]
  } catch (e) {
    return { ok: false, message: `Không đọc được bảng admin_accounts trên Turso: ${(e as Error).message}` }
  }

  const denied = { ok: false, message: 'Sai tài khoản hoặc mật khẩu.' }
  if (!row) { await new Promise((r) => setTimeout(r, 400)); return denied }

  const [uname, hash, active, fails, lockedUntil] = row
  if (Number(active) !== 1) return { ok: false, message: 'Tài khoản quản trị đang bị vô hiệu hoá.' }
  if (lockedUntil && asTime(String(lockedUntil)) > new Date()) {
    return { ok: false, message: `Đang tạm khoá do sai quá ${MAX_FAILS} lần — thử lại sau ${LOCK_MINUTES} phút (tới ${String(lockedUntil)}).` }
  }

  let ok = false
  try { ok = await bcrypt.compare(password, String(hash)) } catch { ok = false }

  if (!ok) {
    const count = Number(fails ?? 0) + 1
    const lock = count >= MAX_FAILS ? now() : null
    const lockAt = lock
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      : null
    const lockStr = lockAt
      ? `${lockAt.getFullYear()}-${String(lockAt.getMonth() + 1).padStart(2, '0')}-${String(lockAt.getDate()).padStart(2, '0')} ${String(lockAt.getHours()).padStart(2, '0')}:${String(lockAt.getMinutes()).padStart(2, '0')}:${String(lockAt.getSeconds()).padStart(2, '0')}`
      : null
    try {
      await db.run([
        {
          sql: 'UPDATE admin_accounts SET failed_count = ?, locked_until = ? WHERE lower(username) = ?',
          args: [lock ? 0 : count, lockStr, user],
        },
      ])
    } catch { /* không ghi được bộ đếm → vẫn từ chối */ }
    audit('admin_login_failed', `Sai mật khẩu quản trị (lần ${count})`)
    await new Promise((r) => setTimeout(r, 400))
    return lock
      ? { ok: false, message: `Sai ${MAX_FAILS} lần — tài khoản bị khoá ${LOCK_MINUTES} phút.` }
      : denied
  }

  try {
    await db.run([{ sql: 'UPDATE admin_accounts SET failed_count = 0, locked_until = NULL, last_login = ? WHERE lower(username) = ?', args: [now(), user] }])
  } catch { /* bỏ qua */ }

  writeSession({ token: randToken(), username: String(uname).toLowerCase(), until: Date.now() + 55 * 60 * 1000 })
  audit('admin_login', 'Mở khoá quản trị CSDL (Turso)')
  return { ok: true }
}

/** Đổi mật khẩu quản trị trên Turso (cần phiên hợp lệ + mật khẩu cũ). */
export async function adminChangePasswordTurso(oldPass: string, newPass: string): Promise<{ ok: boolean; message?: string }> {
  const s = (() => { try { return JSON.parse(sessionStorage.getItem(SKEY) ?? 'null') as Session | null } catch { return null } })()
  if (!s || s.until < Date.now()) return { ok: false, message: 'Phiên quản trị đã hết hạn — đăng nhập lại.' }
  if (newPass.length < 10) return { ok: false, message: 'Mật khẩu mới phải từ 10 ký tự.' }

  const cfg = loadTurso()
  const db = tursoClient(cfg)
  const r = await db.all('SELECT pass_hash FROM admin_accounts WHERE lower(username) = ? LIMIT 1', [s.username])
  const hash = r.rows[0]?.[0]
  if (!hash) return { ok: false, message: 'Không tìm thấy tài khoản quản trị.' }
  const ok = await bcrypt.compare(oldPass, String(hash))
  if (!ok) return { ok: false, message: 'Mật khẩu cũ không đúng.' }
  const next = await bcrypt.hash(newPass, 12)
  await db.run([{ sql: 'UPDATE admin_accounts SET pass_hash = ? WHERE lower(username) = ?', args: [next, s.username] }])
  try { sessionStorage.removeItem(SKEY) } catch { /* bỏ qua */ }
  audit('admin_password_changed', 'Đổi mật khẩu quản trị (Turso)')
  return { ok: true }
}

/** Mật khẩu quản trị đã được đặt trên Turso chưa (dùng để gợi ý ở màn mở khoá). */
export async function adminTursoHasAccount(): Promise<boolean> {
  try {
    const r = await tursoClient(loadTurso()).scalar('SELECT count(*) FROM admin_accounts WHERE is_active = 1')
    return Number(r ?? 0) > 0
  } catch { return false }
}
