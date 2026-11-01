/**
 * Lớp truy cập CSDL: sql.js (SQLite WASM) chạy trong trình duyệt,
 * lưu bền vào IndexedDB, seed tự động lần đầu.
 */
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
export type { SqlValue }
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { seedDatabase } from './seed'
import { seedExtras } from './seed-extra'
import { DDL, SCHEMA_VERSION } from './schema'

const IDB_NAME = 'matcha-pos'
const IDB_STORE = 'sqlite'
const KEY = 'db-bytes'
const META_KEY = 'db-meta'

let db: Database | null = null
let SQLModule: Awaited<ReturnType<typeof initSqlJs>> | null = null

type Listener = () => void
const listeners = new Set<Listener>()

/** Kênh đồng bộ giữa các tab (POS ↔ KDS ↔ màn hình gọi số). */
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('matcha-pos') : null
channel?.addEventListener('message', () => listeners.forEach((fn) => fn()))

export const dbEvents = {
  subscribe(fn: Listener) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  emit() {
    listeners.forEach((fn) => fn())
    try { channel?.postMessage({ t: Date.now() }) } catch { /* ignore */ }
  },
}

/* ------------------------------- IndexedDB ------------------------------- */
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbClear() {
  const idb = await openIDB()
  return new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/* -------------------------------- persist -------------------------------- */
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false

export function persist(immediate = false) {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  const run = async () => {
    if (!db || !dirty) return
    dirty = false
    const bytes = db.export()
    await idbSet(KEY, bytes)
    await idbSet(META_KEY, { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), size: bytes.byteLength })
  }
  if (immediate) return run()
  saveTimer = setTimeout(() => void run(), 900)
}

export async function flushSave() {
  if (saveTimer) clearTimeout(saveTimer)
  await persist(true)
}

/* --------------------------------- init ---------------------------------- */
export interface InitProgress {
  step: string
  detail?: string
}

export async function initDatabase(onProgress?: (p: InitProgress) => void): Promise<{ seeded: boolean; ms: number }> {
  const t0 = performance.now()
  onProgress?.({ step: 'Khởi động SQLite WASM', detail: 'sql.js · ~1.2MB' })
  SQLModule = await initSqlJs({ locateFile: () => wasmUrl })

  onProgress?.({ step: 'Tìm dữ liệu đã lưu', detail: 'IndexedDB' })
  const saved = await idbGet<Uint8Array>(KEY)
  const meta = await idbGet<{ version: number }>(META_KEY)

  if (saved && meta?.version === SCHEMA_VERSION) {
    db = new SQLModule.Database(saved)
    db.run('PRAGMA foreign_keys = ON')
    onProgress?.({ step: 'Đã nạp dữ liệu', detail: `${(saved.byteLength / 1048576).toFixed(1)} MB từ IndexedDB` })
    return { seeded: false, ms: Math.round(performance.now() - t0) }
  }

  // Có dữ liệu cũ nhưng phiên bản schema thấp hơn → NÂNG CẤP TẠI CHỖ (không xoá dữ liệu người dùng)
  if (saved) {
    onProgress?.({ step: 'Nâng cấp cấu trúc CSDL', detail: `v${meta?.version ?? '?'} → v${SCHEMA_VERSION}` })
    db = new SQLModule.Database(saved)
    db.run('PRAGMA foreign_keys = ON')
    migrate(db)
    fillNewTables(db)
    await persist(true)
    onProgress?.({ step: 'Đã nâng cấp CSDL', detail: 'giữ nguyên toàn bộ dữ liệu' })
    return { seeded: false, ms: Math.round(performance.now() - t0) }
  }

  onProgress?.({ step: 'Tạo schema quan hệ', detail: '75 bảng · PK/FK · CHECK · index' })
  db = new SQLModule.Database()
  await new Promise((r) => setTimeout(r, 30))
  onProgress?.({ step: 'Sinh dữ liệu demo 90 ngày', detail: '3 chi nhánh · 220 khách · ~4.000 đơn' })
  const result = seedDatabase(db)
  db.run('PRAGMA foreign_keys = ON')
  onProgress?.({ step: 'Lưu vào IndexedDB', detail: `${(db.export().byteLength / 1048576).toFixed(1)} MB` })
  await persist(true)
  console.info('[matcha-pos] seeded', result.counts)
  return { seeded: true, ms: Math.round(performance.now() - t0) }
}

/**
 * Nâng cấp cấu trúc tại chỗ: chạy lại DDL dạng IF NOT EXISTS (chỉ TẠO THÊM bảng/chỉ mục
 * còn thiếu, không đụng bảng đã có) — an toàn cho dữ liệu đang chạy.
 */
