/**
 * Tài khoản quản trị mặc định của máy: `admin` / `admin@123` (vai trò chủ chuỗi — toàn quyền).
 *
 * Vì sao có: lần đầu mở app (hoặc mở link chia sẻ) phải đăng nhập được NGAY, không phải
 * qua màn "thiết lập quản trị lần đầu". Sau khi vào, chủ chuỗi đổi mật khẩu và tự tạo
 * tài khoản cho nhân viên trong mục Nhân sự.
 *
 * An toàn:
 *  • Mật khẩu lưu dạng PBKDF2-SHA256 120.000 vòng (không lưu chữ thường).
 *  • App hiện cảnh báo vàng chừng nào mật khẩu còn là mặc định.
 *  • Máy dùng link chỉ-xem vẫn KHÔNG sửa được dữ liệu nghiệp vụ (Turso chặn ở tầng máy chủ).
 *
 * BỀN VỚI DỮ LIỆU CŨ: máy đã dùng từ bản trước có thể thiếu cột, thiếu bảng hoặc còn tài
 * khoản với vai trò cũ. Vì vậy hàm tự: bổ sung cột thiếu → tìm tài khoản admin → nếu
 * không có thì DÙNG LẠI một bản ghi users sẵn có (đổi email/mật khẩu, không phá dữ liệu
 * liên kết) → cuối cùng mới chèn mới. Mọi lỗi được trả về (không nuốt im lặng).
 */
import { all, migrate, one, run, scalar, withSystemWrite } from './db'
import { hashPassword, isLocked } from './passwords'

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

export interface RepairResult {
  ok: boolean
  /** 'already' | 'restored' | 'reused' | 'created' */
  how?: 'already' | 'restored' | 'reused' | 'created'
  error?: string
}

/** Kết quả lần chạy gần nhất — dùng cho bảng chẩn đoán ở trang đăng nhập. */
let lastResult: RepairResult | null = null
export function lastAdminRepair(): RepairResult | null { return lastResult }

const ROLE_CANDIDATES = ['owner', 'manager', 'cashier', 'barista', 'accountant']

/** Bổ sung cột thiếu cho bảng users (máy nâng cấp từ bản rất cũ). */
function ensureUserColumns(): void {
  const cols = new Set(all<{ name: string }>('PRAGMA table_info(users)').map((c) => c.name))
  if (cols.size === 0) return
  const wanted: [string, string][] = [
    ['name', 'TEXT'],
    ['email', 'TEXT'],
    ['phone', 'TEXT'],
    ['password', 'TEXT'],
    ['role', "TEXT DEFAULT 'cashier'"],
    ['branch_id', 'INTEGER'],
    ['salary', 'INTEGER DEFAULT 0'],
    ['is_active', 'INTEGER DEFAULT 1'],
    ['hired_at', 'TEXT'],
    ['avatar_emoji', 'TEXT'],
  ]
  for (const [col, type] of wanted) {
    if (cols.has(col)) continue
    try { run(`ALTER TABLE users ADD COLUMN ${col} ${type}`, [], { silent: true }) } catch { /* cột đã có */ }
  }
}

/** Đặt mật khẩu mặc định cho một bản ghi, thử lần lượt các vai trò hợp lệ nếu CHECK chặn. */
async function applyTo(id: number, email: string, name?: string): Promise<void> {
  const hash = await hashPassword(DEFAULT_ADMIN_PASS)
  let lastErr: unknown = null
  for (const role of ROLE_CANDIDATES) {
    try {
      withSystemWrite(() =>
        run(
          `UPDATE users SET email = ?, password = ?, is_active = 1, role = ?${name ? ', name = ?' : ''} WHERE id = ?`,
          name ? [email, hash, role, name, id] : [email, hash, role, id],
        ),
      )
      markDefaultPassword(true)
      return
    } catch (e) { lastErr = e }
  }
  throw lastErr ?? new Error('Không cập nhật được tài khoản quản trị')
}

