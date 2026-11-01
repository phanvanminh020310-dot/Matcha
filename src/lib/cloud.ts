/**
 * Kết nối CSDL Postgres thật (Supabase / Neon / bất kỳ PostgREST).
 * • Sinh DDL Postgres đầy đủ (33 bảng) từ schema SQLite của app + RLS cho Supabase
 * • Đẩy / kéo toàn bộ dữ liệu qua REST (PostgREST) — dùng anon key của user
 * • Không có key thì app vẫn chạy offline trên SQLite WASM; cloud là nơi lưu bền nhiều máy
 */
import { DDL, TABLES } from './schema'
import { all, runMany, scalar, setReadOnlyMode, withSystemWrite, type SqlValue } from './db'
import { openSecrets, sealSecrets } from './secureStore'

export interface CloudConfig {
  url: string
  key: string
  autoSync: boolean
  /** Bật lắng nghe thay đổi từ Postgres (Supabase Realtime) */
  realtime: boolean
  /** Mã thiết bị (sync token) — bắt buộc khi cloud đã bật RLS. DB chỉ giữ SHA-256 của mã. */
  token: string
  lastSync: string | null
  lastRows: number
}

const KEY = 'matcha.cloud.v1'

const EMPTY: CloudConfig = { url: '', key: '', token: '', autoSync: false, realtime: true, lastSync: null, lastRows: 0 }

/** Bí mật đã giải mã trong phiên này (anon key + mã đồng bộ). Không bao giờ ghi thẳng ra localStorage. */
let SECRETS: { key: string; token: string } | null = null
let HYDRATED = false

/** Đọc cấu hình: phần không bí mật lấy từ localStorage, bí mật lấy từ bộ nhớ (sau khi giải mã). */
export function loadCloud(): CloudConfig {
  let plain: Partial<CloudConfig> = {}
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) plain = JSON.parse(raw) as Partial<CloudConfig>
  } catch { /* hỏng dữ liệu → coi như trống */ }
  const { key: _k, token: _t, ...rest } = plain as CloudConfig
  void _k; void _t
  return { ...EMPTY, ...rest, key: SECRETS?.key ?? '', token: SECRETS?.token ?? '' }
}

/** Đã nạp được bí mật chưa (dùng để biết máy có đủ cấu hình để đồng bộ). */
export function cloudSecretsLoaded() { return HYDRATED }

/** Gọi 1 lần khi mở app: giải mã anon key + mã đồng bộ từ kho mã hoá của máy. */
export async function hydrateCloud(): Promise<boolean> {
  try {
    const sec = await openSecrets()
    if (sec) SECRETS = { key: sec.key ?? '', token: sec.token ?? '' }
  } catch { /* không giải mã được → người dùng nhập lại trong Cài đặt */ }
  // Máy cũ còn lưu anon key + mã đồng bộ dạng CHỮ THƯỜNG trong localStorage → chuyển sang kho mã hoá rồi xoá bản rõ.
  if (!SECRETS) {
    try {
      const raw = localStorage.getItem(KEY)
      const plain = raw ? (JSON.parse(raw) as Partial<CloudConfig>) : null
      if (plain?.key || plain?.token) {
        SECRETS = { key: plain.key ?? '', token: plain.token ?? '' }
        await sealSecrets(SECRETS)
        const { key: _k, token: _t, ...rest } = plain as CloudConfig
        void _k; void _t
        localStorage.setItem(KEY, JSON.stringify(rest))
      }
    } catch { /* không chuyển được → coi như máy chưa cấu hình */ }
  }
  HYDRATED = true
  return !!SECRETS
}

/** Lỗi đồng bộ gần nhất — lưu lại để banner cảnh báo hiện được cả khi lỗi xảy ra lúc app vừa khởi động. */
const ERR_KEY = 'matcha.cloud.err'

export function setCloudError(message: string) {
  try { localStorage.setItem(ERR_KEY, JSON.stringify({ message, at: Date.now() })) } catch { /* hết chỗ lưu */ }
}