export function migrate(target: Database = getDb()) {
  const patch = DDL
    .replace(/PRAGMA[^;]+;/gi, '')
    .replace(/CREATE TABLE (\w+)/g, 'CREATE TABLE IF NOT EXISTS $1')
    .replace(/CREATE INDEX (\w+)/g, 'CREATE INDEX IF NOT EXISTS $1')
  target.run(patch)
}

/**
 * Máy đang có dữ liệu cũ vừa được nâng cấp schema: các bảng MỚI còn rỗng thì
 * sinh dữ liệu cho chúng từ dữ liệu lõi hiện có (không đụng bảng cũ).
 */
export function fillNewTables(target: Database = getDb()) {
  const count = (t: string) => {
    try { return Number(target.exec(`SELECT COUNT(*) FROM ${t}`)[0]?.values[0][0] ?? 0) } catch { return 0 }
  }
  if (count('driver_positions') > 0) return
  const orders = count('orders')
  if (orders === 0) return
  try {
    const added = seedExtras(target)
    console.info('[matcha-pos] đã sinh dữ liệu cho bảng mới', added)
  } catch (e) {
    console.error('[matcha-pos] sinh dữ liệu bảng mới lỗi', e)
  }
}

export function getDb(): Database {
  if (!db) throw new Error('CSDL chưa sẵn sàng')
  return db
}

export async function resetDatabase(onProgress?: (p: InitProgress) => void) {
  onProgress?.({ step: 'Xoá dữ liệu cũ' })
  await idbClear()
  db?.close()
  db = null
  return initDatabase(onProgress)
}

/* -------------------------------- queries -------------------------------- */
export function all<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = getDb().prepare(sql)
  try {
    stmt.bind(params)
    const rows: T[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T)
    return rows
  } finally {
    stmt.free()
  }
}

export function one<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T | null {
  const rows = all<T>(sql, params)
  return rows.length ? rows[0] : null
}

export function scalar<T = number>(sql: string, params: SqlValue[] = []): T | null {
  const rows = all<Record<string, SqlValue>>(sql, params)
  if (!rows.length) return null
  const first = Object.values(rows[0])[0]
  return (first as unknown as T) ?? null
}

/** Ghi dữ liệu: tự động phát sự kiện + đánh dấu cần lưu IndexedDB. */
export function run(sql: string, params: SqlValue[] = [], opts: { silent?: boolean } = {}) {
  getDb().run(sql, params)
  if (!opts.silent) {
    persist()
    dbEvents.emit()
  }
}

export function runMany(statements: { sql: string; params?: SqlValue[] }[], opts: { silent?: boolean } = {}) {
  const database = getDb()
  database.run('BEGIN')
  try {
    statements.forEach((s) => database.run(s.sql, s.params ?? []))
    database.run('COMMIT')
  } catch (err) {
    database.run('ROLLBACK')
    throw err
  }
  if (!opts.silent) {
    persist()
    dbEvents.emit()
  }
}

export function lastInsertId() {
  return scalar<number>('SELECT last_insert_rowid()') ?? 0
}

export function tableRowCount(table: string) {
  return scalar<number>(`SELECT COUNT(*) FROM "${table}"`) ?? 0
}

export function dbSizeBytes(): number {
  return db ? db.export().byteLength : 0
}

/** Chạy SELECT an toàn (chỉ đọc) cho SQL Console. */
export function runReadOnlyQuery(sql: string): { columns: string[]; rows: SqlValue[][]; ms: number; rowCount: number } {
  const trimmed = sql.trim().replace(/;+\s*$/, '')
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase()
  if (!['select', 'with', 'pragma', 'explain'].includes(firstWord)) {
    throw new Error('Chỉ cho phép truy vấn đọc dữ liệu (SELECT / WITH / PRAGMA / EXPLAIN).')
  }
  if (/;\s*\S/.test(trimmed)) throw new Error('Mỗi lần chỉ chạy một câu lệnh.')
  if (/\b(insert|update|delete|drop|alter|create|replace|attach|vacuum|reindex)\b/i.test(trimmed)) {
    throw new Error('Phát hiện từ khoá ghi dữ liệu — SQL Console ở chế độ chỉ đọc.')
  }
  const t0 = performance.now()
  const res = getDb().exec(trimmed)
  const ms = Math.round((performance.now() - t0) * 10) / 10
  if (!res.length) return { columns: [], rows: [], ms, rowCount: 0 }
  const { columns, values } = res[0]
  return { columns, rows: values.slice(0, 500), ms, rowCount: values.length }
}

export { SCHEMA_VERSION }