/**
 * Bảo đảm máy luôn có tài khoản `admin` đăng nhập được.
 * Chạy sau khi nạp CSDL, sau mỗi lần kéo dữ liệu từ Turso, và ngay trước khi đăng nhập.
 */
export async function ensureDefaultAdmin(): Promise<RepairResult> {
  try {
    let hasTable = scalar<number>(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'`)
    if (!hasTable) {
      // CSDL trên máy bị thiếu bảng (dữ liệu lỗi/phiên bản rất cũ) → tạo lại các bảng còn thiếu
      try { withSystemWrite(() => migrate()) } catch (e) { console.warn('[matcha] migrate:', (e as Error).message) }
      hasTable = scalar<number>(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'`)
    }
    if (!hasTable) {
      lastResult = { ok: false, error: 'Máy này chưa có bảng người dùng (CSDL chưa khởi tạo xong).' }
      return lastResult
    }

    ensureUserColumns()

    const byEmail = one<{ id: number; password: string | null; is_active: number; role: string }>(
      'SELECT id, password, is_active, role FROM users WHERE lower(trim(email)) = ? LIMIT 1',
      [DEFAULT_ADMIN_EMAIL],
    )

    if (byEmail) {
      if (!isLocked(byEmail.password) && byEmail.is_active) {
        lastResult = { ok: true, how: 'already' }
        return lastResult
      }
      await applyTo(byEmail.id, DEFAULT_ADMIN_EMAIL)
      lastResult = { ok: true, how: 'restored' }
      return lastResult
    }

    // Không có tài khoản tên `admin`: ưu tiên DÙNG LẠI bản ghi sẵn có (giữ nguyên id/liên kết)
    const anyUser = one<{ id: number; name: string; role: string }>(
      `SELECT id, name, role FROM users
       WHERE is_active = 1 AND password IS NOT NULL AND password NOT IN ('', '!')
       ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, id LIMIT 1`,
    )
    if (anyUser) {
      await applyTo(anyUser.id, DEFAULT_ADMIN_EMAIL)
      lastResult = { ok: true, how: 'reused' }
      return lastResult
    }

    // Chưa có ai dùng được: thử chèn mới (nếu bảng đang có bản ghi bị khoá thì dùng lại bản ghi đó)
    const locked = one<{ id: number }>('SELECT id FROM users ORDER BY id LIMIT 1')
    if (locked) {
      await applyTo(locked.id, DEFAULT_ADMIN_EMAIL, 'Quản trị viên')
      lastResult = { ok: true, how: 'reused' }
      return lastResult
    }

    const hash = await hashPassword(DEFAULT_ADMIN_PASS)
    const branch = scalar<number>('SELECT id FROM branches ORDER BY id LIMIT 1') ?? 1
    let lastErr: unknown = null
    for (const role of ROLE_CANDIDATES) {
      try {
        withSystemWrite(() =>
          run(
            'INSERT INTO users (name, email, phone, password, role, branch_id, salary, is_active, hired_at, avatar_emoji) VALUES (?,?,?,?,?,?,?,?,?,?)',
            ['Quản trị viên', DEFAULT_ADMIN_EMAIL, '', hash, role, branch, 0, 1, new Date().toISOString().slice(0, 10), '👑'],
          ),
        )
        markDefaultPassword(true)
        lastResult = { ok: true, how: 'created' }
        return lastResult
      } catch (e) { lastErr = e }
    }
    lastResult = { ok: false, error: (lastErr as Error)?.message ?? 'Không tạo được tài khoản quản trị' }
    console.error('[matcha] ensureDefaultAdmin thất bại:', lastResult.error)
    return lastResult
  } catch (e) {
    lastResult = { ok: false, error: (e as Error).message }
    console.error('[matcha] ensureDefaultAdmin LỖI:', (e as Error).message)
    return lastResult
  }
}