export function readCloudError(): { message: string; at: number } | null {
  try {
    const raw = localStorage.getItem(ERR_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { message: string; at: number }
    if (!v?.message || Date.now() - (v.at ?? 0) > 10 * 60 * 1000) return null
    return v
  } catch { return null }
}

export function clearCloudError() {
  try { localStorage.removeItem(ERR_KEY) } catch { /* bỏ qua */ }
}

let SEAL_QUEUE: Promise<void> = Promise.resolve()

/** Lưu cấu hình: phần bí mật được MÃ HOÁ trước khi ghi xuống localStorage. */
export function saveCloud(cfg: CloudConfig) {
  const clean: CloudConfig = {
    ...cfg,
    url: (cfg.url ?? '').trim().replace(/\/+$/, ''),
    key: (cfg.key ?? '').trim(),
    token: (cfg.token ?? '').trim(),
  }
  SECRETS = { key: clean.key, token: clean.token }
  const plain = { url: clean.url, autoSync: clean.autoSync, realtime: clean.realtime, lastSync: clean.lastSync, lastRows: clean.lastRows }
  localStorage.setItem(KEY, JSON.stringify(plain))
  // Xếp hàng: mỗi lần lưu phải ghi xong bản mã hoá mới sang lần kế tiếp,
  // tránh trường hợp gõ nhanh/nhấn F5 mà bản mã hoá cũ ghi đè bản mới.
  SEAL_QUEUE = SEAL_QUEUE.then(async () => { await sealSecrets({ key: clean.key, token: clean.token }) }).catch(() => { /* bỏ qua */ })
}



/** Chờ mọi thay đổi cấu hình đã được mã hoá xong (dùng trước khi tải lại trang). */
export async function flushCloudSave() { try { await SEAL_QUEUE } catch { /* bỏ qua */ } }

/**
 * Xoá cấu hình khỏi máy (máy trả về trạng thái "chưa cấu hình").
 * Không xoá dữ liệu nghiệp vụ, chỉ xoá thông tin kết nối.
 */
export function forgetCloud() {
  SECRETS = null
  HYDRATED = false
  localStorage.removeItem(KEY)
  localStorage.removeItem('matcha.cloud.enc')
}

/** URL cloud đã chuẩn hoá (bỏ /rest/v1, bỏ dấu / cuối). */
export const normCloudUrl = (url: string) => normUrl(url ?? '')

/** Mã đồng bộ đúng dạng `mk_` + chuỗi hex. */
export function tokenLooksValid(token: string): boolean {
  const t = (token ?? '').trim()
  return /^mk_[0-9a-f]{16,}$/i.test(t)
}

/** Cảnh báo khi ô "Mã đồng bộ" bị dán nhầm thứ khác (lỗi phổ biến nhất). */
export function tokenWarning(token: string): string | null {
  const t = (token ?? '').trim()
  if (!t) return 'Chưa nhập mã đồng bộ — cloud đã bật RLS nên KHÔNG đọc được dữ liệu nếu thiếu mã.'
  if (/^eyJ/.test(t) || /^sb_/.test(t)) return 'Ô này đang chứa ANON KEY, không phải mã đồng bộ. Mã đồng bộ bắt đầu bằng “mk_”.'
  if (t.length > 90) return 'Chuỗi này quá dài so với một mã đồng bộ (thường 67 ký tự, bắt đầu bằng mk_). Có thể bạn dán nhầm key.'
  if (!tokenLooksValid(t)) return 'Mã đồng bộ phải có dạng mk_ + chuỗi hex (ví dụ mk_6cd742698ef8…). Kiểm tra lại xem có dán thiếu/thừa ký tự.'
  return null
}

/** Hỏi Postgres xem mã đồng bộ hiện tại có hợp lệ không (RPC sync_ok). */
export async function checkToken(cfg: CloudConfig): Promise<{ ok: boolean; message: string }> {
  if (!cfg.url || !cfg.key) return { ok: false, message: 'Cần Project URL + anon key trước' }
  const warn = tokenWarning(cfg.token)
  if (warn) return { ok: false, message: warn }
  try {
    const res = await fetch(`${normUrl(cfg.url)}/rest/v1/rpc/sync_ok`, {
      method: 'POST', headers: headers(cfg), body: '{}', signal: AbortSignal.timeout(15000),
    })
    if (res.status === 404) return { ok: false, message: 'Cloud chưa chạy rls.sql nên không kiểm tra được mã (nhưng dữ liệu vẫn tải được).' }
    if (!res.ok) return { ok: false, message: `Không kiểm tra được mã (HTTP ${res.status})` }
    const val = await res.json().catch(() => null)
    return val === true
      ? { ok: true, message: 'Mã đồng bộ hợp lệ — máy này được phép đọc & ghi.' }
      : { ok: false, message: 'Mã đồng bộ KHÔNG đúng: Postgres trả về false. Dán lại đúng mã “mk_…” (xem file MATCHA-cloud-token.txt) rồi thử lại.' }
  } catch (e) {
    return { ok: false, message: `Không kết nối được: ${(e as Error).message}` }
  }
}

/** Cảnh báo cấu hình: service key có toàn quyền, chỉ nên dùng khi thử nghiệm. */
export function keyWarning(key: string): string | null {
  const k = key.trim()
  if (!k) return null
  if (k.startsWith('sb_secret_') || k.includes('service_role')) return 'Đây là SECRET / service_role key — có toàn quyền ghi đè dữ liệu. Chỉ dùng để thử, không chia sẻ.'
  if (k.startsWith('sb_publishable_')) return 'Key publishable (mới) — app gửi qua header apikey, dùng được. Nếu Kiểm tra báo 401, đổi sang key legacy "anon" (chuỗi eyJ…) trong tab Legacy API keys.'
  if (!k.startsWith('eyJ') && !k.startsWith('sb_')) return 'Key không giống anon key của Supabase (thường bắt đầu bằng eyJ… hoặc sb_publishable_…).'
  return null
}

// Chấp nhận cả URL gốc lẫn URL dán kèm /rest/v1 (lỗi copy rất phổ biến)
export const normUrl = (url: string) =>
  url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '')

