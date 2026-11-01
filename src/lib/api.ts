/** Tầng nghiệp vụ: mọi thao tác đọc/ghi dữ liệu của app đi qua đây. */
import { all, one, run, runMany, scalar, lastInsertId, getDb } from './db'
import { nowVN, parseVN, todayVN } from './format'
import type { Role } from './rbac'

/* ============================== TYPES ================================== */
export interface Branch { id: number; code: string; name: string; address: string; city: string; phone: string; vat_rate: number; is_active: number }
export interface User { id: number; name: string; email: string; password: string; role: Role; branch_id: number; phone: string; salary: number; is_active: number; hired_at: string; avatar_emoji: string }
export interface Category { id: number; name: string; slug: string; emoji: string; sort_order: number; is_active: number }
export interface Product {
  id: number; sku: string; name: string; category_id: number; description: string; base_price: number; cost_price: number
  unit: string; emoji: string; image_url: string | null; is_active: number; is_bestseller: number; has_size: number
  sugar_option: number; ice_option: number; category_name?: string; category_emoji?: string
}
export interface Topping { id: number; name: string; price: number; unit: string; is_active: number }
export interface Ingredient {
  id: number; sku: string; name: string; category: string; unit: string; unit_cost: number; min_stock: number
  supplier_id: number | null; shelf_life_days: number | null; is_active: number; supplier_name?: string
}
export interface StockRow { branch_id: number; ingredient_id: number; qty: number; avg_cost: number; updated_at: string; name: string; unit: string; min_stock: number; category: string }
export interface Order {
  id: number; code: string; branch_id: number; channel: string; source: string; table_id: number | null
  customer_id: number | null; cashier_id: number | null; shift_id: number | null; queue_no: number | null
  status: string; subtotal: number; item_discount: number; promotion_discount: number; voucher_id: number | null
  voucher_discount: number; vat_amount: number; delivery_fee: number; points_used: number; points_earned: number
  total: number; cogs: number; note: string | null; cancel_reason: string | null
  created_at: string; preparing_at: string | null; ready_at: string | null; completed_at: string | null
  customer_name?: string; customer_phone?: string; cashier_name?: string; table_name?: string; branch_name?: string
  item_count?: number
}
export interface OrderItem {
  id: number; order_id: number; product_id: number; product_name: string; size_code: string; sugar_level: number
  ice_level: number; qty: number; unit_price: number; discount: number; unit_cost: number; note: string | null
  toppings?: { topping_name: string; qty: number; price: number }[]
}
export interface Customer {
  id: number; code: string; name: string; phone: string; email: string | null; birthday: string | null
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'; points: number; total_spent: number; order_count: number
  note: string | null; created_at: string
}
export interface Voucher {
  id: number; code: string; name: string; campaign: string | null; type: 'percent' | 'fixed'; value: number
  min_order: number; max_discount: number | null; usage_limit: number | null; used_count: number
  tier_required: string | null; start_at: string; end_at: string; is_active: number
}
export interface Supplier { id: number; code: string; name: string; contact_name: string; phone: string; email: string; address: string; debt: number; payment_terms: string }
export interface PurchaseOrder {
  id: number; code: string; supplier_id: number; branch_id: number; status: string; subtotal: number; vat: number
  total: number; note: string | null; created_by: number | null; created_at: string; received_at: string | null
  supplier_name?: string; branch_name?: string; item_count?: number
}
export interface Shift {
  id: number; branch_id: number; user_id: number; opened_at: string; closed_at: string | null; opening_cash: number
  cash_in: number; cash_out: number; counted_cash: number | null; expected_cash: number | null; variance: number | null
  status: string; note: string | null; user_name?: string
}

/* ============================ MASTER DATA ============================== */
export const getBranches = () => all<Branch>('SELECT * FROM branches ORDER BY id')
export const getBranch = (id: number) => one<Branch>('SELECT * FROM branches WHERE id = ?', [id])
export const getUsers = () =>
  all<User & { branch_name: string }>(
    `SELECT u.*, b.name AS branch_name FROM users u LEFT JOIN branches b ON b.id = u.branch_id ORDER BY u.id`,
  )
export const getUserByEmail = (email: string) => one<User>('SELECT * FROM users WHERE lower(email) = lower(?) AND is_active = 1', [email])
export const getStaffOfBranch = (branchId: number) =>
  all<User>('SELECT * FROM users WHERE branch_id = ? AND is_active = 1 ORDER BY role, name', [branchId])

export const getCategories = () => all<Category>('SELECT * FROM categories ORDER BY sort_order')
export const getProducts = (opts: { branchId?: number } = {}) =>
  all<Product>(
    `SELECT p.*, c.name AS category_name, c.emoji AS category_emoji
     FROM products p JOIN categories c ON c.id = p.category_id
     ORDER BY c.sort_order, p.name`,
  )
export const getToppings = () => all<Topping>('SELECT * FROM toppings WHERE is_active = 1 ORDER BY id')
export const getProductToppings = (productId: number) =>
  all<Topping>(
    `SELECT t.* FROM toppings t JOIN product_toppings pt ON pt.topping_id = t.id
     WHERE pt.product_id = ? AND t.is_active = 1 ORDER BY t.id`,
    [productId],
  )
export const getProductSizes = (productId: number) =>
  all<{ code: string; name: string; price_delta: number }>(
    'SELECT code, name, price_delta FROM product_sizes WHERE product_id = ? ORDER BY price_delta',
    [productId],
  )

