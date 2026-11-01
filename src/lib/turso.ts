/**
 * Đồng bộ dữ liệu qua Turso (libSQL) — thay cho PostgREST.
 *
 * Kiến trúc:
 *  • App vẫn là local-first: dữ liệu nằm trong SQLite của trình duyệt.
 *  • Turso chỉ giữ bản chuẩn + NHẬT KÝ THAY ĐỔI (bảng `sync_changes` do trigger ghi).
 *  • Máy mới: tải toàn bộ 1 lần (`tursoPullAll`).
 *  • Các lần sau: chỉ hỏi "cho tôi thay đổi từ seq X" (`tursoDelta`) → vài KB thay vì 11 MB.
 *
 * Bảo mật:
 *  • Token chỉ-đọc dùng cho máy xem và link chia sẻ; Turso chặn mọi lệnh ghi ở tầng máy chủ.
 *  • Token ghi chỉ nằm trên máy của chủ chuỗi, được mã hoá AES-GCM trong kho bí mật của máy.
 *  • Bảng quản trị (admin_accounts / admin_sessions / sync_tokens) KHÔNG bao giờ tải về máy.
 */
import { Libsql, toHttps, type Arg } from './libsql'
import { TABLES } from './schema'
import { all, dbEvents, getDb, runMany, scalar, withSystemWrite, type SqlValue } from './db'
import { openSecrets, sealSecrets } from './secureStore'

/* ------------------------------- cấu hình -------------------------------- */

export interface TursoConfig {
  url: string
  /** Token CHỈ ĐỌC — dùng cho máy xem và link chia sẻ */
  tokenRo: string
  /** Token GHI — chỉ máy của chủ chuỗi */
  tokenRw: string
  /** Token ĐẶT HÀNG — chỉ thêm/sửa đơn & khách, KHÔNG sửa thực đơn/danh mục (quyền hạn chế theo bảng) */
  tokenOrder: string
  enabled: boolean
  /** seq lớn nhất đã áp dụng (0 = máy chưa đồng bộ lần nào) */
  lastSeq: number
  lastSync: string | null
  lastRows: number
}

const KEY = 'matcha.turso.v1'
const SECRET_NAME = 'matcha.turso.keys'

const EMPTY: TursoConfig = { url: '', tokenRo: '', tokenRw: '', tokenOrder: '', enabled: false, lastSeq: 0, lastSync: null, lastRows: 0 }

let SECRETS: { tokenRo: string; tokenRw: string; tokenOrder: string } | null = null
let HYDRATED = false

/** URL có phải Turso/libSQL không (phân biệt với Supabase https://…supabase.co). */
export function isTursoUrl(url: string): boolean {
  const u = (url ?? '').trim()
  return /^(libsql|turso):\/\//i.test(u) || /\.turso\.io(\/|$)/i.test(u)
}

export function loadTurso(): TursoConfig {
  let plain: Partial<TursoConfig> = {}
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) plain = JSON.parse(raw) as Partial<TursoConfig>
  } catch { /* hỏng dữ liệu → coi như trống */ }
  const { tokenRo: _a, tokenRw: _b, tokenOrder: _c, ...rest } = plain as TursoConfig
  void _a; void _b; void _c
  return {
    ...EMPTY,
    ...rest,
    tokenRo: SECRETS?.tokenRo ?? '',
    tokenRw: SECRETS?.tokenRw ?? '',
    tokenOrder: SECRETS?.tokenOrder ?? '',
  }
}

export function tursoSecretsLoaded() { return HYDRATED }

export async function hydrateTurso(): Promise<boolean> {
  try {
    const sec = await openSecrets(SECRET_NAME)
    // KHÔNG ghi đè bí mật đã nạp trong phiên này (tránh trường hợp vừa mở link xong
    // lại bị lần giải mã cũ ghi đè bằng chuỗi rỗng → mất token).
    if (sec && !SECRETS) SECRETS = { tokenRo: sec.tokenRo ?? '', tokenRw: sec.tokenRw ?? '', tokenOrder: sec.tokenOrder ?? '' }
  } catch { /* chưa cấu hình */ }
  HYDRATED = true
  return !!SECRETS
}

