/** Truy vấn phân tích: dashboard, báo cáo, Data Explorer, ERP Simulator. */
import { all, one, scalar, run, getDb } from './db'
import { todayVN, addDays } from './format'
import { TABLES, COLUMN_META, FK_EDGES } from './schema'

const branchCond = (branchId?: number | 'all') => (branchId && branchId !== 'all' ? `AND o.branch_id = ${branchId}` : '')

/* ------------------------------- KPIs --------------------------------- */
export interface KpiSet {
  revenue: number; orders: number; aov: number; cogs: number; grossProfit: number; margin: number
  customers: number; items: number; discount: number; cancelled: number
}
export function kpis(from: string, to: string, branchId?: number | 'all'): KpiSet {
  const r = one<any>(
    `SELECT COALESCE(SUM(o.total),0) AS revenue, COUNT(*) AS orders, COALESCE(SUM(o.cogs),0) AS cogs,
            COALESCE(SUM(o.subtotal - o.total + o.vat_amount + o.delivery_fee),0) AS discount,
            COUNT(DISTINCT o.customer_id) AS customers,
            COALESCE((SELECT SUM(qty) FROM order_items oi JOIN orders o2 ON o2.id = oi.order_id
              WHERE o2.status != 'cancelled' AND date(o2.created_at) BETWEEN ? AND ? ${branchId && branchId !== 'all' ? `AND o2.branch_id = ${branchId}` : ''}),0) AS items
     FROM orders o WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}`,
    [from, to, from, to],
  )
  const cancelled = scalar<number>(
    `SELECT COUNT(*) FROM orders o WHERE o.status = 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}`,
    [from, to],
  ) ?? 0
  const revenue = Number(r.revenue)
  const cogs = Number(r.cogs)
  return {
    revenue, orders: Number(r.orders), aov: Number(r.orders) ? Math.round(revenue / Number(r.orders)) : 0,
    cogs, grossProfit: revenue - cogs, margin: revenue ? (revenue - cogs) / revenue : 0,
    customers: Number(r.customers), items: Number(r.items), discount: Math.max(0, Number(r.discount)), cancelled,
  }
}

export function revenueSeries(days: number, branchId?: number | 'all') {
  const to = todayVN()
  const from = addDays(to, -(days - 1))
  const rows = all<{ d: string; revenue: number; orders: number; cogs: number }>(
    `SELECT date(o.created_at) AS d, SUM(o.total) AS revenue, COUNT(*) AS orders, SUM(o.cogs) AS cogs
     FROM orders o WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}
     GROUP BY d ORDER BY d`, [from, to],
  )
  const map = new Map(rows.map((r) => [r.d, r]))
  const out: { date: string; label: string; revenue: number; orders: number; profit: number }[] = []
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i)
    const row = map.get(d)
    out.push({
      date: d, label: d.slice(8, 10) + '/' + d.slice(5, 7),
      revenue: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0),
      profit: Number(row?.revenue ?? 0) - Number(row?.cogs ?? 0),
    })
  }
  return out
}

export function byHour(from: string, to: string, branchId?: number | 'all') {
  return all<{ hour: number; revenue: number; orders: number }>(
    `SELECT CAST(strftime('%H', o.created_at) AS INTEGER) AS hour, SUM(o.total) AS revenue, COUNT(*) AS orders
     FROM orders o WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}
     GROUP BY hour ORDER BY hour`, [from, to],
  ).map((r) => ({ ...r, revenue: Number(r.revenue), orders: Number(r.orders) }))
}

export function byChannel(from: string, to: string, branchId?: number | 'all') {
  return all<{ channel: string; source: string; revenue: number; orders: number }>(
    `SELECT o.channel, o.source, SUM(o.total) AS revenue, COUNT(*) AS orders
     FROM orders o WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}
     GROUP BY o.channel, o.source ORDER BY revenue DESC`, [from, to],
  ).map((r) => ({ ...r, revenue: Number(r.revenue), orders: Number(r.orders) }))
}