export function updateProduct(id: number, patch: Partial<Product>) {
  const cols = Object.keys(patch)
  if (!cols.length) return
  run(`UPDATE products SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => (patch as any)[c]), id])
}
export function createProduct(p: { name: string; category_id: number; base_price: number; emoji: string; description?: string }) {
  const sku = `SP${String((scalar<number>('SELECT COUNT(*) FROM products') ?? 0) + 1).padStart(3, '0')}`
  run(
    `INSERT INTO products (sku, name, category_id, description, base_price, cost_price, emoji, is_active, has_size, sugar_option, ice_option, created_at)
     VALUES (?,?,?,?,?,0,?,1,1,1,1,?)`,
    [sku, p.name, p.category_id, p.description ?? null, p.base_price, p.emoji, nowVN()],
  )
  const id = lastInsertId()
  ;[['S', 'Size S', -4000], ['M', 'Size M', 0], ['L', 'Size L', 6000]].forEach(([code, name, delta]) =>
    run('INSERT INTO product_sizes (product_id, code, name, price_delta) VALUES (?,?,?,?)', [id, code as string, name as string, delta as number], { silent: true }),
  )
  return id
}

/* ================================ STOCK ================================ */
export function getStock(branchId: number) {
  return all<StockRow>(
    `SELECT s.*, i.name, i.unit, i.min_stock, i.category
     FROM inventory_stock s JOIN ingredients i ON i.id = s.ingredient_id
     WHERE s.branch_id = ? ORDER BY (CAST(s.qty AS REAL) < i.min_stock) DESC, i.name`,
    [branchId],
  )
}
export const getIngredients = () =>
  all<Ingredient & { supplier_name: string }>(
    `SELECT i.*, s.name AS supplier_name FROM ingredients i LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.category, i.name`,
  )
export function lowStock(branchId?: number) {
  const where = branchId ? 'AND s.branch_id = ?' : ''
  return all<StockRow>(
    `SELECT s.*, i.name, i.unit, i.min_stock, i.category, b.name AS branch_name
     FROM inventory_stock s JOIN ingredients i ON i.id = s.ingredient_id JOIN branches b ON b.id = s.branch_id
     WHERE CAST(s.qty AS REAL) < i.min_stock * 1.15 ${where}
     ORDER BY (CAST(s.qty AS REAL) / NULLIF(i.min_stock,0)) ASC LIMIT 40`,
    branchId ? [branchId] : [],
  ) as (StockRow & { branch_name: string })[]
}

export function upsertStock(branchId: number, ingredientId: number, deltaQty: number, unitCost: number) {
  const exists = one<{ qty: number }>('SELECT qty FROM inventory_stock WHERE branch_id = ? AND ingredient_id = ?', [branchId, ingredientId])
  if (exists) {
    run('UPDATE inventory_stock SET qty = ?, avg_cost = ?, updated_at = ? WHERE branch_id = ? AND ingredient_id = ?', [
      Math.round((Number(exists.qty) + deltaQty) * 100) / 100, unitCost, nowVN(), branchId, ingredientId,
    ], { silent: true })
  } else {
    run('INSERT INTO inventory_stock (branch_id, ingredient_id, qty, avg_cost, updated_at) VALUES (?,?,?,?,?)', [
      branchId, ingredientId, Math.round(deltaQty * 100) / 100, unitCost, nowVN(),
    ], { silent: true })
  }
}

export interface StockOpInput {
  branchId: number
  ingredientId: number
  qty: number
  type: 'in' | 'out' | 'waste' | 'adjust'
  note: string
  userId: number
  unitCost?: number
}
export function createStockOp(input: StockOpInput) {
  const ing = one<Ingredient>('SELECT * FROM ingredients WHERE id = ?', [input.ingredientId])!
  const signed = input.type === 'in' ? Math.abs(input.qty) : input.type === 'adjust' ? input.qty : -Math.abs(input.qty)
  runMany([
    {
      sql: `INSERT INTO inventory_txns (branch_id, ingredient_id, txn_type, qty, unit_cost, ref_type, ref_id, note, user_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      params: [input.branchId, input.ingredientId, input.type, signed, input.unitCost ?? ing.unit_cost, 'manual', null, input.note, input.userId, nowVN()],
    },
    {
      sql: `INSERT INTO audit_logs (user_id, action, entity, entity_id, before_value, after_value, created_at) VALUES (?,?,?,?,?,?,?)`,
      params: [input.userId, `stock_${input.type}`, 'inventory_txns', String(input.ingredientId), null, JSON.stringify({ qty: signed, note: input.note }), nowVN()],
    },
  ])
  upsertStock(input.branchId, input.ingredientId, signed, input.unitCost ?? ing.unit_cost)
  getDb().run('SELECT 1')
}