/* ------------------------------ DDL Postgres ------------------------------ */

/** Chuyển DDL SQLite → Postgres: BIGINT id, DOUBLE PRECISION, IF NOT EXISTS, bỏ AUTOINCREMENT/PRAGMA. */
export function toPgDDL(): string {
  const body = DDL
    .replace(/PRAGMA[^;]+;/gi, '')
    .replace(/CREATE TABLE (\w+)/g, 'CREATE TABLE IF NOT EXISTS $1')
    .replace(/CREATE INDEX (\w+)/g, 'CREATE INDEX IF NOT EXISTS $1')
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY')
    .replace(/INTEGER PRIMARY KEY/gi, 'BIGINT PRIMARY KEY')
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION')

  const rls = TABLES.map((t) => `
ALTER TABLE ${t.name} ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_${t.name} ON ${t.name};
CREATE POLICY matcha_all_${t.name} ON ${t.name} FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`).join('\n')

  const grants = TABLES.map((t) => `GRANT SELECT, INSERT, UPDATE, DELETE ON ${t.name} TO anon, authenticated;`).join('\n')

  return `-- Matcha POS · schema Postgres (Supabase/Neon) — sinh tự động từ src/lib/schema.ts
-- Chạy toàn bộ file này trong SQL Editor của Supabase (hoặc psql) một lần.
-- Sau đó: Cài đặt → Cơ sở dữ liệu → dán URL + anon key → Đẩy dữ liệu lên.

BEGIN;
${body}
${rls}
${grants}
COMMIT;
`
}

/**
 * Khoá chính thật của từng bảng (đọc từ SQLite): có bảng không có cột `id`
 * (vd product_toppings dùng khoá ghép product_id + topping_id) → phải order theo PK thật
 * thì phân trang của PostgREST mới ổn định.
 */
