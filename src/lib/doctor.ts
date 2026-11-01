/**
 * Chẩn đoán nhanh máy đang mở app — dùng khi không đăng nhập được.
 * Mục đích: chỉ ra CHÍNH XÁC máy này thiếu gì (bộ nhớ trình duyệt, quyền ghi,
 * CSDL chưa mở, tài khoản chưa tạo…) thay vì báo lỗi chung chung.
 */
import { all, dbSizeBytes, isReadOnlyMode, run, scalar, withSystemWrite } from './db'
import { lastAdminRepair } from './defaultAdmin'

export interface DoctorCheck {
  label: string
  ok: boolean
  detail: string
}

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

export async function runDoctor(): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = []

  checks.push({
    label: 'Kết nối bảo mật (https)',
    ok: !!window.isSecureContext,
    detail: window.isSecureContext ? 'Đạt — mã hoá mật khẩu hoạt động' : 'KHÔNG đạt — mở lại bằng địa chỉ https://',
  })

  let lsOk = true
  try { localStorage.setItem('matcha.__probe', '1'); localStorage.removeItem('matcha.__probe') } catch { lsOk = false }
  checks.push({
    label: 'Bộ nhớ cục bộ (localStorage)',
    ok: lsOk,
    detail: lsOk ? 'Đạt' : 'Bị chặn — tắt "Chặn cookie" / thoát chế độ ẩn danh rồi mở lại',
  })

  let idbOk = true
  let idbDetail = 'Đạt'
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('matcha.__probe', 1)
      req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('matcha.__probe'); resolve() }
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('bị chặn'))
    })
  } catch (e) { idbOk = false; idbDetail = 'Bị chặn — ' + ((e as Error).message || 'trình duyệt không cho lưu dữ liệu') }
  checks.push({ label: 'Cơ sở dữ liệu trình duyệt (IndexedDB)', ok: idbOk, detail: idbDetail })

  const cryptoOk = typeof crypto !== 'undefined' && !!crypto.subtle
  checks.push({
    label: 'Mã hoá mật khẩu (WebCrypto)',
    ok: cryptoOk,
    detail: cryptoOk ? 'Đạt' : 'KHÔNG đạt — trình duyệt này không hỗ trợ; mở bằng Chrome/Safari bản mới',
  })

  const tables = safe(() => scalar<number>(`SELECT COUNT(*) FROM sqlite_master WHERE type='table'`) ?? 0, -1)
  checks.push({
    label: 'Đã mở cơ sở dữ liệu',
    ok: tables > 10,
    detail: tables > 10 ? `${tables} bảng · ${(dbSizeBytes() / 1048576).toFixed(1)} MB` : `Chỉ thấy ${tables} bảng — CSDL chưa nạp xong, tải lại trang`,
  })

  const users = safe(() => all<{ email: string; is_active: number; password: string | null }>('SELECT email, is_active, password FROM users'), [])
  const usable = users.filter((u) => u.is_active && u.password && u.password !== '!')
  const hasAdmin = users.some((u) => (u.email ?? '').trim().toLowerCase() === 'admin')
  checks.push({
    label: 'Tài khoản đăng nhập được',
    ok: usable.length > 0,
    detail: `${users.length} tài khoản · ${usable.length} dùng được · tài khoản "admin": ${hasAdmin ? 'có' : 'chưa có'}`,
  })

  let writeOk = true
  let writeDetail = 'Đạt'
  try {
    withSystemWrite(() => run('CREATE TABLE IF NOT EXISTS _matcha_probe (x INTEGER)'))
    withSystemWrite(() => run('INSERT INTO _matcha_probe (x) VALUES (1)'))
    withSystemWrite(() => run('DROP TABLE _matcha_probe'))
  } catch (e) { writeOk = false; writeDetail = (e as Error).message }
  checks.push({ label: 'Quyền ghi dữ liệu trên máy này', ok: writeOk, detail: writeDetail })

  if (isReadOnlyMode()) {
    checks.push({ label: 'Chế độ chỉ xem', ok: false, detail: 'Máy này đang ở chế độ chỉ xem (mở từ link chỉ xem) — đăng nhập vẫn được, nhưng không sửa dữ liệu' })
  }

  const rep = lastAdminRepair()
  if (rep) {
    checks.push({
      label: 'Tự tạo tài khoản admin',
      ok: rep.ok,
      detail: rep.ok
        ? { already: 'đã có sẵn', restored: 'đã khôi phục', reused: 'đã dùng lại một bản ghi nhân sự', created: 'đã tạo mới' }[rep.how ?? 'created']
        : `THẤT BẠI — ${rep.error ?? 'không rõ lỗi'}`,
    })
  }

  return checks
}

/** Toàn bộ chẩn đoán thành một khối chữ để người dùng copy/gửi ảnh chụp. */
export async function doctorText(): Promise<string> {
  const checks = await runDoctor()
  return checks.map((c) => `${c.ok ? '✔' : '✖'} ${c.label}: ${c.detail}`).join('\n')
}