export function transferStock(fromBranch: number, toBranch: number, ingredientId: number, qty: number, userId: number) {
  const ing = one<Ingredient>('SELECT * FROM ingredients WHERE id = ?', [ingredientId])!
  const at = nowVN()
  const refId = (scalar<number>('SELECT COALESCE(MAX(id),0)+1 FROM inventory_txns') ?? 1)
  runMany([
    {
      sql: `INSERT INTO inventory_txns (branch_id, ingredient_id, txn_type, qty, unit_cost, ref_type, ref_id, note, user_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      params: [fromBranch, ingredientId, 'transfer_out', -Math.abs(qty), ing.unit_cost, 'transfers', refId, `Chuyển sang chi nhánh ${toBranch}`, userId, at],
    },
    {
      sql: `INSERT INTO inventory_txns (branch_id, ingredient_id, txn_type, qty, unit_cost, ref_type, ref_id, note, user_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      params: [toBranch, ingredientId, 'transfer_in', Math.abs(qty), ing.unit_cost, 'transfers', refId, `Nhận từ chi nhánh ${fromBranch}`, userId, at],
    },
  ])
  upsertStock(fromBranch, ingredientId, -Math.abs(qty), ing.unit_cost)
  upsertStock(toBranch, ingredientId, Math.abs(qty), ing.unit_cost)
}

export function getStockMovements(branchId: number, limit = 200, ingredientId?: number) {
  const extra = ingredientId ? 'AND t.ingredient_id = ?' : ''
  return all<{ id: number; created_at: string; ingredient_name: string; unit: string; txn_type: string; qty: number; unit_cost: number; note: string; ref_type: string; ref_id: number; user_name: string }>(
    `SELECT t.id, t.created_at, i.name AS ingredient_name, i.unit, t.txn_type, t.qty, t.unit_cost, t.note, t.ref_type, t.ref_id, u.name AS user_name
     FROM inventory_txns t JOIN ingredients i ON i.id = t.ingredient_id LEFT JOIN users u ON u.id = t.user_id
     WHERE t.branch_id = ? ${extra} ORDER BY t.created_at DESC, t.id DESC LIMIT ${limit}`,
    ingredientId ? [branchId, ingredientId] : [branchId],
  )
}

/* ============================== PURCHASING ============================= */
export const getSuppliers = () => all<Supplier>('SELECT * FROM suppliers ORDER BY name')
export function getPurchaseOrders(branchId?: number) {
  return all<PurchaseOrder>(
    `SELECT po.*, s.name AS supplier_name, b.name AS branch_name,
       (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.id) AS item_count
     FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id JOIN branches b ON b.id = po.branch_id
     ${branchId ? 'WHERE po.branch_id = ?' : ''} ORDER BY po.created_at DESC`,
    branchId ? [branchId] : [],
  )
}
export const getPurchaseOrderItems = (poId: number) =>
  all<{ id: number; ingredient_id: number; ingredient_name: string; unit: string; qty: number; unit_cost: number; amount: number }>(
    `SELECT poi.*, i.name AS ingredient_name, i.unit FROM purchase_order_items poi
     JOIN ingredients i ON i.id = poi.ingredient_id WHERE poi.po_id = ?`,
    [poId],
  )

export function createPO(input: { supplierId: number; branchId: number; userId: number; note?: string; items: { ingredientId: number; qty: number; unitCost: number }[] }) {
  const subtotal = input.items.reduce((s, i) => s + Math.round(i.qty) * i.unitCost, 0)
  const vat = Math.round(subtotal * 0.08)
  const nextId = (scalar<number>('SELECT COALESCE(MAX(id),0)+1 FROM purchase_orders') ?? 1)
  const code = `PO${String(nextId).padStart(4, '0')}`
  const statements = [
    {
      sql: `INSERT INTO purchase_orders (id, code, supplier_id, branch_id, status, subtotal, vat, total, note, created_by, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      params: [nextId, code, input.supplierId, input.branchId, 'draft', subtotal, vat, subtotal + vat, input.note ?? null, input.userId, nowVN()],
    },
    ...input.items.map((it) => ({
      sql: `INSERT INTO purchase_order_items (po_id, ingredient_id, qty, unit_cost, amount) VALUES (?,?,?,?,?)`,
      params: [nextId, it.ingredientId, Math.round(it.qty), it.unitCost, Math.round(it.qty) * it.unitCost],
    })),
  ]
  runMany(statements)
  return { id: nextId, code }
}

export function markPOOrdered(poId: number) {
  run(`UPDATE purchase_orders SET status = 'ordered' WHERE id = ? AND status = 'draft'`, [poId])
}

/** Nhận hàng: cộng tồn kho, ghi thẻ kho, tăng công nợ NCC, ghi sổ chi. */
export function receivePO(poId: number, userId: number) {
  const po = one<PurchaseOrder>('SELECT * FROM purchase_orders WHERE id = ?', [poId])
  if (!po || po.status === 'received') return
  const items = getPurchaseOrderItems(poId)
  const at = nowVN()
  const statements = [
    { sql: `UPDATE purchase_orders SET status = 'received', received_at = ? WHERE id = ?`, params: [at, poId] },
    ...items.map((it) => ({
      sql: `INSERT INTO inventory_txns (branch_id, ingredient_id, txn_type, qty, unit_cost, ref_type, ref_id, note, user_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      params: [po.branch_id, it.ingredient_id, 'in', it.qty, it.unit_cost, 'purchase_orders', poId, `Nhập kho theo ${po.code}`, userId, at],
    })),
    { sql: `UPDATE suppliers SET debt = debt + ? WHERE id = ?`, params: [po.total, po.supplier_id] },
    {
      sql: `INSERT INTO finance_entries (branch_id, entry_date, type, category, amount, ref_type, ref_id, note, created_by, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      params: [po.branch_id, at.slice(0, 10), 'expense', 'purchase', po.total, 'purchase_orders', poId, `Nhập hàng ${po.code}`, userId, at],
    },
    {
      sql: `INSERT INTO audit_logs (user_id, action, entity, entity_id, before_value, after_value, created_at) VALUES (?,?,?,?,?,?,?)`,
      params: [userId, 'receive_po', 'purchase_orders', String(poId), JSON.stringify({ status: po.status }), JSON.stringify({ status: 'received', total: po.total }), at],
    },
  ]
  runMany(statements)
  items.forEach((it) => upsertStock(po.branch_id, it.ingredient_id, it.qty, it.unit_cost))
}

/* ============================ PRODUCTS / BOM =========================== */
export function getRecipes(productId?: number) {
  return all<{ id: number; product_id: number; product_name: string; size_code: string; ingredient_id: number; ingredient_name: string; unit: string; qty: number; unit_cost: number; line_cost: number }>(
    `SELECT r.id, r.product_id, p.name AS product_name, r.size_code, r.ingredient_id, i.name AS ingredient_name, i.unit,
            r.qty, i.unit_cost, ROUND(r.qty * i.unit_cost) AS line_cost
     FROM recipes r JOIN products p ON p.id = r.product_id JOIN ingredients i ON i.id = r.ingredient_id
     ${productId ? 'WHERE r.product_id = ?' : ''} ORDER BY p.name, r.size_code`,
    productId ? [productId] : [],
  )
}
export function recipeCost(productId: number, size: string) {
  return scalar<number>(
    `SELECT ROUND(SUM(r.qty * i.unit_cost)) FROM recipes r JOIN ingredients i ON i.id = r.ingredient_id
     WHERE r.product_id = ? AND r.size_code = ?`,
    [productId, size],
  ) ?? 0
}
export function setRecipeLine(productId: number, size: string, ingredientId: number, qty: number) {
  const existing = one<{ id: number }>('SELECT id FROM recipes WHERE product_id = ? AND size_code = ? AND ingredient_id = ?', [productId, size, ingredientId])
  if (existing) run('UPDATE recipes SET qty = ? WHERE id = ?', [qty, existing.id])
  else run('INSERT INTO recipes (product_id, size_code, ingredient_id, qty) VALUES (?,?,?,?)', [productId, size, ingredientId, qty])
  run(`UPDATE products SET cost_price = ? WHERE id = ?`, [recipeCost(productId, 'M'), productId])
}
export function deleteRecipeLine(id: number) {
  const line = one<{ product_id: number }>('SELECT product_id FROM recipes WHERE id = ?', [id])
  run('DELETE FROM recipes WHERE id = ?', [id])
  if (line) run('UPDATE products SET cost_price = ? WHERE id = ?', [recipeCost(line.product_id, 'M'), line.product_id])
}

/* =============================== ORDERS ================================ */
export interface OrderFilters {
  branchId?: number | 'all'
  status?: string
  channel?: string
  source?: string
  from?: string
  to?: string
  search?: string
  limit?: number
  offset?: number
}
export function getOrders(f: OrderFilters = {}) {
  const where: string[] = []
  const params: any[] = []
  if (f.branchId && f.branchId !== 'all') { where.push('o.branch_id = ?'); params.push(f.branchId) }
  if (f.status) { where.push('o.status = ?'); params.push(f.status) }
  if (f.channel) { where.push('o.channel = ?'); params.push(f.channel) }
  if (f.source) { where.push('o.source = ?'); params.push(f.source) }
  if (f.from) { where.push('o.created_at >= ?'); params.push(`${f.from} 00:00:00`) }
  if (f.to) { where.push('o.created_at <= ?'); params.push(`${f.to} 23:59:59`) }
  if (f.search) {
    where.push('(o.code LIKE ? OR c.phone LIKE ? OR c.name LIKE ?)')
    params.push(`%${f.search}%`, `%${f.search}%`, `%${f.search}%`)
  }
  const limit = f.limit ?? 100
  const offset = f.offset ?? 0
  const rows = all<Order>(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS cashier_name, t.name AS table_name, b.name AS branch_name,
       (SELECT COALESCE(SUM(qty),0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN users u ON u.id = o.cashier_id
     LEFT JOIN dining_tables t ON t.id = o.table_id JOIN branches b ON b.id = o.branch_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY o.created_at DESC, o.id DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  )
  const total = all<{ c: number }>(
    `SELECT COUNT(*) AS c FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
    params,
  )[0]?.c ?? 0
  return { rows, total }
}
export const getOrder = (id: number) => one<Order>('SELECT * FROM orders WHERE id = ?', [id])
export function getOrderDetail(id: number) {
  const order = one<Order>(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.tier AS tier, u.name AS cashier_name, t.name AS table_name, b.name AS branch_name
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN users u ON u.id = o.cashier_id
     LEFT JOIN dining_tables t ON t.id = o.table_id JOIN branches b ON b.id = o.branch_id WHERE o.id = ?`,
    [id],
  )
  if (!order) return null
  const items = all<OrderItem>('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [id])
  items.forEach((it) => {
    it.toppings = all<{ topping_name: string; qty: number; price: number }>(
      'SELECT topping_name, qty, price FROM order_item_toppings WHERE order_item_id = ?', [it.id],
    )
  })
  const payments = all<{ id: number; method: string; amount: number; paid_at: string; ref: string }>(
    'SELECT id, method, amount, paid_at, ref FROM payments WHERE order_id = ? ORDER BY id', [id],
  )
  const events = all<{ id: number; status: string; note: string; created_at: string; user_name: string }>(
    `SELECT e.id, e.status, e.note, e.created_at, u.name AS user_name FROM order_events e
     LEFT JOIN users u ON u.id = e.user_id WHERE e.order_id = ? ORDER BY e.created_at, e.id`, [id],
  )
  return { order, items, payments, events }
}

export function getActiveOrders(branchId?: number | 'all') {
  return all<Order>(
    `SELECT o.*, c.name AS customer_name, t.name AS table_name
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN dining_tables t ON t.id = o.table_id
     WHERE o.status IN ('pending','preparing','ready') ${branchId && branchId !== 'all' ? 'AND o.branch_id = ?' : ''}
     ORDER BY o.created_at ASC`,
    branchId && branchId !== 'all' ? [branchId] : [],
  )
}

export function updateOrderStatus(orderId: number, status: string, userId: number) {
  const at = nowVN()
  const patch =
    status === 'preparing' ? `, preparing_at = COALESCE(preparing_at, '${at}')` :
    status === 'ready' ? `, ready_at = COALESCE(ready_at, '${at}')` :
    status === 'completed' ? `, completed_at = COALESCE(completed_at, '${at}')` : ''
  runMany([
    { sql: `UPDATE orders SET status = ?${patch} WHERE id = ?`, params: [status, orderId] },
    {
      sql: `INSERT INTO order_events (order_id, status, note, user_id, created_at) VALUES (?,?,?,?,?)`,
      params: [orderId, status, status === 'completed' ? 'Đã giao khách' : status === 'ready' ? 'Pha chế xong' : 'Bắt đầu pha chế', userId, at],
    },
  ])
}

export function cancelOrder(orderId: number, reason: string, userId: number, restoreStock = true) {
  const order = getOrder(orderId)
  if (!order || order.status === 'cancelled') return
  const at = nowVN()
  const items = all<OrderItem>('SELECT * FROM order_items WHERE order_id = ?', [orderId])
  const statements = [
    { sql: `UPDATE orders SET status = 'cancelled', cancel_reason = ? WHERE id = ?`, params: [reason, orderId] },
    { sql: `INSERT INTO order_events (order_id, status, note, user_id, created_at) VALUES (?,?,?,?,?)`, params: [orderId, 'cancelled', `Huỷ đơn: ${reason}`, userId, at] },
    { sql: `INSERT INTO audit_logs (user_id, action, entity, entity_id, before_value, after_value, created_at) VALUES (?,?,?,?,?,?,?)`, params: [userId, 'cancel_order', 'orders', String(orderId), JSON.stringify({ status: order.status }), JSON.stringify({ status: 'cancelled', reason }), at] },
  ]
  runMany(statements)
  if (restoreStock) {
    const perIng = new Map<number, number>()
    items.forEach((it) => {
      all<{ ingredient_id: number; qty: number }>('SELECT ingredient_id, qty FROM recipes WHERE product_id = ? AND size_code = ?', [it.product_id, it.size_code])
        .forEach((r) => perIng.set(r.ingredient_id, (perIng.get(r.ingredient_id) ?? 0) + r.qty * it.qty))
    })
    perIng.forEach((qty, ingId) => {
      const ing = one<Ingredient>('SELECT * FROM ingredients WHERE id = ?', [ingId])!
      run(`INSERT INTO inventory_txns (branch_id, ingredient_id, txn_type, qty, unit_cost, ref_type, ref_id, note, user_id, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [order.branch_id, ingId, 'adjust', Math.round(qty), ing.unit_cost, 'orders', orderId, 'Hoàn kho do huỷ đơn', userId, at], { silent: true })
      upsertStock(order.branch_id, ingId, Math.round(qty), ing.unit_cost)
    })
  }
  if (order.customer_id) {
    run('UPDATE customers SET total_spent = MAX(0, total_spent - ?), order_count = MAX(0, order_count - 1) WHERE id = ?', [order.total, order.customer_id])
    run('UPDATE customers SET tier = CASE WHEN total_spent >= 2200000 THEN \'diamond\' WHEN total_spent >= 1200000 THEN \'gold\' WHEN total_spent >= 450000 THEN \'silver\' ELSE \'bronze\' END WHERE id = ?', [order.customer_id])
  }
  if (order.table_id) run(`UPDATE dining_tables SET status = 'empty' WHERE id = ?`, [order.table_id])
}