export function saveTurso(cfg: TursoConfig) {
  const clean: TursoConfig = {
    ...cfg,
    url: (cfg.url ?? '').trim().replace(/\/+$/, ''),
    tokenRo: (cfg.tokenRo ?? '').trim(),
    tokenRw: (cfg.tokenRw ?? '').trim(),
    tokenOrder: (cfg.tokenOrder ?? '').trim(),
  }
  SECRETS = { tokenRo: clean.tokenRo, tokenRw: clean.tokenRw, tokenOrder: clean.tokenOrder }
  const plain = {
    url: clean.url, enabled: clean.enabled, lastSeq: clean.lastSeq,
    lastSync: clean.lastSync, lastRows: clean.lastRows,
  }
  localStorage.setItem(KEY, JSON.stringify(plain))
  void sealSecrets({ tokenRo: clean.tokenRo, tokenRw: clean.tokenRw, tokenOrder: clean.tokenOrder }, SECRET_NAME)
}

export function forgetTurso() {
  SECRETS = null
  HYDRATED = false
  localStorage.removeItem(KEY)
  localStorage.removeItem(SECRET_NAME)
}

/** Đã đủ thông tin để đồng bộ qua Turso chưa. */
export function tursoReady(cfg: TursoConfig = loadTurso()): boolean {
  return !!cfg.url && !!(cfg.tokenRo || cfg.tokenRw || cfg.tokenOrder)
}

/**
 * Quyền ghi của máy:
 *  'full'  = token ghi đầy đủ (máy của chủ chuỗi)
 *  'order' = token hạn chế: chỉ thêm/sửa đơn & khách (máy thu ngân / đối tác đặt hàng)
 *  'read'  = chỉ đọc
 */
export function tursoWriteMode(cfg: TursoConfig = loadTurso()): 'full' | 'order' | 'read' {
  if (cfg.tokenRw) return 'full'
  if (cfg.tokenOrder) return 'order'
  return 'read'
}

/** Bảng mà token "đặt hàng" được phép ghi (khớp với quyền đã cấp cho token Turso). */
export const ORDER_WRITABLE = [
  'orders', 'order_items', 'order_item_toppings', 'payments', 'order_events',
  'customers', 'customer_addresses', 'loyalty_accounts', 'loyalty_ledger',
  'shifts', 'shift_cash_txns', 'dining_tables', 'print_jobs',
]

/** Bảng được phép đẩy lên Turso theo quyền hiện tại của máy. */
export function pushableTables(cfg: TursoConfig = loadTurso()): string[] {
  const mode = tursoWriteMode(cfg)
  if (mode === 'full') return orderedTables()
  if (mode === 'order') return orderedTables().filter((t) => ORDER_WRITABLE.includes(t))
  return []
}

/** Thứ tự an toàn theo khoá ngoại: cha trước con (SYNC_ORDER), phần còn lại xếp sau. */
export function orderedTables(): string[] {
  const inOrder = SYNC_ORDER.filter((n) => SYNC_TABLES.includes(n))
  const rest = SYNC_TABLES.filter((n) => !inOrder.includes(n))
  return [...inOrder, ...rest]
}

/** Token nào dùng được: ưu tiên token ghi (máy của chủ), không có thì token đọc. */
const tokenOf = (cfg: TursoConfig) => (cfg.tokenRw || cfg.tokenOrder || cfg.tokenRo || '').trim()

/** Mã hiện tại có quyền ghi không (false = máy đang ở chế độ chỉ xem). */
export function tursoCanWrite(cfg: TursoConfig = loadTurso()): boolean {
  return !!(cfg.tokenRw || cfg.tokenOrder)
}

export function tursoClient(cfg: TursoConfig = loadTurso(), mode: 'auto' | 'ro' = 'auto'): Libsql {
  const anyToken = cfg.tokenRo || cfg.tokenRw || cfg.tokenOrder || tokenOf(cfg)
  const token = mode === 'ro' ? anyToken : tokenOf(cfg) || anyToken
  return new Libsql({ url: cfg.url, token })
}

/* --------------------------- bảng không tải về --------------------------- */

/** Bảng chỉ tồn tại trên Turso (bí mật quản trị) + nhật ký — KHÔNG tải về máy khách. */
const SERVER_ONLY = new Set(['admin_accounts', 'admin_sessions', 'sync_tokens', 'sync_changes'])