export function byBranch(from: string, to: string) {
  return all<{ id: number; name: string; revenue: number; orders: number; cogs: number }>(
    `SELECT b.id, b.name, COALESCE(SUM(o.total),0) AS revenue, COUNT(o.id) AS orders, COALESCE(SUM(o.cogs),0) AS cogs
     FROM branches b LEFT JOIN orders o ON o.branch_id = b.id AND o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ?
     GROUP BY b.id ORDER BY revenue DESC`, [from, to],
  ).map((r) => ({ ...r, revenue: Number(r.revenue), orders: Number(r.orders), cogs: Number(r.cogs) }))
}

export function topProducts(from: string, to: string, limit = 10, branchId?: number | 'all') {
  return all<{ product_id: number; product_name: string; qty: number; revenue: number; cogs: number; profit: number }>(
    `SELECT oi.product_id, oi.product_name, SUM(oi.qty) AS qty, SUM(oi.unit_price * oi.qty - oi.discount) AS revenue,
            SUM(oi.unit_cost * oi.qty) AS cogs
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}
     GROUP BY oi.product_id ORDER BY qty DESC LIMIT ${limit}`, [from, to],
  ).map((r) => ({ ...r, qty: Number(r.qty), revenue: Number(r.revenue), cogs: Number(r.cogs), profit: Number(r.revenue) - Number(r.cogs) }))
}

export function byCategory(from: string, to: string, branchId?: number | 'all') {
  return all<{ name: string; emoji: string; qty: number; revenue: number }>(
    `SELECT c.name, c.emoji, SUM(oi.qty) AS qty, SUM(oi.unit_price * oi.qty) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}
     GROUP BY c.id ORDER BY revenue DESC`, [from, to],
  ).map((r) => ({ ...r, qty: Number(r.qty), revenue: Number(r.revenue) }))
}

export function paymentBreakdown(from: string, to: string, branchId?: number | 'all') {
  return all<{ method: string; amount: number; count: number }>(
    `SELECT p.method, SUM(p.amount) AS amount, COUNT(*) AS count FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}
     GROUP BY p.method ORDER BY amount DESC`, [from, to],
  ).map((r) => ({ ...r, amount: Number(r.amount), count: Number(r.count) }))
}

/* --------------------------- P&L / tài chính -------------------------- */
export function pnl(from: string, to: string, branchId?: number | 'all') {
  const revenue = scalar<number>(
    `SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}`,
    [from, to]) ?? 0
  const cogs = scalar<number>(
    `SELECT COALESCE(SUM(o.cogs),0) FROM orders o WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}`,
    [from, to]) ?? 0
  const expenses = all<{ category: string; amount: number }>(
    `SELECT category, SUM(amount) AS amount FROM finance_entries
     WHERE type = 'expense' AND entry_date BETWEEN ? AND ? ${branchId && branchId !== 'all' ? `AND branch_id = ${branchId}` : ''}
     GROUP BY category ORDER BY amount DESC`, [from, to],
  ).map((r) => ({ ...r, amount: Number(r.amount) }))
  const income = scalar<number>(
    `SELECT COALESCE(SUM(amount),0) FROM finance_entries WHERE type = 'income' AND entry_date BETWEEN ? AND ?
     ${branchId && branchId !== 'all' ? `AND branch_id = ${branchId}` : ''}`, [from, to]) ?? 0
  // chi phí nhập hàng đã nằm trong COGS theo công thức → loại khỏi chi phí vận hành để tránh đếm 2 lần
  const opExpenses = expenses.filter((e) => e.category !== 'purchase')
  const opTotal = opExpenses.reduce((s, e) => s + e.amount, 0)
  return {
    revenue, cogs, grossProfit: revenue - cogs, grossMargin: revenue ? (revenue - cogs) / revenue : 0,
    opExpenses, opTotal, otherIncome: income,
    netProfit: revenue - cogs - opTotal + income,
    netMargin: revenue ? (revenue - cogs - opTotal + income) / revenue : 0,
  }
}