/* =============================== CUSTOMERS ============================= */
export const searchCustomers = (q: string, limit = 20) =>
  all<Customer>(
    `SELECT * FROM customers WHERE phone LIKE ? OR name LIKE ? OR code LIKE ? ORDER BY total_spent DESC LIMIT ${limit}`,
    [`%${q}%`, `%${q}%`, `%${q}%`],
  )
export const getCustomers = (limit = 300) =>
  all<Customer & { last_order: string }>(
    `SELECT c.*, (SELECT MAX(created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order
     FROM customers c ORDER BY c.total_spent DESC LIMIT ${limit}`,
  )
export const getCustomer = (id: number) => one<Customer>('SELECT * FROM customers WHERE id = ?', [id])
export const getCustomerOrders = (id: number) =>
  all<Order>('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 30', [id])
export function createCustomer(input: { name: string; phone: string; email?: string; birthday?: string; note?: string }) {
  const exists = one<Customer>('SELECT * FROM customers WHERE phone = ?', [input.phone])
  if (exists) return exists
  const next = (scalar<number>('SELECT COALESCE(MAX(id),0)+1 FROM customers') ?? 1)
  run(
    `INSERT INTO customers (id, code, name, phone, email, birthday, tier, points, total_spent, order_count, note, created_at)
     VALUES (?,?,?,?,?,?,'bronze',0,0,0,?,?)`,
    [next, `KH${String(next).padStart(4, '0')}`, input.name, input.phone, input.email ?? null, input.birthday ?? null, input.note ?? null, nowVN()],
  )
  return getCustomer(next)!
}

/* =============================== VOUCHERS ============================== */
export const getVouchers = () => all<Voucher>('SELECT * FROM vouchers ORDER BY id')
export const getPromotions = () =>
  all<{ id: number; name: string; type: string; config: string; is_active: number; start_at: string; end_at: string; created_at: string }>(
    'SELECT * FROM promotions ORDER BY id',
  )
export function validateVoucher(code: string, subtotal: number, tier: string) {
  const v = one<Voucher>('SELECT * FROM vouchers WHERE upper(code) = upper(?) AND is_active = 1', [code.trim()])
  const today = todayVN()
  if (!v) return { ok: false as const, error: 'Mã không tồn tại hoặc đã tắt' }
  if (v.start_at.slice(0, 10) > today) return { ok: false as const, error: 'Chưa tới thời gian áp dụng' }
  if (v.end_at.slice(0, 10) < today) return { ok: false as const, error: 'Mã đã hết hạn' }
  if (v.usage_limit !== null && v.used_count >= v.usage_limit) return { ok: false as const, error: 'Mã đã hết lượt sử dụng' }
  if (subtotal < v.min_order) return { ok: false as const, error: `Đơn tối thiểu ${v.min_order.toLocaleString('vi-VN')} ₫` }
  if (v.tier_required) {
    const order = ['bronze', 'silver', 'gold', 'diamond']
    if (order.indexOf(tier) < order.indexOf(v.tier_required)) return { ok: false as const, error: `Chỉ áp dụng cho hạng ${v.tier_required}` }
  }
  const raw = v.type === 'percent' ? Math.round((subtotal * v.value) / 100) : v.value
  const discount = v.max_discount ? Math.min(raw, v.max_discount) : raw
  return { ok: true as const, voucher: v, discount }
}

export function updateVoucherActive(id: number, isActive: number) {
  run('UPDATE vouchers SET is_active = ? WHERE id = ?', [isActive, id])
}

export function createVoucher(input: Omit<Voucher, 'id' | 'used_count'>) {
  run(
    `INSERT INTO vouchers (code, name, campaign, type, value, min_order, max_discount, usage_limit, used_count, tier_required, start_at, end_at, is_active)
     VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?)`,
    [input.code.toUpperCase(), input.name, input.campaign, input.type, input.value, input.min_order, input.max_discount, input.usage_limit, input.tier_required, input.start_at, input.end_at, input.is_active],
  )
}

