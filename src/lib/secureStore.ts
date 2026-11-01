/**
 * Kho bí mật của máy: mã hoá anon key + mã đồng bộ TRƯỚC KHI lưu vào trình duyệt.
 *
 * Nhiều lớp:
 *  1. Khoá mã hoá AES-GCM 256 sinh ngẫu nhiên cho TỪNG máy, lưu trong IndexedDB dưới
 *     dạng CryptoKey **không xuất được** (extractable = false) → không thể copy ra.
 *  2. localStorage chỉ chứa ciphertext (iv + bản mã). Mở DevTools / copy localStorage
 *     sang máy khác chỉ thấy chuỗi vô nghĩa.
 *  3. Giao diện chỉ hiện thông tin kết nối sau khi đăng nhập tài khoản quản trị
 *     (xác thực bcrypt ở Postgres — xem lib/adminAuth.ts).
 *
 * Trình duyệt cũ / chế độ riêng tư chặn IndexedDB → tự lùi về lưu thường để app vẫn chạy.
 */
const DB_NAME = 'matcha-keys'
const STORE = 'keys'
const KEY_ID = 'cfg-key'
const ENC_KEY = 'matcha.cloud.enc'

interface Envelope {
  iv: string
  ct: string
  at: number
}

let cachedKey: CryptoKey | null = null
let cryptoOk = true

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function deviceKey(): Promise<CryptoKey | null> {
  if (!cryptoOk) return null
  if (cachedKey) return cachedKey
  try {
    if (!crypto?.subtle) throw new Error('no subtle')
    const existing = await idbGet<CryptoKey>(KEY_ID)
    if (existing) { cachedKey = existing; return existing }
    // extractable = false: khoá không thể export, chỉ dùng trong máy này
    const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await idbSet(KEY_ID, created)
    cachedKey = created
    return created
  } catch {
    cryptoOk = false
    return null
  }
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** Mã hoá bí mật và ghi vào localStorage (chỉ ciphertext). */
export async function sealSecrets(secrets: { key: string; token: string }): Promise<boolean> {
  const k = await deviceKey()
  try {
    if (!k) {
      localStorage.setItem(ENC_KEY, JSON.stringify({ plain: true, data: secrets, at: Date.now() }))
      return false
    }
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(secrets)))
    localStorage.setItem(ENC_KEY, JSON.stringify({ iv: b64(iv.buffer), ct: b64(ct), at: Date.now() } as Envelope))
    return true
  } catch {
    localStorage.setItem(ENC_KEY, JSON.stringify({ plain: true, data: secrets, at: Date.now() }))
    return false
  }
}

/** Đọc & giải mã bí mật. Trả null nếu chưa có / không giải mã được (khác máy). */
export async function openSecrets(): Promise<{ key: string; token: string } | null> {
  const raw = localStorage.getItem(ENC_KEY)
  if (!raw) return null
  try {
    const env = JSON.parse(raw) as Envelope & { plain?: boolean; data?: { key: string; token: string } }
    if (env.plain && env.data) return env.data
    const k = await deviceKey()
    if (!k) return null
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, k, unb64(env.ct))
    return JSON.parse(new TextDecoder().decode(plain)) as { key: string; token: string }
  } catch {
    return null
  }
}

export async function clearSecrets() {
  localStorage.removeItem(ENC_KEY)
  try {
    const idb = await openIdb()
    await new Promise<void>((resolve) => {
      const tx = idb.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY_ID)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch { /* bỏ qua */ }
  cachedKey = null
}