/** Bảng nghiệp vụ có cả trên máy và trên Turso. */
export const SYNC_TABLES = TABLES.map((t) => t.name).filter((n) => !SERVER_ONLY.has(n))

/** Thứ tự nạp an toàn theo khoá ngoại (cha trước, con sau) — giống bản Postgres. */
export const SYNC_ORDER: readonly string[] = [
  'branches', 'users', 'roles', 'categories', 'products', 'product_sizes', 'toppings', 'product_toppings',
  'warehouses', 'suppliers', 'ingredients', 'recipes', 'inventory_stock', 'inventory_txns',
  'ingredient_batches', 'stock_counts', 'stock_count_lines', 'stock_transfers', 'stock_transfer_lines', 'wastage_logs',
  'purchase_orders', 'purchase_order_items', 'purchase_requisitions', 'purchase_requisition_lines',
  'supplier_invoices', 'supplier_invoice_lines', 'supplier_payments',
  'modifier_groups', 'modifiers', 'product_modifier_groups', 'combo_deals', 'combo_deal_items', 'price_lists', 'price_list_items',
  'dining_tables', 'customers', 'customer_addresses', 'loyalty_accounts', 'gift_cards', 'vouchers', 'promotions',
  'shifts', 'shift_cash_txns', 'orders', 'order_items', 'order_item_toppings', 'payments', 'order_events',
  'loyalty_ledger', 'gift_card_txns', 'tax_rates', 'invoices',
  'finance_entries', 'cash_register_sessions', 'cash_movements', 'expense_categories', 'expenses', 'kpi_targets',
  'audit_logs', 'deliveries', 'delivery_events', 'delivery_zones', 'driver_devices', 'driver_positions', 'rider_payouts',
  'reservations', 'print_templates', 'printers', 'printer_routes', 'notifications', 'document_sequences',
  'bank_accounts', 'print_jobs', 'app_meta',
]

/* ------------------------------- tiện ích -------------------------------- */