/** CTKM tự động đang bật (giờ vàng / theo hạng) — POS hiển thị và áp dụng. */
export function getActivePromotions(branchId: number) {
  return all<{ id: number; name: string; type: string; config: string }>(
    `SELECT id, name, type, config FROM promotions WHERE is_active = 1 AND (branch_id IS NULL OR branch_id = ?)`,
    [branchId],
  )
}
export function computePromotionDiscount(subtotal: number, tier: string, at = nowVN()) {
  const hour = Number(at.slice(11, 13))
  const promos = getActivePromotions(1)
  let best = { amount: 0, label: '' }
  promos.forEach((p) => {
    const cfg = JSON.parse(p.config || '{}')
    if (p.type === 'happy_hour') {
      const inWindow = cfg.from !== undefined ? hour >= cfg.from && hour < cfg.to : true
      if (inWindow && cfg.percent) {
        const amount = Math.min(cfg.max ?? Number.MAX_SAFE_INTEGER, Math.round((subtotal * cfg.percent) / 100))
        if (amount > best.amount) best = { amount, label: p.name }
      }
    }
    if (p.type === 'tier_discount' && cfg[tier]) {
      const amount = Math.round((subtotal * cfg[tier]) / 100)
      if (amount > best.amount) best = { amount, label: p.name }
    }
  })
  return best
}

/* ============================== POS FLOW =============================== */
export interface CartItemInput {
  productId: number
  productName: string
  size: string
  sugar: number
  ice: number
  qty: number
  unitPrice: number
  discount: number
  note?: string
  toppings: { id: number; name: string; qty: number; price: number }[]
}
export interface CheckoutInput {
  branchId: number
  channel: 'dine_in' | 'takeaway' | 'delivery'
  source?: 'pos' | 'grabfood' | 'shopeefood' | 'website' | 'app'
  tableId?: number | null
  customerId?: number | null
  cashierId: number
  items: CartItemInput[]
  promotionDiscount: number
  voucherId?: number | null
  voucherDiscount: number
  vatRate: number
  deliveryFee: number
  deliveryAddress?: string
  pointsUsed: number
  note?: string
  payments: { method: string; amount: number }[]
  expertMode?: boolean
}

export interface CheckoutResult {
  orderId: number
  code: string
  queueNo: number | null
  total: number
  cogs: number
  pointsEarned: number
  stockDeducted: { ingredient: string; qty: number; unit: string }[]
}