function pkCols(table: string): string[] {
  try {
    const cols = all<{ name: string; pk: number }>(`PRAGMA table_info(${table})`)
    const keys = cols.filter((c) => Number(c.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map((c) => c.name)
    if (keys.length) return keys
  } catch { /* bảng chưa tồn tại */ }
  return ['id']
}
const pkOf = (table: string) => pkCols(table)[0]

/**
 * Thứ tự nạp đúng phụ thuộc khoá ngoại (cha trước con) — SQLite bật PRAGMA foreign_keys
 * nên nạp sai thứ tự sẽ vi phạm FK ngay (vd orders cần dining_tables/shifts/customers trước).
 */
export const SYNC_ORDER = [
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
] as const

/* ------------------------------ Seed SQL ------------------------------ */

const quote = (v: unknown) => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

/** Dump dữ liệu hiện có thành INSERT (dùng được cho psql/Supabase SQL Editor). */
export function buildSeedSQL(limitPerTable = 0): string {
  const parts: string[] = ['-- Matcha POS · dữ liệu khởi tạo (sinh từ CSDL đang chạy)', 'BEGIN;']
  TABLES.forEach((t) => {
    const rows = all<Record<string, unknown>>(`SELECT * FROM ${t.name}${limitPerTable ? ` LIMIT ${limitPerTable}` : ''}`)
    if (!rows.length) return
    const cols = Object.keys(rows[0])
    parts.push(`\n-- ${t.name}: ${rows.length} dòng`)
    parts.push(`INSERT INTO ${t.name} (${cols.join(', ')}) VALUES`)
    parts.push(rows.map((r) => `  (${cols.map((c) => quote(r[c])).join(', ')})`).join(',\n') + ' ON CONFLICT DO NOTHING;')
  })
  parts.push('COMMIT;')
  return parts.join('\n')
}

/* ------------------------------ REST helpers ------------------------------ */

const headers = (cfg: CloudConfig, extra: Record<string, string> = {}) => {
  const key = cfg.key.trim()
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', ...extra }
  // Mã thiết bị: RLS trong Postgres đọc header này để cho phép ghi (xem docs/sql/rls.sql)
  const token = (cfg.token ?? '').trim()
  if (token) h['x-sync-token'] = token
  // Key legacy (JWT eyJ…) gửi thêm Authorization; key mới sb_publishable_… chỉ dùng header apikey
  // (gửi chuỗi không phải JWT vào Authorization sẽ bị PostgREST từ chối 401)
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`
  return h
}

export async function testCloud(cfg: CloudConfig) {
  const started = performance.now()
  if (!cfg.url || !cfg.key) return { ok: false, message: 'Thiếu URL hoặc anon key' }
  try {
    if (!/^https?:\/\//.test(cfg.url.trim())) return { ok: false, message: 'URL phải bắt đầu bằng https:// (ví dụ https://abcdefgh.supabase.co)' }
    // Kiểm tra bằng chính bảng nghiệp vụ: 401/403 = sai key, 404 = đúng key nhưng chưa tạo bảng
    const probe = await fetch(`${normUrl(cfg.url)}/rest/v1/branches?select=id&limit=1`, { headers: headers(cfg), signal: AbortSignal.timeout(15000) })
    const latency = Math.round(performance.now() - started)
    if (probe.status === 401 || probe.status === 403) {
      return { ok: false, message: `Key không hợp lệ hoặc thiếu quyền (HTTP ${probe.status}) — kiểm tra lại anon key`, latency }
    }
    if (probe.status === 404) {
      const body = await probe.text()
      if (/PGRST205|does not exist|schema cache/i.test(body)) {
        return { ok: true, message: 'Kết nối được (key hợp lệ), nhưng chưa có bảng — hãy chạy file schema.sql trước', latency }
      }
      return { ok: false, message: `Không tìm thấy REST API (HTTP 404) — kiểm tra URL`, latency }
    }
    if (!probe.ok) return { ok: false, message: `Bảng branches lỗi HTTP ${probe.status}`, latency }
    const rows = await probe.json()
    const count = Array.isArray(rows) ? rows.length : 0
    const base = count > 0 ? 'Kết nối tốt · bảng branches đã có dữ liệu' : 'Kết nối tốt · bảng branches đã tạo nhưng còn trống — hãy bấm “Đẩy dữ liệu lên”'
    // Kiểm tra quyền GHI qua RPC sync_ok() (không ghi dữ liệu rác).
    //  true  = mã đồng bộ hợp lệ  ·  false = cloud bật RLS mà mã sai/thiếu  ·  404 = chưa chạy rls.sql
    let write = ''
    try {
      const w = await fetch(`${normUrl(cfg.url)}/rest/v1/rpc/sync_ok`, {
        method: 'POST',
        headers: headers(cfg),
        body: '{}',
        signal: AbortSignal.timeout(15000),
      })
      if (w.ok) {
        const val = await w.json().catch(() => null)
        if (val === true) write = ' · quyền ghi: OK'
        else if (val === false) {
          return {
            ok: false,
            latency,
            message: 'Đọc được nhưng GHI bị chặn: cloud đã bật RLS. Dán đúng “Mã đồng bộ” ở ô bên dưới (mất mã thì cấp lại bằng SQL — xem docs/huong-dan-supabase.md).',
          }
        }
      } else if (w.status === 404) {
        write = ' · chưa bật RLS (ai có anon key cũng ghi được — nên chạy rls.sql)'
      } else if (w.status === 401 || w.status === 403) {
        write = ' · không kiểm tra được quyền ghi'
      }
    } catch { /* chỉ là kiểm tra phụ */ }
    return { ok: true, message: base + write, latency }
  } catch (e) {
    return { ok: false, message: `Không kết nối được: ${(e as Error).message}` }
  }
}

/** Lỗi ghi bị RLS chặn → chỉ dẫn cụ thể cho người dùng. */
const writeError = (table: string, status: number, body: string) => {
  if (status === 401 || status === 403 || /row-level security|permission denied/i.test(body)) {
    return `Bị chặn ghi ở bảng ${table}: cloud đã bật RLS nhưng mã đồng bộ (x-sync-token) sai hoặc chưa nhập. Vào Cài đặt → Cơ sở dữ liệu → dán "Mã đồng bộ" rồi thử lại.`
  }
  return `Ghi ${table} thất bại: HTTP ${status} ${body.slice(0, 160)}`
}

/** Đếm số dòng mỗi bảng trên cloud (HEAD + count=exact) — dùng cho màn "Đối chiếu máy này ↔ cloud". */
export async function cloudCounts(cfg: CloudConfig): Promise<Record<string, number>> {
  const base = normUrl(cfg.url)
  const out: Record<string, number> = {}
  await Promise.all(SYNC_ORDER.map(async (t) => {
    try {
      const res = await fetch(`${base}/rest/v1/${t}?select=*`, {
        method: 'HEAD',
        headers: headers(cfg, { Prefer: 'count=exact', Range: '0-0' }),
        signal: AbortSignal.timeout(15000),
      })
      const cr = res.headers.get('content-range') ?? ''
      const total = Number(cr.split('/')[1] ?? 0)
      out[t] = Number.isFinite(total) ? total : 0
    } catch { out[t] = -1 }
  }))
  return out
}

export interface SyncProgress { table: string; index: number; total: number; rows: number; done?: boolean }

/**
 * Đẩy dữ liệu cục bộ lên Postgres.
 *  • mode 'merge' (mặc định): UPSERT theo khoá chính — an toàn, không bao giờ làm mất dữ liệu
 *    trên cloud nếu mạng đứt giữa chừng.
 *  • mode 'replace': xoá sạch (con → cha) rồi nạp lại — dùng khi muốn cloud khớp 100% với máy.
 */
export async function pushAll(cfg: CloudConfig, onProgress?: (p: SyncProgress) => void, mode: 'merge' | 'replace' = 'merge') {
  const base = normUrl(cfg.url)
  const meta = (name: string) => TABLES.find((t) => t.name === name) ?? { name, label: name }
  const steps = mode === 'replace' ? SYNC_ORDER.length * 2 : SYNC_ORDER.length

  if (mode === 'replace') {
    for (let i = 0; i < SYNC_ORDER.length; i++) {
      const name = SYNC_ORDER[SYNC_ORDER.length - 1 - i]
      onProgress?.({ table: `xoá ${name}`, index: i + 1, total: steps, rows: 0 })
      const res = await fetch(`${base}/rest/v1/${name}?${pkOf(name)}=not.is.null`, { method: 'DELETE', headers: headers(cfg) })
      if (!res.ok && res.status !== 404) {
        throw new Error(writeError(name, res.status, await res.text()))
      }
    }
  }

  let total = 0
  for (let i = 0; i < SYNC_ORDER.length; i++) {
    const t = meta(SYNC_ORDER[i])
    const rows = all<Record<string, unknown>>(`SELECT * FROM ${t.name}`)
    const index = (mode === 'replace' ? SYNC_ORDER.length : 0) + i + 1
    onProgress?.({ table: t.name, index, total: steps, rows: rows.length })
    if (!rows.length) continue
    const onConflict = pkCols(t.name).join(',')
    const chunk = 200
    for (let c = 0; c < rows.length; c += chunk) {
      const slice = rows.slice(c, c + chunk)
      const res = await fetch(`${base}/rest/v1/${t.name}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: headers(cfg, { Prefer: 'return=minimal,resolution=merge-duplicates' }),
        body: JSON.stringify(slice),
      })
      if (!res.ok) throw new Error(writeError(t.name, res.status, await res.text()))
      total += slice.length
    }
  }

  onProgress?.({ table: 'xong', index: steps, total: steps, rows: total, done: true })
  saveCloud({ ...cfg, lastSync: new Date().toISOString(), lastRows: total })
  return { rows: total }
}

