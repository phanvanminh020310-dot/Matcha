/**
 * Băm mật khẩu người dùng bằng PBKDF2-SHA256 (WebCrypto) — KHÔNG lưu mật khẩu dạng chữ thường.
 * Định dạng lưu: pbkdf2$<số vòng>$<salt base64>$<hash base64>
 * - Mỗi người dùng có salt riêng (16 byte ngẫu nhiên) → cùng mật khẩu vẫn ra hash khác nhau.
 * - 120.000 vòng: dò mật khẩu bằng GPU rất chậm.
 */
import bcrypt from 'bcryptjs'

const ITER = 120000
const PREFIX = 'pbkdf2$'
/** Dự phòng khi trình duyệt không có WebCrypto (máy quá cũ, chế độ không bảo mật, webview lạ). */
const BCRYPT_ROUNDS = 10

const enc = new TextEncoder()

function b64(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function unb64(text: string) {
  const raw = atob(text)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function webCryptoOk() {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.subtle.importKey === 'function'
}

function randomBytes(n: number) {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') return crypto.getRandomValues(new Uint8Array(n))
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

async function derive(password: string, salt: Uint8Array, rounds: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: rounds, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(bits)
}

/** So sánh mất thời gian không đổi (tránh lộ thông tin qua thời gian phản hồi). */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Đã là hash chưa (dữ liệu cũ còn lưu chữ thường). */
export function looksHashed(value: string) {
  return value.startsWith(PREFIX) || value.startsWith('$2')
}

/** Mật khẩu chưa được đặt / tài khoản bị khoá đăng nhập. */
export function isLocked(value: string | null | undefined) {
  return !value || value === '!' || value === ''
}

export async function hashPassword(password: string): Promise<string> {
  // Đường chuẩn: PBKDF2 120.000 vòng bằng WebCrypto
  if (webCryptoOk()) {
    try {
      const salt = randomBytes(16)
      const hash = await derive(password, salt, ITER)
      return `${PREFIX}${ITER}$${b64(salt)}$${b64(hash)}`
    } catch { /* rơi xuống bản dự phòng bên dưới */ }
  }
  // Dự phòng: bcrypt thuần JS — vẫn là hash mạnh, không lưu chữ thường
  return bcrypt.hashSync(password, BCRYPT_ROUNDS)
}

/** Kiểm tra mật khẩu. `legacy: true` nghĩa là bản ghi còn lưu chữ thường và cần nâng cấp. */
export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; legacy: boolean }> {
  if (!stored || stored === '!') return { ok: false, legacy: false }
  if (stored.startsWith('$2')) {
    try { return { ok: bcrypt.compareSync(password, stored), legacy: false } } catch { return { ok: false, legacy: false } }
  }
  if (!looksHashed(stored)) return { ok: stored === password, legacy: true }
  const parts = stored.split('$')
  if (parts.length !== 4) return { ok: false, legacy: false }
  const rounds = Number(parts[1]) || ITER
  try {
    const hash = await derive(password, unb64(parts[2]), rounds)
    return { ok: safeEqual(b64(hash), parts[3]), legacy: false }
  } catch {
    return { ok: false, legacy: false }
  }
}

/** Đánh giá độ mạnh tối thiểu cho tài khoản thật. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.'
  if (!/[a-zA-Z]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ cái.'
  if (!/[0-9]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ số.'
  if (['12345678', 'matkhau', 'password', 'matcha123'].includes(password.toLowerCase())) return 'Mật khẩu này quá dễ đoán, hãy chọn mật khẩu khác.'
  return null
}