/** Tạo đơn hoàn chỉnh: đơn → dòng đơn → trừ kho theo BOM → thanh toán → điểm khách → nhật ký. */
export function checkout(input: CheckoutInput): CheckoutResult {
  const db = getDb()
  const at = nowVN()
  const nextId = (scalar<number>('SELECT COALESCE(MAX(id),0)+1 FROM orders') ?? 1)
  const code = `HD${at.slice(0, 10).replace(/-/g, '')}-${String(nextId).padStart(4, '0')}`
  const subtotal = input.items.reduce((s, it) => s + it.unitPrice * it.qty - it.discount, 0)
  const itemDiscount = input.items.reduce((s, it) => s + it.discount, 0)

  // COGS theo công thức (nguồn sự thật: bảng recipes)
  let cogs = 0
  const stockPlan = new Map<number, number>()
  const stockDetail: { ingredient: string; qty: number; unit: string }[] = []
  input.items.forEach((it) => {
    const lines = all<{ ingredient_id: number; qty: number }>('SELECT ingredient_id, qty FROM recipes WHERE product_id = ? AND size_code = ?', [it.productId, it.size])
    lines.forEach((l) => {
      const used = Math.round(l.qty * it.qty)
      stockPlan.set(l.ingredient_id, (stockPlan.get(l.ingredient_id) ?? 0) + used)
    })
  })
  stockPlan.forEach((qty, ingId) => {
    const ing = one<Ingredient>('SELECT * FROM ingredients WHERE id = ?', [ingId])
    if (ing) {
      cogs += qty * ing.unit_cost
      stockDetail.push({ ingredient: ing.name, qty, unit: ing.unit })
    }
  })

  const gross = subtotal - input.promotionDiscount - input.voucherDiscount
  const vatAmount = Math.round((Math.max(0, gross) * input.vatRate) / (1 + input.vatRate))
  const total = Math.max(0, gross) + input.deliveryFee - input.pointsUsed * 1000
  const pointsEarned = Math.max(0, Math.floor(total / 10000))

  // ca làm việc đang mở (tự mở nếu chưa có)
  let shift = one<Shift>(`SELECT * FROM shifts WHERE branch_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`, [input.branchId])
  if (!shift) {
    const shiftId = (scalar<number>('SELECT COALESCE(MAX(id),0)+1 FROM shifts') ?? 1)
    db.run(`INSERT INTO shifts (id, branch_id, user_id, opened_at, opening_cash, cash_in, cash_out, status) VALUES (?,?,?,?,0,0,0,'open')`,
      [shiftId, input.branchId, input.cashierId, at])
    shift = one<Shift>('SELECT * FROM shifts WHERE id = ?', [shiftId])!
  }

  const queueNo = input.channel === 'dine_in' ? null :
    (scalar<number>(`SELECT COALESCE(MAX(queue_no),0)+1 FROM orders WHERE branch_id = ? AND date(created_at) = ?`, [input.branchId, at.slice(0, 10)]) ?? 1)

  const statements: { sql: string; params: any[] }[] = [
    {
      sql: `INSERT INTO orders (id, code, branch_id, channel, source, table_id, customer_id, cashier_id, shift_id, queue_no, status,
              subtotal, item_discount, promotion_discount, voucher_id, voucher_discount, vat_amount, delivery_fee, points_used, points_earned,
              total, cogs, note, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [nextId, code, input.branchId, input.channel, input.source ?? 'pos', input.tableId ?? null, input.customerId ?? null,
        input.cashierId, shift.id, queueNo, subtotal, itemDiscount, input.promotionDiscount, input.voucherId ?? null,
        input.voucherDiscount, vatAmount, input.deliveryFee, input.pointsUsed, pointsEarned, total, cogs,
        input.note ?? (input.deliveryAddress ? `Giao tới: ${input.deliveryAddress}` : null), at],
    },
  ]

  let itemId = (scalar<number>('SELECT COALESCE(MAX(id),0) FROM order_items') ?? 0)
  input.items.forEach((it) => {
    itemId++
    statements.push({
      sql: `INSERT INTO order_items (id, order_id, product_id, product_name, size_code, sugar_level, ice_level, qty, unit_price, discount, unit_cost, note)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [itemId, nextId, it.productId, it.productName, it.size, it.sugar, it.ice, it.qty, it.unitPrice, it.discount,
        recipeCost(it.productId, it.size), it.note ?? null],
    })
    it.toppings.forEach((t) => {
      statements.push({
        sql: `INSERT INTO order_item_toppings (order_item_id, topping_id, topping_name, qty, price) VALUES (?,?,?,?,?)`,
        params: [itemId, t.id, t.name, t.qty, t.price],
      })
    })
  })

  stockPlan.forEach((qty, ingId) => {
    const ing = one<Ingredient>('SELECT * FROM ingredients WHERE id = ?', [ingId])!
    statements.push({
      sql: `INSERT INTO inventory_txns (branch_id, ingredient_id, txn_type, qty, unit_cost, ref_type, ref_id, note, user_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      params: [input.branchId, ingId, 'sale', -qty, ing.unit_cost, 'orders', nextId, `Bán hàng đơn ${code}`, input.cashierId, at],
    })
  })

  input.payments.forEach((p) => {
    statements.push({
      sql: `INSERT INTO payments (order_id, method, amount, paid_at, ref) VALUES (?,?,?,?,?)`,
      params: [nextId, p.method, p.amount, at, p.method === 'cash' ? null : `${p.method.toUpperCase()}${nextId}${Math.floor(Math.random() * 900 + 100)}`],
    })
  })

  statements.push({
    sql: `INSERT INTO order_events (order_id, status, note, user_id, created_at) VALUES (?,?,?,?,?)`,
    params: [nextId, 'pending', 'Đơn mới từ POS', input.cashierId, at],
  })

  if (input.customerId) {
    statements.push({
      sql: `UPDATE customers SET points = MAX(0, points - ?) + ?, total_spent = total_spent + ?, order_count = order_count + 1 WHERE id = ?`,
      params: [input.pointsUsed, pointsEarned, total, input.customerId],
    })
    statements.push({
      sql: `UPDATE customers SET tier = CASE WHEN total_spent >= 2200000 THEN 'diamond' WHEN total_spent >= 1200000 THEN 'gold' WHEN total_spent >= 450000 THEN 'silver' ELSE 'bronze' END WHERE id = ?`,
      params: [input.customerId],
    })
  }
  if (input.voucherId) {
    statements.push({ sql: `UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?`, params: [input.voucherId] })
  }
  if (input.tableId) {
    statements.push({ sql: `UPDATE dining_tables SET status = 'occupied' WHERE id = ?`, params: [input.tableId] })
  }
  statements.push({
    sql: `INSERT INTO audit_logs (user_id, action, entity, entity_id, before_value, after_value, created_at) VALUES (?,?,?,?,?,?,?)`,
    params: [input.cashierId, 'create_order', 'orders', String(nextId), null, JSON.stringify({ code, total, channel: input.channel, items: input.items.length }), at],
  })

  runMany(statements)
  stockPlan.forEach((qty, ingId) => {
    const ing = one<Ingredient>('SELECT * FROM ingredients WHERE id = ?', [ingId])!
    upsertStock(input.branchId, ingId, -qty, ing.unit_cost)
  })

  return { orderId: nextId, code, queueNo, total, cogs, pointsEarned, stockDeducted: stockDetail }
}

/* =============================== TABLES ================================ */
export const getTables = (branchId: number) => all<{ id: number; code: string; name: string; zone: string; seats: number; x: number; y: number; status: string }>(
  'SELECT * FROM dining_tables WHERE branch_id = ? ORDER BY zone, code', [branchId],
)
export function setTableStatus(id: number, status: 'empty' | 'occupied' | 'reserved') {
  run('UPDATE dining_tables SET status = ? WHERE id = ?', [status, id])
}
export function updateTablePosition(id: number, x: number, y: number) {
  run('UPDATE dining_tables SET x = ?, y = ? WHERE id = ?', [x, y, id], { silent: true })
}

/* =============================== SHIFTS ================================ */
export const getShiftOpen = (branchId: number) => one<Shift>(`SELECT * FROM shifts WHERE branch_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`, [branchId])
export function getShifts(branchId: number, limit = 30) {
  return all<Shift>(
    `SELECT s.*, u.name AS user_name FROM shifts s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.branch_id = ? ORDER BY s.opened_at DESC LIMIT ${limit}`, [branchId],
  )
}
export function openShift(branchId: number, userId: number, openingCash: number) {
  run(`INSERT INTO shifts (branch_id, user_id, opened_at, opening_cash, cash_in, cash_out, status) VALUES (?,?,?,?,0,0,'open')`,
    [branchId, userId, nowVN(), openingCash])
}
export function addShiftCash(shiftId: number, type: 'in' | 'out', amount: number, reason: string, userId: number) {
  runMany([
    { sql: `INSERT INTO shift_cash_txns (shift_id, type, amount, reason, user_id, created_at) VALUES (?,?,?,?,?,?)`, params: [shiftId, type, amount, reason, userId, nowVN()] },
    { sql: `UPDATE shifts SET ${type === 'in' ? 'cash_in' : 'cash_out'} = ${type === 'in' ? 'cash_in' : 'cash_out'} + ? WHERE id = ?`, params: [amount, shiftId] },
  ])
}
export function shiftSummary(shiftId: number) {
  const shift = one<Shift>('SELECT * FROM shifts WHERE id = ?', [shiftId])!
  const cash = scalar<number>(
    `SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE o.shift_id = ? AND p.method = 'cash' AND o.status != 'cancelled'`, [shiftId]) ?? 0
  const revenue = scalar<number>(`SELECT COALESCE(SUM(total),0) FROM orders WHERE shift_id = ? AND status != 'cancelled'`, [shiftId]) ?? 0
  const orders = scalar<number>(`SELECT COUNT(*) FROM orders WHERE shift_id = ? AND status != 'cancelled'`, [shiftId]) ?? 0
  const byMethod = all<{ method: string; amount: number }>(
    `SELECT p.method, SUM(p.amount) AS amount FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE o.shift_id = ? AND o.status != 'cancelled' GROUP BY p.method`, [shiftId])
  const expected = shift.opening_cash + shift.cash_in - shift.cash_out + cash
  return { shift, cash, revenue, orders, byMethod, expected }
}
export function closeShift(shiftId: number, countedCash: number, note: string) {
  const { expected } = shiftSummary(shiftId)
  run(`UPDATE shifts SET status = 'closed', closed_at = ?, counted_cash = ?, expected_cash = ?, variance = ?, note = ? WHERE id = ?`,
    [nowVN(), countedCash, expected, countedCash - expected, note || null, shiftId])
}

/* =============================== FINANCE =============================== */
export const getFinanceEntries = (limit = 200, branchId?: number) =>
  all<{ id: number; entry_date: string; type: string; category: string; amount: number; note: string; branch_name: string; ref_type: string; ref_id: number }>(
    `SELECT f.*, b.name AS branch_name FROM finance_entries f JOIN branches b ON b.id = f.branch_id
     ${branchId ? 'WHERE f.branch_id = ?' : ''} ORDER BY f.entry_date DESC, f.id DESC LIMIT ${limit}`,
    branchId ? [branchId] : [],
  )
export function createFinanceEntry(input: { branchId: number; type: 'income' | 'expense'; category: string; amount: number; note: string; userId: number; entryDate?: string }) {
  run(`INSERT INTO finance_entries (branch_id, entry_date, type, category, amount, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    [input.branchId, input.entryDate ?? todayVN(), input.type, input.category, input.amount, input.note, input.userId, nowVN()])
}

/* ================================ AUDIT ================================ */
export const getAuditLogs = (limit = 100) =>
  all<{ id: number; created_at: string; action: string; entity: string; entity_id: string; user_name: string; after_value: string }>(
    `SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`,
  )

/* ============================== STAFF OPS ============================== */
export function salesByStaff(from: string, to: string) {
  return all<{ user_id: number; name: string; role: string; order_count: number; revenue: number }>(
    `SELECT u.id AS user_id, u.name, u.role, COUNT(o.id) AS order_count, COALESCE(SUM(o.total),0) AS revenue
     FROM users u LEFT JOIN orders o ON o.cashier_id = u.id AND o.status != 'cancelled' AND date(o.created_at) BETWEEN ? AND ?
     GROUP BY u.id ORDER BY revenue DESC`, [from, to],
  )
}

/* ============================ GIAO HÀNG (SHIP) ============================ */
export interface DeliveryRow {
  id: number; order_id: number; branch_id: number; shipper_id: number | null
  status: 'waiting' | 'assigned' | 'picked_up' | 'delivering' | 'delivered' | 'failed' | 'cancelled'
  address: string; district: string | null; lat: number | null; lng: number | null
  distance_km: number; fee: number; cod_amount: number; eta_minutes: number | null; eta_at: string | null
  customer_note: string | null; proof_photo: string | null; rating: number | null; fail_reason: string | null
  created_at: string; assigned_at: string | null; picked_at: string | null; delivered_at: string | null
  code?: string; order_code?: string; total?: number; channel?: string
  shipper_name?: string; shipper_phone?: string; customer_name?: string; customer_phone?: string
  branch_name?: string; branch_address?: string; item_count?: number
}

export const DELIVERY_STATUS: Record<string, { label: string; tone: 'gray' | 'amber' | 'blue' | 'green' | 'red'; icon: string }> = {
  waiting: { label: 'Chờ tài xế', tone: 'amber', icon: '⏳' },
  assigned: { label: 'Đã gán tài xế', tone: 'blue', icon: '🧑‍✈️' },
  picked_up: { label: 'Đã lấy hàng', tone: 'blue', icon: '📦' },
  delivering: { label: 'Đang giao', tone: 'blue', icon: '🛵' },
  delivered: { label: 'Đã giao', tone: 'green', icon: '✅' },
  failed: { label: 'Giao thất bại', tone: 'red', icon: '⚠️' },
  cancelled: { label: 'Đã huỷ', tone: 'gray', icon: '✖️' },
}

const DELIVERY_SELECT = `
  SELECT d.*, 'VD' || printf('%06d', d.id) AS code, o.code AS order_code, o.total, o.channel,
         u.name AS shipper_name, u.phone AS shipper_phone,
         c.name AS customer_name, c.phone AS customer_phone,
         b.name AS branch_name, b.address AS branch_address,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = d.order_id) AS item_count
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  LEFT JOIN users u ON u.id = d.shipper_id
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN branches b ON b.id = d.branch_id`

export function getDeliveries(filters: { branchId?: number | 'all'; status?: string; shipperId?: number; limit?: number } = {}) {
  const where: string[] = []
  const params: any[] = []
  if (filters.branchId && filters.branchId !== 'all') { where.push('d.branch_id = ?'); params.push(filters.branchId) }
  if (filters.status && filters.status !== 'all') { where.push('d.status = ?'); params.push(filters.status) }
  if (filters.shipperId) { where.push('d.shipper_id = ?'); params.push(filters.shipperId) }
  return all<DeliveryRow>(`${DELIVERY_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.id DESC LIMIT ?`,
    [...params, filters.limit ?? 120])
}

export function getDelivery(id: number) {
  return one<DeliveryRow>(`${DELIVERY_SELECT} WHERE d.id = ?`, [id])
}

export function getDeliveryByOrder(orderId: number) {
  return one<DeliveryRow>(`${DELIVERY_SELECT} WHERE d.order_id = ?`, [orderId])
}

export function getDeliveryEvents(deliveryId: number) {
  return all<{ id: number; status: string; note: string | null; lat: number | null; lng: number | null; actor: string | null; created_at: string }>(
    'SELECT * FROM delivery_events WHERE delivery_id = ? ORDER BY id', [deliveryId],
  )
}

/** Tạo vận đơn cho một đơn đã có (đơn giao hàng). */
export function createDelivery(input: {
  orderId: number; branchId: number; address: string; district?: string | null
  lat?: number | null; lng?: number | null; distanceKm: number; fee: number; codAmount?: number
  etaMinutes?: number | null; note?: string | null; userId: number
}) {
  const exists = one<{ id: number }>('SELECT id FROM deliveries WHERE order_id = ?', [input.orderId])
  if (exists) return exists.id
  const id = (scalar<number>('SELECT COALESCE(MAX(id),0)+1 FROM deliveries') ?? 1)
  const at = nowVN()
  const etaAt = input.etaMinutes ? addMinutesVN(at, input.etaMinutes) : null
  runMany([
    {
      sql: `INSERT INTO deliveries (id, order_id, branch_id, shipper_id, status, address, district, lat, lng, distance_km, fee, cod_amount,
              eta_minutes, eta_at, customer_note, created_at) VALUES (?,?,?,NULL,'waiting',?,?,?,?,?,?,?,?,?,?,?)`,
      params: [id, input.orderId, input.branchId, input.address, input.district ?? null, input.lat ?? null, input.lng ?? null,
        input.distanceKm, input.fee, input.codAmount ?? 0, input.etaMinutes ?? null, etaAt, input.note ?? null, at],
    },
    {
      sql: `INSERT INTO delivery_events (delivery_id, status, note, actor, created_at) VALUES (?,?,?,?,?)`,
      params: [id, 'waiting', 'Vận đơn được tạo, chờ điều phối tài xế', 'POS', at],
    },
  ])
  return id
}

export function addMinutesVN(at: string, minutes: number) {
  const d = parseVN(at)
  if (!d) return at
  d.setMinutes(d.getMinutes() + minutes)
  return nowVNOffset(d)
}

function nowVNOffset(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  const shifted = new Date(d.getTime() + 7 * 3600 * 1000)
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}`
}

/** Gán / đổi tài xế. */
export function assignShipper(deliveryId: number, shipperId: number, userId: number) {
  const at = nowVN()
  const shipper = one<{ name: string }>('SELECT name FROM users WHERE id = ?', [shipperId])
  runMany([
    { sql: `UPDATE deliveries SET shipper_id = ?, status = CASE WHEN status = 'waiting' THEN 'assigned' ELSE status END, assigned_at = ? WHERE id = ?`, params: [shipperId, at, deliveryId] },
    { sql: 'INSERT INTO delivery_events (delivery_id, status, note, actor, created_at) VALUES (?,?,?,?,?)', params: [deliveryId, 'assigned', `Gán tài xế ${shipper?.name ?? shipperId}`, `user:${userId}`, at] },
    { sql: `INSERT INTO audit_logs (user_id, action, entity, entity_id, after_value, created_at) VALUES (?,?,?,?,?,?)`, params: [userId, 'assign_shipper', 'deliveries', String(deliveryId), JSON.stringify({ shipperId }), at] },
  ])
}

/** Chuyển trạng thái vận đơn (có toạ độ để vẽ hành trình thật). */
export function updateDeliveryStatus(deliveryId: number, status: DeliveryRow['status'], opts: {
  lat?: number | null; lng?: number | null; note?: string | null; actor?: string; proofPhoto?: string | null; failReason?: string | null
} = {}) {
  const at = nowVN()
  const sets: string[] = ['status = ?']
  const params: any[] = [status]
  if (status === 'picked_up') { sets.push('picked_at = ?'); params.push(at) }
  if (status === 'delivered') { sets.push('delivered_at = ?'); params.push(at) }
  if (opts.proofPhoto) { sets.push('proof_photo = ?'); params.push(opts.proofPhoto) }
  if (opts.failReason) { sets.push('fail_reason = ?'); params.push(opts.failReason) }
  runMany([
    { sql: `UPDATE deliveries SET ${sets.join(', ')} WHERE id = ?`, params: [...params, deliveryId] },
    {
      sql: 'INSERT INTO delivery_events (delivery_id, status, note, lat, lng, actor, created_at) VALUES (?,?,?,?,?,?,?)',
      params: [deliveryId, status, opts.note ?? DELIVERY_STATUS[status]?.label ?? status, opts.lat ?? null, opts.lng ?? null, opts.actor ?? 'system', at],
    },
  ])
  if (status === 'delivered') {
    const d = one<{ order_id: number }>('SELECT order_id FROM deliveries WHERE id = ?', [deliveryId])
    if (d) run(`UPDATE orders SET status = 'completed', completed_at = ? WHERE id = ? AND status != 'cancelled'`, [at, d.order_id])
  }
}

export function rateDelivery(deliveryId: number, rating: number) {
  run('UPDATE deliveries SET rating = ? WHERE id = ?', [Math.max(1, Math.min(5, rating)), deliveryId])
}

export function deliveryStats(branchId?: number | 'all') {
  const cond = branchId && branchId !== 'all' ? 'WHERE branch_id = ?' : ''
  const params = branchId && branchId !== 'all' ? [branchId] : []
  const rows = all<{ status: string; n: number }>(`SELECT status, COUNT(*) AS n FROM deliveries ${cond} GROUP BY status`, params)
  const map = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]))
  const revenue = scalar<number>(`SELECT COALESCE(SUM(total),0) FROM orders WHERE channel = 'delivery' AND status != 'cancelled' AND date(created_at) = ?`, [todayVN()]) ?? 0
  return {
    waiting: map.waiting ?? 0, assigned: map.assigned ?? 0, picked_up: map.picked_up ?? 0,
    delivering: map.delivering ?? 0, delivered: map.delivered ?? 0, failed: map.failed ?? 0,
    active: (map.waiting ?? 0) + (map.assigned ?? 0) + (map.picked_up ?? 0) + (map.delivering ?? 0),
    revenueToday: revenue,
  }
}

/** Danh sách tài xế (nhân viên đang hoạt động có thể nhận giao). */
export const getShippers = () =>
  all<{ id: number; name: string; phone: string | null; role: string; branch_id: number | null; avatar_emoji: string }>(
    `SELECT id, name, phone, role, branch_id, avatar_emoji FROM users WHERE is_active = 1 AND role IN ('cashier','barista','manager') ORDER BY branch_id, name`)

/* ============================ IN ẤN ============================ */
export function getPrintTemplates() {
  return all<{ id: number; code: string; name: string; kind: string; paper: string; width_mm: number; layout: string; is_default: number; updated_at: string }>(
    'SELECT * FROM print_templates ORDER BY kind, id')
}

export function savePrintTemplate(t: { code: string; name: string; kind: string; paper: string; widthMm: number; blocks: unknown[] }) {
  const exists = one<{ id: number }>('SELECT id FROM print_templates WHERE code = ?', [t.code])
  const at = nowVN()
  if (exists) {
    run('UPDATE print_templates SET name = ?, kind = ?, paper = ?, width_mm = ?, layout = ?, updated_at = ? WHERE code = ?',
      [t.name, t.kind, t.paper, t.widthMm, JSON.stringify(t.blocks), at, t.code])
  } else {
    run('INSERT INTO print_templates (code, name, kind, paper, width_mm, layout, is_default, updated_at) VALUES (?,?,?,?,?,?,0,?)',
      [t.code, t.name, t.kind, t.paper, t.widthMm, JSON.stringify(t.blocks), at])
  }
}

export function setDefaultTemplate(code: string) {
  const t = one<{ kind: string }>('SELECT kind FROM print_templates WHERE code = ?', [code])
  if (!t) return
  runMany([
    { sql: 'UPDATE print_templates SET is_default = 0 WHERE kind = ?', params: [t.kind] },
    { sql: 'UPDATE print_templates SET is_default = 1 WHERE code = ?', params: [code] },
  ])
}

export function deletePrintTemplate(code: string) {
  run('DELETE FROM print_templates WHERE code = ? AND is_default = 0', [code])
}

export function logPrintJob(job: { templateCode: string; refType?: string | null; refId?: number | null; copies: number; status: string; printer?: string | null; userId?: number | null; payload?: string | null }) {
  run('INSERT INTO print_jobs (template_code, ref_type, ref_id, copies, status, printer, user_id, payload, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [job.templateCode, job.refType ?? null, job.refId ?? null, job.copies, job.status, job.printer ?? null, job.userId ?? null, job.payload ?? null, nowVN()])
}

export const getPrintJobs = (limit = 60) =>
  all<{ id: number; template_code: string; ref_type: string | null; ref_id: number | null; copies: number; status: string; printer: string | null; created_at: string; user_name: string | null }>(
    `SELECT p.*, u.name AS user_name FROM print_jobs p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT ?`, [limit])

/* ============================ NGÂN HÀNG / VIETQR ============================ */
export const getBankAccounts = () =>
  all<{ id: number; branch_id: number | null; bank_bin: string; bank_name: string; account_no: string; account_name: string; is_default: number; branch_name?: string }>(
    `SELECT a.*, b.name AS branch_name FROM bank_accounts a LEFT JOIN branches b ON b.id = a.branch_id ORDER BY a.id`)

export function saveBankAccount(input: { branchId: number | null; bankBin: string; bankName: string; accountNo: string; accountName: string; id?: number }) {
  if (input.id) {
    run('UPDATE bank_accounts SET branch_id = ?, bank_bin = ?, bank_name = ?, account_no = ?, account_name = ? WHERE id = ?',
      [input.branchId, input.bankBin, input.bankName, input.accountNo, input.accountName, input.id])
  } else {
    run('INSERT INTO bank_accounts (branch_id, bank_bin, bank_name, account_no, account_name, is_default) VALUES (?,?,?,?,?,1)',
      [input.branchId, input.bankBin, input.bankName, input.accountNo, input.accountName])
  }
}

/** Giao dịch QR chờ đối soát (đã ghi nhận thanh toán nhưng chưa xác nhận tiền về). */
export function getPendingBankPayments(branchId?: number | 'all', limit = 60) {
  const cond = branchId && branchId !== 'all' ? 'AND o.branch_id = ?' : ''
  const params = branchId && branchId !== 'all' ? [branchId] : []
  return all<{ id: number; order_id: number; order_code: string; method: string; amount: number; paid_at: string; ref: string | null; bank_txn_ref: string | null; verified_at: string | null; customer_name: string | null; branch_name: string }>(
    `SELECT p.id, p.order_id, o.code AS order_code, p.method, p.amount, p.paid_at, p.ref, p.bank_txn_ref, p.verified_at,
            c.name AS customer_name, b.name AS branch_name
     FROM payments p JOIN orders o ON o.id = p.order_id LEFT JOIN customers c ON c.id = o.customer_id
     JOIN branches b ON b.id = o.branch_id
     WHERE p.method IN ('qr','momo','zalopay','card') ${cond}
     ORDER BY p.verified_at IS NOT NULL, p.id DESC LIMIT ?`, [...params, limit])
}

export function verifyPayment(paymentId: number, bankTxnRef: string, userId: number) {
  const at = nowVN()
  runMany([
    { sql: 'UPDATE payments SET bank_txn_ref = ?, verified_at = ?, verified_by = ? WHERE id = ?', params: [bankTxnRef, at, userId, paymentId] },
    { sql: `INSERT INTO audit_logs (user_id, action, entity, entity_id, after_value, created_at) VALUES (?,?,?,?,?,?)`,
      params: [userId, 'verify_payment', 'payments', String(paymentId), JSON.stringify({ bankTxnRef }), at] },
  ])
}