/**
 * Kéo dữ liệu từ Postgres về máy.
 * AN TOÀN: tải đủ TẤT CẢ các bảng vào bộ nhớ trước, rồi mới xoá & ghi đè trong MỘT
 * transaction. Nếu mạng/quyền lỗi giữa chừng → dữ liệu trên máy giữ nguyên
 * (bản cũ xoá trước rồi tải sau, hỏng giữa chừng là mất sạch dữ liệu máy).
 */
export async function pullAll(cfg: CloudConfig, onProgress?: (p: SyncProgress) => void) {
  const base = normUrl(cfg.url)
  const PAGE = 500 // PostgREST giới hạn số dòng mỗi request → phân trang bằng Range
  const meta = (name: string) => TABLES.find((t) => t.name === name) ?? { name, label: name }
  const plan: { table: string; rows: Record<string, unknown>[] }[] = []
  let total = 0

  // 1) Tải về bộ nhớ
  for (let i = 0; i < SYNC_ORDER.length; i++) {
    const t = meta(SYNC_ORDER[i])
    const orderBy = pkCols(t.name).map((c) => `${c}.asc`).join(',')
    const rows: Record<string, unknown>[] = []
    for (let from = 0; from < 200000; from += PAGE) {
      const res = await fetch(`${base}/rest/v1/${t.name}?select=*&order=${orderBy}`, {
        headers: headers(cfg, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) {
        if (res.status === 404 && from === 0) break // bảng chưa tạo → bỏ qua
        const body = (await res.text()).slice(0, 140)
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Không đọc được bảng ${t.name} (HTTP ${res.status}): cloud đã bật RLS và "Mã đồng bộ" sai hoặc chưa nhập. Dữ liệu trên máy vẫn giữ nguyên.`)
        }
        throw new Error(`Đọc ${t.name} thất bại: HTTP ${res.status} ${body}`)
      }
      const batch = (await res.json()) as Record<string, unknown>[]
      rows.push(...batch)
      onProgress?.({ table: t.name, index: i + 1, total: SYNC_ORDER.length, rows: rows.length })
      if (batch.length < PAGE) break
    }
    plan.push({ table: t.name, rows })
    total += rows.length
  }

  // 2) Chốt an toàn: RLS chặn đọc trả về 0 dòng (không phải lỗi HTTP) ⇒ tuyệt đối không xoá dữ liệu máy
  const branchRows = plan.find((p) => p.table === 'branches')?.rows.length ?? 0
  if (branchRows === 0) {
    const tWarn = tokenWarning(cfg.token)
    throw new Error(
      tWarn
        ? `Không tải được: ${tWarn} → cloud chặn đọc (0 dòng ở "branches"). Dữ liệu trên máy vẫn giữ nguyên.`
        : 'Cloud trả về 0 dòng ở bảng "branches": mã đồng bộ sai/không khớp với Postgres, hoặc cloud chưa có dữ liệu. Bấm "Kiểm tra mã đồng bộ" ở Cài đặt → Cơ sở dữ liệu. Dữ liệu trên máy vẫn giữ nguyên.',
    )
  }

  // 3) Xoá + ghi đè trong MỘT transaction (lỗi là rollback toàn bộ)
  //    Bảng cấu hình (roles/app_meta) mà cloud rỗng thì GIỮ dữ liệu trên máy —
  //    tránh trường hợp máy mất sạch vai trò/phân quyền sau khi đồng bộ.
  const planMap = new Map(plan.map((p) => [p.table, p.rows]))
  // Bảng nào cloud trả 0 dòng thì GIỮ NGUYÊN dữ liệu trên máy (không bao giờ xoá trắng vì cloud thiếu bảng/cột)
  const keepLocal = new Set(SYNC_ORDER.filter((t) => (planMap.get(t)?.length ?? 0) === 0))
  const statements: { sql: string; params: SqlValue[] }[] = []
  for (const name of [...SYNC_ORDER].reverse()) {
    if (keepLocal.has(name)) continue
    statements.push({ sql: `DELETE FROM ${name}`, params: [] })
  }
  for (const { table, rows } of plan) {
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    for (const r of rows) {
      statements.push({
        sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        params: cols.map((c) => {
          const v = r[c]
          if (typeof v === 'boolean') return v ? 1 : 0
          if (v && typeof v === 'object') return JSON.stringify(v)
          return (v ?? null) as SqlValue
        }),
      })
    }
  }
  withSystemWrite(() => runMany(statements))

  saveCloud({ ...cfg, lastSync: new Date().toISOString(), lastRows: total })
  onProgress?.({ table: 'xong', index: SYNC_ORDER.length, total: SYNC_ORDER.length, rows: total, done: true })
  return { rows: total, results: plan.map((p) => ({ table: p.table, rows: p.rows.length })) }
}

/** Đếm nhanh số dòng từng bảng để hiển thị trạng thái. */
export function localCounts() {
  return TABLES.map((t) => ({ table: t.name, label: t.label, rows: scalar<number>(`SELECT COUNT(*) FROM ${t.name}`) ?? 0 }))
}

/** Mã hiện tại có quyền GHI không? (link chia sẻ "chỉ xem" sẽ trả false) */
/** Server trả lời: mã trên máy có hợp lệ không (đọc được) và có quyền ghi không. */
export async function tokenPermission(cfg: CloudConfig): Promise<{ valid: boolean | null; write: boolean | null }> {
  if (!cfg.url || !cfg.key) return { valid: null, write: null }
  const call = async (fn: string) => {
    try {
      const res = await fetch(`${normUrl(cfg.url)}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: headers(cfg), body: '{}', signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) return null
      return (await res.json().catch(() => null)) === true
    } catch { return null }
  }
  const [valid, write] = await Promise.all([call('sync_ok'), call('sync_write_ok')])
  return { valid, write }
}

/** Kiểm tra lại quyền ghi và cập nhật trạng thái chỉ-đọc NGAY (không cần tải lại trang). */
export async function refreshWritePermission(): Promise<boolean | null> {
  const can = await checkWritePermission(loadCloud())
  setReadOnlyMode(can === false)
  window.dispatchEvent(new CustomEvent('matcha:readonly', { detail: can === false }))
  return can
}

export async function checkWritePermission(cfg: CloudConfig): Promise<boolean | null> {
  if (!cfg.url || !cfg.key) return null
  try {
    const res = await fetch(`${normUrl(cfg.url)}/rest/v1/rpc/sync_write_ok`, {
      method: 'POST', headers: headers(cfg), body: '{}', signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const val = await res.json().catch(() => null)
    return val === true
  } catch { return null }
}