function pkCols(table: string): string[] {
  try {
    const cols = all<{ name: string; pk: number }>(`PRAGMA table_info(${table})`)
    const keys = cols.filter((c) => Number(c.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map((c) => c.name)
    if (keys.length) return keys
  } catch { /* bảng chưa có */ }
  return ['id']
}

const sqlValue = (v: unknown): SqlValue => {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'object') return JSON.stringify(v)
  return v as SqlValue
}

/** Gộp nhiều dòng vào 1 câu INSERT … ON CONFLICT DO UPDATE (nhanh gấp ~40 lần so với từng dòng). */
function upsertSql(table: string, cols: string[], rows: unknown[][], pk: string[]): { sql: string; args: Arg[] } {
  const q = (c: string) => `"${c}"`
  const tuple = `(${cols.map(() => '?').join(',')})`
  const update = cols.filter((c) => !pk.includes(c)).map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')
  const conflict = pk.map(q).join(', ')
  const sql = `INSERT INTO "${table}" (${cols.map(q).join(',')}) VALUES ${rows.map(() => tuple).join(',')}` +
    (update ? ` ON CONFLICT (${conflict}) DO UPDATE SET ${update}` : ` ON CONFLICT (${conflict}) DO NOTHING`)
  return { sql, args: rows.flat() as Arg[] }
}

/* ------------------------------- kiểm tra --------------------------------- */

export interface TursoCheck { ok: boolean; message: string; latency?: number; canRead?: boolean; canWrite?: boolean }

/** Kiểm tra kết nối + quyền đọc/ghi. Ghi thử bằng câu vô hại `UPDATE … WHERE 0` (không đổi dòng nào). */
export async function tursoTest(cfg: TursoConfig = loadTurso()): Promise<TursoCheck> {
  if (!cfg.url) return { ok: false, message: 'Chưa nhập địa chỉ Turso (libsql://…)' }
  if (!tursoReady(cfg)) return { ok: false, message: 'Chưa nhập token Turso' }
  const t0 = performance.now()
  try {
    const read = await tursoClient(cfg, 'ro').scalar('SELECT count(*) FROM branches')
    const latency = Math.round(performance.now() - t0)
    let canWrite = false
    let writeMsg = ''
    if (cfg.tokenRw) {
      try {
        await tursoClient(cfg).run([{ sql: 'UPDATE app_meta SET value = value WHERE 0' }])
        canWrite = true
        writeMsg = ' · quyền ghi: OK'
      } catch (e) {
        writeMsg = ` · quyền ghi: KHÔNG (${String((e as Error).message).slice(0, 60)})`
      }
    } else {
      writeMsg = ' · máy chỉ có token đọc → chế độ CHỈ XEM'
    }
    return {
      ok: true,
      latency,
      canRead: true,
      canWrite,
      message: `Kết nối Turso tốt · ${Number(read ?? 0)} chi nhánh${writeMsg}`,
    }
  } catch (e) {
    return { ok: false, message: `Không kết nối được Turso: ${(e as Error).message}` }
  }
}

/** Token có đọc được và có ghi được không (dùng cho màn Cài đặt + chặn thao tác). */
export async function tursoPermission(cfg: TursoConfig = loadTurso()): Promise<{ valid: boolean | null; write: boolean | null }> {
  if (!tursoReady(cfg)) return { valid: null, write: null }
  let valid: boolean | null = null
  let write: boolean | null = null
  try {
    await tursoClient(cfg, 'ro').scalar('SELECT 1')
    valid = true
  } catch { valid = false }
  if (cfg.tokenRw) {
    try {
      await tursoClient(cfg).run([{ sql: 'UPDATE app_meta SET value = value WHERE 0' }])
      write = true
    } catch { write = false }
  } else {
    write = false
  }
  return { valid, write }
}

/** Số dòng mỗi bảng trên Turso — dùng cho màn “Đối chiếu máy này ↔ cloud”. */
export async function tursoCounts(cfg: TursoConfig = loadTurso()): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const db = tursoClient(cfg, 'ro')
  const names = SYNC_TABLES
  // 1 câu lệnh duy nhất, mỗi bảng 1 subselect → ít lượt gọi hơn nhiều
  try {
    const sql = `SELECT ${names.map((n, i) => `(SELECT count(*) FROM "${n}") AS c${i}`).join(', ')}`
    const r = await db.all(sql)
    const row = r.rows[0] ?? []
    names.forEach((n, i) => { out[n] = Number(row[i] ?? 0) })
  } catch {
    for (const n of names) {
      try { out[n] = Number((await db.scalar(`SELECT count(*) FROM "${n}"`)) ?? 0) } catch { out[n] = -1 }
    }
  }
  return out
}

/* --------------------------------- đẩy lên -------------------------------- */

export interface SyncProgress { table: string; index: number; total: number; rows: number; done?: boolean }

/**
 * Đẩy dữ liệu máy này lên Turso.
 *  • 'merge' (mặc định): UPSERT theo khoá chính — mạng đứt giữa chừng không mất dữ liệu.
 *  • 'replace': xoá sạch trên Turso (con → cha) rồi nạp lại, cloud khớp 100% với máy.
 */
export async function tursoPushAll(
  cfg: TursoConfig = loadTurso(),
  onProgress?: (p: SyncProgress) => void,
  mode: 'merge' | 'replace' = 'merge',
  order: readonly string[] = [],
) {
  const db = tursoClient(cfg)
  const seq = order.length ? order.filter((n) => !SERVER_ONLY.has(n)) : orderedTables()
  const steps = mode === 'replace' ? seq.length * 2 : seq.length

  if (mode === 'replace') {
    const del = [...seq].reverse().map((t) => ({ sql: `DELETE FROM "${t}"` }))
    for (let i = 0; i < del.length; i += 6) {
      onProgress?.({ table: 'xoá dữ liệu cũ', index: i + 1, total: steps, rows: 0 })
      await db.run(del.slice(i, i + 6))
    }
  }

  let total = 0
  for (let i = 0; i < seq.length; i++) {
    const table = seq[i]
    const index = (mode === 'replace' ? seq.length : 0) + i + 1
    const rows = all<Record<string, unknown>>(`SELECT * FROM "${table}"`)
    onProgress?.({ table, index, total: steps, rows: rows.length })
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    const pk = pkCols(table)
    const CHUNK = 120
    for (let c = 0; c < rows.length; c += CHUNK) {
      const slice = rows.slice(c, c + CHUNK).map((r) => cols.map((k) => sqlValue(r[k])))
      const stmt = upsertSql(table, cols, slice, pk)
      await db.run([stmt])
      total += slice.length
    }
  }

  saveTurso({ ...cfg, lastSync: new Date().toISOString(), lastRows: total })
  onProgress?.({ table: 'xong', index: steps, total: steps, rows: total, done: true })
  return { rows: total }
}

