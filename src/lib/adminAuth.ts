/**
 * Xác thực QUẢN TRỊ CSDL — nhiều lớp:
 *  1. Mật khẩu lưu bcrypt **trong Postgres** (bảng admin_accounts), không có trong mã nguồn app.
 *  2. Đăng nhập qua RPC `admin_login` → trả phiên 60 phút (lưu sessionStorage: đóng tab là mất).
 *  3. Sai 5 lần → Postgres khoá 15 phút (chống dò mật khẩu), có delay chống timing.
 *  4. Mọi lần mở khoá / đổi mật khẩu đều ghi audit log.
 */
import { loadCloud, normCloudUrl } from './cloud'
import { run } from './db'

const SKEY = 'matcha.admin.session'

interface Session {
  token: string
  username: string
  until: number
}

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SKEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s?.token || s.until < Date.now()) return null
    return s
  } catch { return null }
}

export function adminUnlocked(): boolean {
  return !!readSession()
}

export function adminUsername(): string | null {
  return readSession()?.username ?? null
}

export function lockAdmin() {
  try { sessionStorage.removeItem(SKEY) } catch { /* bỏ qua */ }
}

function headers(cfg: { key: string }) {
  const key = cfg.key.trim()
  return {
    apikey: key,
    ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    'Content-Type': 'application/json',
  } as Record<string, string>
}

async function rpc<T>(fn: string, body: unknown, override?: { url: string; key: string }): Promise<{ ok: boolean; data?: T; message?: string }> {
  const cfg = override ?? loadCloud()
  const url = normCloudUrl(cfg.url)
  if (!url || !cfg.key) return { ok: false, message: 'Máy này chưa có cấu hình cloud — nhập địa chỉ Supabase + anon key ở trên để mở khoá lần đầu.' }
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: headers(cfg), body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    })
    if (res.status === 404) return { ok: false, message: 'Cloud chưa cài phần xác thực quản trị (chạy docs/sql/admin-auth.sql).' }
    if (!res.ok) return { ok: false, message: `Lỗi máy chủ (HTTP ${res.status})` }
    return { ok: true, data: (await res.json()) as T }
  } catch (e) {
    return { ok: false, message: `Không kết nối được: ${(e as Error).message}` }
  }
}

function audit(action: string, ok: boolean) {
  try {
    run(
      `INSERT INTO audit_logs (action, entity, entity_id, detail, created_at) VALUES (?,?,?,?, datetime('now','localtime'))`,
      [ok ? action : `${action}_failed`, 'admin_accounts', 0, ok ? 'Mở khoá quản trị CSDL' : 'Đăng nhập quản trị thất bại'],
    )
  } catch { /* chế độ chỉ xem hoặc CSDL chưa sẵn sàng */ }
}

/** Đăng nhập quản trị: xác thực ở Postgres, lưu phiên 60 phút trong sessionStorage. */
export async function adminLogin(username: string, password: string, conn?: { url: string; key: string }): Promise<{ ok: boolean; message?: string }> {
  if (!username.trim() || !password) return { ok: false, message: 'Nhập tài khoản và mật khẩu quản trị.' }
  const r = await rpc<string | null>('admin_login', { p_user: username, p_pass: password }, conn)
  if (!r.ok) return { ok: false, message: r.message }
  const token = typeof r.data === 'string' ? r.data : ''
  if (!token) {
    audit('admin_login', false)
    return { ok: false, message: 'Sai tài khoản hoặc mật khẩu (hoặc tài khoản đang bị khoá 15 phút sau 5 lần sai).' }
  }
  const session: Session = { token, username: username.trim().toLowerCase(), until: Date.now() + 55 * 60 * 1000 }
  try { sessionStorage.setItem(SKEY, JSON.stringify(session)) } catch { /* bỏ qua */ }
  audit('admin_login', true)
  return { ok: true }
}

/** Đổi mật khẩu quản trị (cần phiên hợp lệ + mật khẩu cũ). */
export async function adminChangePassword(oldPass: string, newPass: string): Promise<{ ok: boolean; message?: string }> {
  const s = readSession()
  if (!s) return { ok: false, message: 'Phiên quản trị đã hết hạn — đăng nhập lại.' }
  if (newPass.length < 10) return { ok: false, message: 'Mật khẩu mới phải từ 10 ký tự.' }
  const r = await rpc<boolean>('admin_change_password', { p_token: s.token, p_old: oldPass, p_new: newPass })
  if (!r.ok) return { ok: false, message: r.message }
  if (r.data !== true) return { ok: false, message: 'Mật khẩu cũ không đúng.' }
  lockAdmin()
  audit('admin_password_changed', true)
  return { ok: true }
}

/** Đăng xuất quản trị (huỷ phiên trên máy + Postgres). */
export async function adminLogout() {
  const s = readSession()
  lockAdmin()
  if (s) await rpc<void>('admin_logout', { p_token: s.token })
}
