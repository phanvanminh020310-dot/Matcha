/**
 * Tài khoản quản trị mặc định của máy: `admin` / `admin@123` (vai trò chủ chuỗi — toàn quyền).
 *
 * Vì sao có: lần đầu mở app (hoặc mở link chia sẻ) phải đăng nhập được NGAY, không phải
 * qua màn "thiết lập quản trị lần đầu". Sau khi vào, chủ chuỗi đổi mật khẩu và tự tạo
 * tài khoản cho nhân viên trong mục Nhân sự.
 *
 * An toàn:
 *  • Mật khẩu lưu dạng PBKDF2-SHA256 120.000 vòng (không lưu chữ thường).
 *  • App hiện cảnh báo đỏ chừng nào mật khẩu còn là mặc định.
 *  • Máy dùng link chỉ-xem vẫn KHÔNG sửa được dữ liệu (Turso chặn ở tầng máy chủ).
 */
import { one, run, scalar } from './db'
import { hashPassword, isLocked } from './passwords'
import { withSystemWrite } from './db'

export const DEFAULT_ADMIN_EMAIL = 'admin'
export const DEFAULT_ADMIN_PASS = 'admin@123'

const FLAG = 'matcha.default-password'

/** Đang dùng mật khẩu mặc định (để hiện cảnh báo). */
export function usingDefaultPassword(): boolean {
  return localStorage.getItem(FLAG) === '1'
}

export function markDefaultPassword(v: boolean) {
  try {
    if (v) localStorage.setItem(FLAG, '1')
    else localStorage.removeItem(FLAG)
  } catch { /* bỏ qua */ }
}

/**
 * Bảo đảm máy luôn có tài khoản `admin` đăng nhập được.
 * Chạy sau khi nạp CSDL và sau mỗi lần kéo dữ liệu từ Turso.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  try {
    const hasUsers = scalar<number>(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'`)
    if (!hasUsers) return

    const row = one<{ id: number; password: string | null; is_active: number; role: string }>(
      'SELECT id, password, is_active, role FROM users WHERE lower(email) = ? LIMIT 1',
      [DEFAULT_ADMIN_EMAIL],
    )

    if (row) {
      // Tài khoản đã có nhưng bị khoá / chưa có mật khẩu → đặt lại mật khẩu mặc định
      if (isLocked(row.password) || !row.is_active) {
        const hash = await hashPassword(DEFAULT_ADMIN_PASS)
        withSystemWrite(() =>
          run('UPDATE users SET password = ?, is_active = 1, role = ? WHERE id = ?', [hash, row.role || 'owner', row.id]),
        )
        markDefaultPassword(true)
      }
      return
    }

    const hash = await hashPassword(DEFAULT_ADMIN_PASS)
    const branch = scalar<number>('SELECT id FROM branches ORDER BY id LIMIT 1') ?? 1
    withSystemWrite(() =>
      run(
        'INSERT INTO users (name, email, phone, password, role, branch_id, salary, is_active, hired_at, avatar_emoji) VALUES (?,?,?,?,?,?,?,?,?,?)',
        ['Quản trị viên', DEFAULT_ADMIN_EMAIL, '', hash, 'owner', branch, 0, 1, new Date().toISOString().slice(0, 10), '👑'],
      ),
    )
    markDefaultPassword(true)
    console.info('[matcha] đã tạo tài khoản quản trị mặc định admin / admin@123')
  } catch (e) {
    console.error('[matcha] ensureDefaultAdmin LỖI:', (e as Error).message)
  }
}