/* ---------------------------------- kéo về -------------------------------- */

/**
 * Tải TOÀN BỘ dữ liệu từ Turso về máy (máy mới, hoặc khi cần dựng lại).
 * AN TOÀN: tải hết vào bộ nhớ trước, chỉ ghi đè khi đã có đủ dữ liệu.
 * Bảng nào Turso trả 0 dòng thì GIỮ dữ liệu trên máy (tránh xoá trắng vì thiếu bảng).
 */
export async function tursoPullAll(cfg: TursoConfig = loadTurso(), onProgress?: (p: SyncProgress) => void) {
  const db = tursoClient(cfg, 'ro')
  const seq = orderedTables() // cha trước con → không vi phạm khoá ngoại khi ghi vào máy
  const PAGE = 400
  const plan: { table: string; rows: Record<string, unknown>[] }[] = []
  let total = 0

  for (let i = 0; i < seq.length; i++) {
    const table = seq[i]
    const rows: Record<string, unknown>[] = []
    let lastRowid = -1
    for (;;) {
      // phân trang theo rowid: nhanh, không bị OFFSET quét lại từ đầu
      const r = await db.all(`SELECT rowid AS __rid, * FROM "${table}" WHERE rowid > ? ORDER BY rowid LIMIT ${PAGE}`, [lastRowid])
      const cols = r.columns
      const ridIdx = cols.indexOf('__rid')
      for (const row of r.rows) {
        const obj: Record<string, unknown> = {}
        cols.forEach((c, ci) => { if (c !== '__rid') obj[c] = row[ci] })
        obj.__rid = row[ridIdx]
        rows.push(obj)
      }
      onProgress?.({ table, index: i + 1, total: seq.length, rows: rows.length })
      if (r.rows.length < PAGE) break
      lastRowid = Number(rows[rows.length - 1]?.__rid ?? 0)
    }
    plan.push({ table, rows })
    total += rows.length
  }

  const branchRows = plan.find((p) => p.table === 'branches')?.rows.length ?? 0
  if (!branchRows) throw new Error('Turso trả về 0 dòng ở bảng "branches" — kiểm tra lại token/địa chỉ. Dữ liệu trên máy vẫn giữ nguyên.')

  const keepLocal = new Set(plan.filter((p) => p.rows.length === 0).map((p) => p.table))
  const statements: { sql: string; params: SqlValue[] }[] = []
  for (const table of [...seq].reverse()) {
    if (keepLocal.has(table)) continue
    statements.push({ sql: `DELETE FROM "${table}"`, params: [] })
  }
  for (const { table, rows } of plan) {
    const sample = rows[0]
    if (!sample) continue
    const cols = Object.keys(sample).filter((c) => c !== '__rid')
    for (const r of rows) {
      statements.push({
        sql: `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        params: cols.map((c) => sqlValue(r[c])),
      })
    }
  }
  withSystemWrite(() => runMany(statements))

  const { lastSeq } = await tursoMaxSeq(cfg)
  // Dữ liệu vừa tải từ Turso không cần đẩy ngược lại → dọn nhật ký trong máy
  try { withSystemWrite(() => runMany([{ sql: `DELETE FROM ${'_outbox'}` }], { silent: true })) } catch { /* chưa có bảng */ }
  saveTurso({ ...cfg, lastSeq, lastSync: new Date().toISOString(), lastRows: total })
  onProgress?.({ table: 'xong', index: seq.length, total: seq.length, rows: total, done: true })
  return { rows: total, results: plan.map((p) => ({ table: p.table, rows: p.rows.length })) }
}

/** seq lớn nhất trên Turso (mốc để lần sau chỉ hỏi phần thay đổi). */
export async function tursoMaxSeq(cfg: TursoConfig = loadTurso()): Promise<{ lastSeq: number; rows: number }> {
  const db = tursoClient(cfg, 'ro')
  const s = await db.scalar('SELECT coalesce(max(seq), 0) FROM sync_changes')
  return { lastSeq: Number(s ?? 0), rows: 0 }
}

/**
 * Kéo PHẦN THAY ĐỔI kể từ seq đã lưu — đây là chế độ chạy hằng ngày.
 * Mỗi lượt chỉ đọc đúng số dòng thay đổi (giới hạn 500/lượt) nên rất rẻ.
 */
export async function tursoDelta(cfg: TursoConfig = loadTurso(), onProgress?: (p: SyncProgress) => void) {
  const db = tursoClient(cfg, 'ro')
  let since = Number(cfg.lastSeq ?? 0)
  // Máy CHƯA đồng bộ lần nào (chưa có lastSync) → tải toàn bộ một lần.
  // (Không dùng lastSeq===0 vì nhật ký có thể đang trống → seq = 0 là trạng thái hợp lệ.)
  if (!cfg.lastSync) {
    const full = await tursoPullAll(cfg, onProgress)
    return { applied: full.rows, lastSeq: loadTurso().lastSeq, full: true }
  }

  const LIMIT = 500
  let applied = 0
  let guard = 0
  const marks: { tbl: string; row: string }[] = []
  for (;;) {
    const r = await db.all(
      `SELECT seq, tbl, op, row_id, payload FROM sync_changes WHERE seq > ? ORDER BY seq LIMIT ${LIMIT}`,
      [since],
    )
    if (!r.rows.length) break
    const statements: { sql: string; params: SqlValue[] }[] = []
    for (const [seqCell, tblCell, opCell, rowCell, payloadCell] of r.rows) {
      const seq = Number(seqCell)
      const table = String(tblCell)
      const op = String(opCell)
      if (SERVER_ONLY.has(table) || !SYNC_TABLES.includes(table)) { since = seq; continue }
      if (op === 'delete') {
        const pk = pkCols(table)[0]
        statements.push({ sql: `DELETE FROM "${table}" WHERE "${pk}" = ?`, params: [sqlValue(rowCell)] })
        marks.push({ tbl: table, row: String(rowCell ?? '') })
      } else if (payloadCell) {
        marks.push({ tbl: table, row: String(rowCell ?? '') })
        let obj: Record<string, unknown>
        try { obj = JSON.parse(String(payloadCell)) as Record<string, unknown> } catch { since = seq; continue }
        const cols = Object.keys(obj)
        if (!cols.length) { since = seq; continue }
        const pk = pkCols(table)
        const update = cols.filter((c) => !pk.includes(c)).map((c) => `"${c}" = excluded."${c}"`).join(', ')
        const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})` +
          (update ? ` ON CONFLICT (${pk.map((c) => `"${c}"`).join(', ')}) DO UPDATE SET ${update}` : ` ON CONFLICT DO NOTHING`)
        statements.push({ sql, params: cols.map((c) => sqlValue(obj[c])) })
      }
      since = seq
      applied++
    }
    if (statements.length) withSystemWrite(() => runMany(statements, { silent: true }))
    // Những dòng vừa nhận từ Turso không cần đẩy ngược lại
    if (marks.length) {
      const clear = marks.map((m) => ({ sql: `DELETE FROM _outbox WHERE tbl = ? AND row_id = ?`, params: [m.tbl, m.row] as SqlValue[] }))
      try { withSystemWrite(() => runMany(clear, { silent: true })) } catch { /* chưa có bảng */ }
      marks.length = 0
    }
    saveTurso({ ...cfg, lastSeq: since, lastSync: new Date().toISOString() })
    onProgress?.({ table: 'thay đổi', index: 1, total: 1, rows: applied })
    if (r.rows.length < LIMIT || ++guard > 40) break
  }

  saveTurso({ ...loadTurso(), lastSeq: since, lastSync: new Date().toISOString(), lastRows: applied })
  onProgress?.({ table: 'xong', index: 1, total: 1, rows: applied, done: true })
  return { applied, lastSeq: since, full: false }
}

const getDbLazy = () => getDb()
const dbModule = () => ({ dbEvents })

/* ------------------- NHẬT KÝ THAY ĐỔI NGAY TRONG MÁY ---------------------- */
/**
 * Muốn đẩy lên Turso CHỈ NHỮNG DÒNG VỪA SỬA (chứ không phải cả bảng 22.000 dòng),
 * ta cài trigger ngay trong SQLite của máy: mỗi INSERT/UPDATE/DELETE ghi 1 dòng vào
 * bảng `_outbox`. Sau khi đẩy xong thì xoá các dòng đã đẩy.
 */
const OUTBOX = '_outbox'

/** Cài bảng + trigger nhật ký trong máy (chạy 1 lần cho mỗi máy). Lưu dữ liệu KHÔNG bị ảnh hưởng. */
export function ensureOutbox() {
  withSystemWrite(() => {
    const db = getDbLazy()
    db.run(`CREATE TABLE IF NOT EXISTS ${OUTBOX} (seq INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT NOT NULL, op TEXT NOT NULL, row_id TEXT, at TEXT NOT NULL DEFAULT (datetime('now')))`)
    for (const t of SYNC_TABLES) {
      const pk = pkCols(t)[0]
      if (!pk) continue
      db.run(`CREATE TRIGGER IF NOT EXISTS lo_${t}_ins AFTER INSERT ON "${t}" BEGIN INSERT INTO ${OUTBOX} (tbl, op, row_id) VALUES ('${t}', 'insert', CAST(NEW."${pk}" AS TEXT)); END`)
      db.run(`CREATE TRIGGER IF NOT EXISTS lo_${t}_upd AFTER UPDATE ON "${t}" BEGIN INSERT INTO ${OUTBOX} (tbl, op, row_id) VALUES ('${t}', 'update', CAST(NEW."${pk}" AS TEXT)); END`)
      db.run(`CREATE TRIGGER IF NOT EXISTS lo_${t}_del AFTER DELETE ON "${t}" BEGIN INSERT INTO ${OUTBOX} (tbl, op, row_id) VALUES ('${t}', 'delete', CAST(OLD."${pk}" AS TEXT)); END`)
    }
  })
}

/** Xoá nhật ký trong máy (sau khi tải toàn bộ từ Turso — những dòng đó không cần đẩy ngược lại). */
export function clearOutbox() {
  try {
    withSystemWrite(() => runMany([{ sql: `DELETE FROM ${OUTBOX}` }, { sql: `DELETE FROM sqlite_sequence WHERE name = '${OUTBOX}'` }], { silent: true }))
  } catch { /* chưa có bảng */ }
}

/** Số thay đổi đang chờ đẩy lên Turso. */
export function pendingChanges(): number {
  try { return Number(scalar<number>(`SELECT count(*) FROM ${OUTBOX}`) ?? 0) } catch { return 0 }
}

/**
 * Đẩy các thay đổi đang chờ lên Turso.
 * Gộp 100 dòng/câu lệnh, chỉ đẩy đúng dòng đã đổi; xoá theo khoá chính.
 */
export async function pushOutbox(cfg: TursoConfig = loadTurso()): Promise<{ rows: number; tables: number }> {
  if (!tursoCanWrite(cfg)) throw new Error('Máy này chỉ có quyền ĐỌC — không đẩy dữ liệu lên được.')
  const marks = all<{ seq: number; tbl: string; op: string; row_id: string | null }>(
    `SELECT seq, tbl, op, row_id FROM ${OUTBOX} ORDER BY seq LIMIT 5000`,
  )
  if (!marks.length) return { rows: 0, tables: 0 }

  // gom theo bảng: mỗi dòng chỉ lấy thao tác CUỐI CÙNG
  const dirty = new Map<string, Map<string, 'upsert' | 'delete'>>()
  let maxSeq = 0
  for (const m of marks) {
    maxSeq = Math.max(maxSeq, Number(m.seq))
    if (!SYNC_TABLES.includes(m.tbl) || m.row_id === null) continue
    if (!dirty.has(m.tbl)) dirty.set(m.tbl, new Map())
    dirty.get(m.tbl)!.set(String(m.row_id), m.op === 'delete' ? 'delete' : 'upsert')
  }

  const db = tursoClient(cfg)
  const order = orderedTables()
  const allowed = new Set(pushableTables(cfg))
  const tables = [...dirty.keys()]
    .filter((t) => allowed.has(t)) // token hạn chế: bỏ qua bảng không được cấp quyền
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
  let pushed = 0

  // 1) thêm/sửa: cha trước con
  for (const table of tables) {
    const pk = pkCols(table)[0]
    const upserts = [...dirty.get(table)!].filter(([, op]) => op === 'upsert').map(([id]) => id)
    if (!upserts.length) continue
    const rows = upserts
      .map((id) => all<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE "${pk}" = ? LIMIT 1`, [id])[0])
      .filter(Boolean)
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    for (let i = 0; i < rows.length; i += 100) {
      const slice = rows.slice(i, i + 100).map((r) => cols.map((c) => sqlValue(r[c])))
      await db.run([upsertSql(table, cols, slice, pkCols(table))])
      pushed += slice.length
    }
  }

  // 2) xoá: con trước cha
  for (const table of [...tables].reverse()) {
    const pk = pkCols(table)[0]
    const dels = [...dirty.get(table)!].filter(([, op]) => op === 'delete').map(([id]) => id)
    if (!dels.length) continue
    for (let i = 0; i < dels.length; i += 100) {
      const slice = dels.slice(i, i + 100)
      await db.run(slice.map((id) => ({ sql: `DELETE FROM "${table}" WHERE "${pk}" = ?`, args: [id as Arg] })))
      pushed += slice.length
    }
  }

  // Chỉ xoá dấu của những bảng đã đẩy được; bảng ngoài quyền giữ lại để lần sau đẩy bằng máy chủ
  const pushedTables = new Set(tables)
  const keep = marks.filter((m) => !pushedTables.has(m.tbl)).map((m) => m.seq)
  withSystemWrite(() => {
    if (!keep.length) runMany([{ sql: `DELETE FROM ${OUTBOX} WHERE seq <= ?`, params: [maxSeq] }], { silent: true })
    else runMany([{ sql: `DELETE FROM ${OUTBOX} WHERE seq <= ? AND tbl IN (${tables.map(() => '?').join(',') || 'NULL'})`, params: [maxSeq, ...tables] }], { silent: true })
  })
  return { rows: pushed, tables: tables.length }
}

/* ------------------------- TỰ ĐẨY SAU KHI BÁN HÀNG ---------------------- */

let unsub: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let running = false
let again = false
let lastPushAt = 0
let lastPushRows = 0

export function tursoPushStats() {
  return { lastPushAt, lastPushRows, pending: pendingChanges() }
}

function schedulePush(delay = 3000) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void flushOutbox() }, delay)
}

/** Đẩy ngay (không chờ). */
export async function flushOutbox(): Promise<{ rows: number }> {
  const cfg = loadTurso()
  if (!cfg.enabled || !tursoCanWrite(cfg)) return { rows: 0 }
  if (running) { again = true; return { rows: 0 } }
  running = true
  try {
    const res = await pushOutbox(cfg)
    if (res.rows) {
      lastPushAt = Date.now()
      lastPushRows = res.rows
      saveTurso({ ...loadTurso(), lastSync: new Date().toISOString(), lastRows: res.rows })
      window.dispatchEvent(new CustomEvent('matcha:turso-pushed', { detail: res.rows }))
    }
    return res
  } catch (e) {
    const msg = (e as Error).message
    console.warn('[matcha][turso] đẩy thất bại:', msg)
    window.dispatchEvent(new CustomEvent('matcha:cloud-error', { detail: `Đồng bộ Turso: ${msg}` }))
    schedulePush(30000) // thử lại sau 30 giây, dữ liệu vẫn nằm trong máy
    return { rows: 0 }
  } finally {
    running = false
    if (again) { again = false; schedulePush(800) }
  }
}

/** Bật tự đẩy: mỗi thao tác ghi trong app → sau ~3 giây đẩy phần thay đổi lên Turso. */
export function startAutoPush() {
  if (unsub) return
  ensureOutbox()
  const { dbEvents } = dbModule()
  unsub = dbEvents.subscribe(() => {
    const cfg = loadTurso()
    if (!cfg.enabled || !tursoCanWrite(cfg)) return
    schedulePush()
  })
  schedulePush(1500)
  window.addEventListener('online', () => schedulePush(500))
}

export function stopAutoPush() {
  unsub?.()
  unsub = null
  if (timer) clearTimeout(timer)
  timer = null
}