export function inventoryValue(branchId?: number | 'all') {
  return scalar<number>(
    `SELECT COALESCE(SUM(s.qty * s.avg_cost),0) FROM inventory_stock s
     ${branchId && branchId !== 'all' ? `WHERE s.branch_id = ${branchId}` : ''}`,
  ) ?? 0
}

export function stockAlerts(branchId?: number | 'all') {
  return all<{ id: number; name: string; unit: string; qty: number; min_stock: number; branch_name: string; ratio: number }>(
    `SELECT i.id, i.name, i.unit, s.qty, i.min_stock, b.name AS branch_name, (s.qty / NULLIF(i.min_stock,0)) AS ratio
     FROM inventory_stock s JOIN ingredients i ON i.id = s.ingredient_id JOIN branches b ON b.id = s.branch_id
     WHERE s.qty < i.min_stock ${branchId && branchId !== 'all' ? `AND s.branch_id = ${branchId}` : ''}
     ORDER BY ratio ASC LIMIT 50`,
  ).map((r) => ({ ...r, qty: Number(r.qty), ratio: Number(r.ratio) }))
}

/* --------------------------- Báo cáo chi tiết ------------------------- */
export function reportByProduct(from: string, to: string, branchId?: number | 'all') {
  return all<any>(
    `SELECT oi.product_name AS "Sản phẩm", p.sku AS "Mã", c.name AS "Danh mục", SUM(oi.qty) AS "Số ly",
            SUM(oi.unit_price * oi.qty) AS "Doanh thu", SUM(oi.unit_cost * oi.qty) AS "Giá vốn"
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ? ${branchCond(branchId)}
     GROUP BY oi.product_id ORDER BY "Doanh thu" DESC`, [from, to],
  ).map((r) => ({ ...r, 'Lợi nhuận': Number(r['Doanh thu']) - Number(r['Giá vốn']), 'Biên LN': Number(r['Doanh thu']) ? Number((Number(r['Doanh thu']) - Number(r['Giá vốn'])) / Number(r['Doanh thu'])) : 0 }))
}

export function promotionEffectiveness(from: string, to: string) {
  return all<any>(
    `SELECT COALESCE(v.code, 'CTKM tự động') AS "Khuyến mãi", COUNT(o.id) AS "Số đơn",
            COALESCE(SUM(o.voucher_discount + o.promotion_discount),0) AS "Tổng giảm",
            COALESCE(SUM(o.total),0) AS "Doanh thu mang lại"
     FROM orders o LEFT JOIN vouchers v ON v.id = o.voucher_id
     WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ?
     AND (o.voucher_id IS NOT NULL OR o.promotion_discount > 0)
     GROUP BY o.voucher_id ORDER BY "Doanh thu mang lại" DESC`, [from, to],
  )
}

export function shiftReport(branchId: number, limit = 20) {
  return all<any>(
    `SELECT s.id, s.opened_at AS "Mở ca", s.closed_at AS "Chốt ca", u.name AS "Thu ngân",
            COUNT(o.id) AS "Số đơn", COALESCE(SUM(o.total),0) AS "Doanh thu",
            s.opening_cash AS "Tiền đầu ca", s.expected_cash AS "Lý thuyết", s.counted_cash AS "Kiểm đếm", s.variance AS "Chênh lệch", s.status AS "Trạng thái"
     FROM shifts s LEFT JOIN users u ON u.id = s.user_id
     LEFT JOIN orders o ON o.shift_id = s.id AND o.status != 'cancelled'
     WHERE s.branch_id = ? GROUP BY s.id ORDER BY s.opened_at DESC LIMIT ${limit}`, [branchId],
  )
}

/* ============================ DATA EXPLORER ============================ */
export interface TableStat { name: string; label: string; module: string; icon: string; description: string; rows: number; bytes: number; columns: number }

export function tableStats(): TableStat[] {
  const db = getDb()
  return TABLES.map((t) => {
    let rows = 0
    try { rows = scalar<number>(`SELECT COUNT(*) FROM "${t.name}"`) ?? 0 } catch { rows = 0 }
    const cols = COLUMN_META[t.name]?.length ?? 0
    const sample = db.exec(`SELECT * FROM "${t.name}" LIMIT 40`)
    let bytes = rows * 90
    if (sample[0]?.values.length) {
      const json = JSON.stringify(sample[0].values)
      bytes = Math.round((json.length / sample[0].values.length) * rows * 1.15)
    }
    return { ...t, rows, bytes, columns: cols }
  }).sort((a, b) => b.rows - a.rows)
}

export interface ColumnInfo { name: string; type: string; notnull: number; dflt: string | null; pk: number }
export function tableSchema(table: string) {
  const info = all<any>(`PRAGMA table_info("${table}")`).map((c) => ({
    name: c.name as string, type: c.type as string, notnull: c.notnull as number, dflt: c.dflt as string | null, pk: c.pk as number,
  })) as ColumnInfo[]
  const fks = all<any>(`PRAGMA foreign_key_list("${table}")`).map((f) => ({ from: f.from as string, table: f.table as string, to: f.to as string }))
  const indexes = all<any>(`PRAGMA index_list("${table}")`).map((i) => ({
    name: i.name as string, unique: i.unique as number,
    columns: all<any>(`PRAGMA index_info("${i.name}")`).map((c) => c.name as string),
  }))
  const meta = COLUMN_META[table] ?? []
  return info.map((c) => {
    const fk = fks.find((f) => f.from === c.name)
    const m = meta.find((x) => x.name === c.name)
    return {
      ...c, pk: c.pk > 0, fk: fk ? { table: fk.table, column: fk.to } : null,
      unique: indexes.some((i) => i.unique && i.columns.length === 1 && i.columns[0] === c.name),
      indexed: indexes.some((i) => i.columns[0] === c.name),
      description: m?.description ?? '',
    }
  })
}

export function primaryKeyOf(table: string): string | null {
  const cols = all<any>(`PRAGMA table_info("${table}")`)
  const pk = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk)
  return pk.length ? (pk[0].name as string) : null
}

export interface GridQuery {
  table: string
  page?: number
  pageSize?: number
  search?: string
  sort?: string
  dir?: 'asc' | 'desc'
  filters?: Record<string, string>
}
export function gridRows({ table, page = 1, pageSize = 50, search, sort, dir = 'asc', filters = {} }: GridQuery) {
  const pk = primaryKeyOf(table)
  const where: string[] = []
  const params: any[] = []
  if (search) {
    const cols = all<any>(`PRAGMA table_info("${table}")`).map((c) => c.name as string)
    where.push('(' + cols.map((c) => `CAST("${c}" AS TEXT) LIKE ?`).join(' OR ') + ')')
    cols.forEach(() => params.push(`%${search}%`))
  }
  Object.entries(filters).forEach(([col, val]) => {
    if (!val) return
    where.push(`CAST("${col}" AS TEXT) LIKE ?`)
    params.push(`%${val}%`)
  })
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const orderSql = sort ? `ORDER BY "${sort}" ${dir === 'desc' ? 'DESC' : 'ASC'}` : pk ? `ORDER BY "${pk}" ASC` : ''
  const total = scalar<number>(`SELECT COUNT(*) FROM "${table}" ${whereSql}`, params) ?? 0
  const rows = all<any>(`SELECT * FROM "${table}" ${whereSql} ${orderSql} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params)
  const columns = all<any>(`PRAGMA table_info("${table}")`).map((c) => ({ name: c.name as string, type: c.type as string, pk: c.pk > 0 }))
  return { rows, total, columns, pk }
}

export function rowByPk(table: string, pk: string, value: string | number) {
  return one<any>(`SELECT * FROM "${table}" WHERE "${pk}" = ?`, [value])
}

/** Các bản ghi con trỏ tới bản ghi này (quan hệ cha–con). */
export function relatedRecords(table: string, pk: string, value: string | number) {
  const result: { table: string; label: string; column: string; count: number }[] = []
  FK_EDGES.filter((e) => e.to === table).forEach((e) => {
    const count = scalar<number>(`SELECT COUNT(*) FROM "${e.from}" WHERE "${e.fromCol}" = ?`, [value]) ?? 0
    if (count > 0) {
      const meta = TABLES.find((t) => t.name === e.from)
      result.push({ table: e.from, label: meta?.label ?? e.from, column: e.fromCol, count })
    }
  })
  return result.sort((a, b) => b.count - a.count)
}

/** Chỉnh sửa trực tiếp một ô (chế độ chuyên gia) + audit log. */
export function updateCell(table: string, pk: string, pkValue: string | number, column: string, value: string | number | null, userId: number) {
  const before = rowByPk(table, pk, pkValue)
  run(`UPDATE "${table}" SET "${column}" = ? WHERE "${pk}" = ?`, [value, pkValue])
  run(`INSERT INTO audit_logs (user_id, action, entity, entity_id, before_value, after_value, created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))`,
    [userId, 'expert_edit', table, String(pkValue), JSON.stringify({ [column]: before?.[column] }), JSON.stringify({ [column]: value })], { silent: true })
}

export const SAMPLE_QUERIES: { name: string; sql: string }[] = [
  { name: 'Doanh thu 14 ngày gần nhất', sql: `SELECT date(created_at) AS ngay,\n       COUNT(*) AS so_don,\n       SUM(total) AS doanh_thu\nFROM orders\nWHERE status != 'cancelled'\nGROUP BY ngay\nORDER BY ngay DESC\nLIMIT 14;` },
  { name: 'Top 10 món bán chạy (30 ngày)', sql: `SELECT oi.product_name, SUM(oi.qty) AS so_ly,\n       SUM(oi.unit_price * oi.qty) AS doanh_thu\nFROM order_items oi\nJOIN orders o ON o.id = oi.order_id\nWHERE o.status != 'cancelled'\n  AND date(o.created_at) >= date('now','-30 day')\nGROUP BY oi.product_id\nORDER BY so_ly DESC\nLIMIT 10;` },
  { name: 'Nguyên liệu dưới định mức', sql: `SELECT b.name AS chi_nhanh, i.name AS nguyen_lieu,\n       ROUND(s.qty,1) AS ton, i.min_stock AS dinh_muc, i.unit AS don_vi\nFROM inventory_stock s\nJOIN ingredients i ON i.id = s.ingredient_id\nJOIN branches b ON b.id = s.branch_id\nWHERE s.qty < i.min_stock\nORDER BY s.qty / NULLIF(i.min_stock,0)\nLIMIT 30;` },
  { name: 'Doanh thu theo kênh & phương thức', sql: `SELECT o.channel, p.method,\n       COUNT(*) AS so_giao_dich, SUM(p.amount) AS so_tien\nFROM payments p\nJOIN orders o ON o.id = p.order_id\nWHERE o.status != 'cancelled'\nGROUP BY o.channel, p.method\nORDER BY so_tien DESC;` },
  { name: 'Hiệu quả khuyến mãi', sql: `SELECT COALESCE(v.code,'CTKM tự động') AS ma,\n       COUNT(*) AS so_don,\n       SUM(o.voucher_discount + o.promotion_discount) AS tong_giam,\n       SUM(o.total) AS doanh_thu\nFROM orders o\nLEFT JOIN vouchers v ON v.id = o.voucher_id\nWHERE o.voucher_id IS NOT NULL OR o.promotion_discount > 0\nGROUP BY o.voucher_id\nORDER BY doanh_thu DESC;` },
  { name: 'Top khách hàng theo chi tiêu', sql: `SELECT name, phone, tier, points, order_count, total_spent\nFROM customers\nORDER BY total_spent DESC\nLIMIT 15;` },
  { name: 'Cơ cấu chi phí 30 ngày', sql: `SELECT category, SUM(amount) AS so_tien\nFROM finance_entries\nWHERE type = 'expense'\n  AND entry_date >= date('now','-30 day')\nGROUP BY category\nORDER BY so_tien DESC;` },
  { name: 'Sơ đồ quan hệ (đếm bản ghi theo bảng)', sql: `SELECT 'orders' AS bang, COUNT(*) AS so_dong FROM orders\nUNION ALL SELECT 'order_items', COUNT(*) FROM order_items\nUNION ALL SELECT 'payments', COUNT(*) FROM payments\nUNION ALL SELECT 'inventory_txns', COUNT(*) FROM inventory_txns\nUNION ALL SELECT 'customers', COUNT(*) FROM customers;` },
]

/* ============================= ERP SIMULATOR =========================== */
export function erpNodeStats(branchId: number) {
  const today = todayVN()
  const s = (sql: string, params: any[] = []) => { try { return Number(scalar<number>(sql, params) ?? 0) } catch { return 0 } }
  return {
    suppliers: s('SELECT COUNT(*) FROM suppliers'),
    supplierDebt: s('SELECT COALESCE(SUM(debt),0) FROM suppliers'),
    poDraft: s(`SELECT COUNT(*) FROM purchase_orders WHERE status IN ('draft','ordered')`),
    poReceived: s(`SELECT COUNT(*) FROM purchase_orders WHERE status = 'received'`),
    stockValue: s('SELECT COALESCE(SUM(qty*avg_cost),0) FROM inventory_stock WHERE branch_id = ?', [branchId]),
    lowStock: s('SELECT COUNT(*) FROM inventory_stock s JOIN ingredients i ON i.id=s.ingredient_id WHERE s.branch_id = ? AND s.qty < i.min_stock', [branchId]),
    recipes: s('SELECT COUNT(*) FROM recipes'),
    ingredients: s('SELECT COUNT(*) FROM ingredients'),
    ordersToday: s('SELECT COUNT(*) FROM orders WHERE branch_id = ? AND date(created_at) = ?', [branchId, today]),
    inProgress: s(`SELECT COUNT(*) FROM orders WHERE branch_id = ? AND status IN ('pending','preparing','ready')`, [branchId]),
    revenueToday: s(`SELECT COALESCE(SUM(total),0) FROM orders WHERE branch_id = ? AND date(created_at) = ? AND status != 'cancelled'`, [branchId, today]),
    paymentsToday: s(`SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.branch_id = ? AND date(o.created_at) = ? AND o.status != 'cancelled'`, [branchId, today]),
    customers: s('SELECT COUNT(*) FROM customers'),
    pointsLiability: s('SELECT COALESCE(SUM(points),0) FROM customers'),
    vouchersActive: s('SELECT COUNT(*) FROM vouchers WHERE is_active = 1'),
    promoActive: s('SELECT COUNT(*) FROM promotions WHERE is_active = 1'),
    financeEntries: s(`SELECT COUNT(*) FROM finance_entries WHERE date(entry_date) >= date(?, '-30 day')`, [today]),
    expenses30: s(`SELECT COALESCE(SUM(amount),0) FROM finance_entries WHERE type='expense' AND category != 'purchase' AND entry_date >= date(?, '-30 day')`, [today]),
    revenue30: s(`SELECT COALESCE(SUM(total),0) FROM orders WHERE status != 'cancelled' AND date(created_at) >= date(?, '-30 day')`, [today]),
    cogs30: s(`SELECT COALESCE(SUM(cogs),0) FROM orders WHERE status != 'cancelled' AND date(created_at) >= date(?, '-30 day')`, [today]),
  }
}
