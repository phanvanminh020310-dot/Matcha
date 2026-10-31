/**
 * ERP Simulator — các kịch bản chạy trên CHÍNH cơ sở dữ liệu của POS.
 * Mỗi bước là một thao tác ghi thật; trước/sau mỗi bước ta chụp lại các bảng
 * liên quan để hiển thị data diff (bảng · dòng · trước → sau).
 */
import { all, getDb, runMany, scalar, type SqlValue } from './db'
import { cancelOrder, checkout, createFinanceEntry, createPO, createStockOp, getProducts, lowStock, markPOOrdered, openShift, closeShift, receivePO, updateOrderStatus, getProductSizes, getProductToppings } from './api'
import { nowVN } from './format'

export const WATCHED_TABLES = [
  'orders', 'order_items', 'order_item_toppings', 'payments', 'order_events',
  'inventory_stock', 'inventory_txns', 'customers', 'shifts', 'shift_cash_txns',
  'purchase_orders', 'purchase_order_items', 'suppliers', 'finance_entries', 'audit_logs', 'dining_tables', 'vouchers',
] as const

type Row = Record<string, SqlValue>
export type Snapshot = Map<string, Map<string, Row>>

function pkOf(table: string) {
  return table === 'inventory_stock' ? null : 'id'
}

export function snapshot(): Snapshot {
  const snap: Snapshot = new Map()
  WATCHED_TABLES.forEach((t) => {
    const rows = all<Row>(`SELECT * FROM "${t}"`)
    const map = new Map<string, Row>()
    const pk = pkOf(t)
    rows.forEach((r, i) => {
      map.set(pk ? String(r[pk]) : `${r.branch_id}:${r.ingredient_id}`, r)
    })
    snap.set(t, map)
  })
  return snap
}

export interface FieldChange { name: string; before: string; after: string }
export interface RowDiff {
  table: string
  rowId: string
  change: 'insert' | 'update' | 'delete'
  fields: FieldChange[]
  label: string
}

const LABEL_COL: Record<string, string> = {
  orders: 'code', order_items: 'product_name', payments: 'method', inventory_txns: 'txn_type',
  customers: 'name', suppliers: 'name', purchase_orders: 'code', finance_entries: 'note',
  audit_logs: 'action', order_events: 'status', shift_cash_txns: 'reason',
}

export function diff(before: Snapshot, after: Snapshot): RowDiff[] {
  const out: RowDiff[] = []
  WATCHED_TABLES.forEach((t) => {
    const b = before.get(t) ?? new Map()
    const a = after.get(t) ?? new Map()
    a.forEach((row, key) => {
      const old = b.get(key)
      const label = LABEL_COL[t] ? String(row[LABEL_COL[t]] ?? '') : ''
      if (!old) {
        const fields = Object.entries(row)
          .filter(([k, v]) => v !== null && k !== 'id')
          .slice(0, 6)
          .map(([k, v]) => ({ name: k, before: '—', after: String(v) }))
        out.push({ table: t, rowId: key, change: 'insert', fields, label })
        return
      }
      const fields: FieldChange[] = []
      Object.keys(row).forEach((k) => {
        if (String(old[k] ?? '') !== String(row[k] ?? '')) fields.push({ name: k, before: String(old[k] ?? 'NULL'), after: String(row[k] ?? 'NULL') })
      })
      if (fields.length) out.push({ table: t, rowId: key, change: 'update', fields: fields.slice(0, 6), label })
    })
    b.forEach((row, key) => {
      if (!a.has(key)) out.push({ table: t, rowId: key, change: 'delete', fields: [], label: String(row[LABEL_COL[t]] ?? '') })
    })
  })
  return out
}

export interface SimContext { branchId: number; userId: number; cashierId: number }
export interface SimStep {
  id: string
  title: string
  module: string
  detail: string
  run: (ctx: SimContext, state: Record<string, unknown>) => string
}
export interface Scenario {
  id: string
  name: string
  description: string
  icon: string
  steps: SimStep[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'order',
    name: 'Một đơn hàng đi qua toàn hệ thống',
    description: 'POS tạo đơn → trừ kho theo công thức → KDS pha chế → thu tiền → cộng điểm khách → báo cáo cập nhật.',
    icon: '🧾',
    steps: [
      {
        id: 'pos',
        title: 'POS xác nhận đơn (order + dòng đơn + trừ kho theo BOM)',
        module: 'POS',
        detail: 'Checkout ghi orders, order_items, order_item_toppings, inventory_txns, giảm inventory_stock, cộng điểm khách, ghi audit_logs.',
        run: (ctx, state) => {
          const pick = prepareOrderScenario(ctx)
          if (!pick) return 'Không còn món nào đang bán'
          const res = checkout({
            branchId: ctx.branchId, channel: 'dine_in', source: 'pos', cashierId: ctx.cashierId,
            items: pick.items, promotionDiscount: pick.promotionDiscount, voucherDiscount: 0, vatRate: 0.08,
            deliveryFee: 0, pointsUsed: 0, customerId: pick.customerId, payments: [],
          })
          state.orderId = res.orderId
          return `Đơn ${res.code} · ${pick.items.length} ly · tạm tính ${res.total.toLocaleString('vi-VN')} ₫ · trừ ${res.stockDeducted.length} nguyên liệu`
        },
      },
      {
        id: 'kds',
        title: 'KDS nhận phiếu — pha chế bắt đầu',
        module: 'KDS',
        detail: 'updateOrderStatus → orders.status = preparing, thêm dòng order_events.',
        run: (ctx, state) => {
          updateOrderStatus(Number(state.orderId), 'preparing', ctx.cashierId)
          return `Đơn #${state.orderId} chuyển sang "Đang pha chế", bếp thấy phiếu trên KDS`
        },
      },
      {
        id: 'ready',
        title: 'Pha xong — gọi số ra quầy',
        module: 'KDS',
        detail: 'orders.status = ready, màn hình Customer Display hiện số thứ tự.',
        run: (ctx, state) => {
          updateOrderStatus(Number(state.orderId), 'ready', ctx.cashierId)
          const q = scalar<number>('SELECT queue_no FROM orders WHERE id = ?', [Number(state.orderId)])
          return `Món đã sẵn sàng${q ? `, gọi số ${String(q).padStart(3, '0')}` : ''} trên Customer Display`
        },
      },
      {
        id: 'pay',
        title: 'Thu tiền: 60% tiền mặt + 40% VietQR (qr)',
        module: 'Thanh toán',
        detail: 'Ghi 2 dòng payments, chuyển đơn sang completed, ghi order_events.',
        run: (ctx, state) => {
          const id = Number(state.orderId)
          const total = scalar<number>('SELECT total FROM orders WHERE id = ?', [id]) ?? 0
          const cash = Math.round(total * 0.6 / 1000) * 1000
          const at = nowVN()
          runMany([
            { sql: `INSERT INTO payments (order_id, method, amount, paid_at, ref) VALUES (?,?,?,?,NULL)`, params: [id, 'cash', cash, at] },
            { sql: `INSERT INTO payments (order_id, method, amount, paid_at, ref) VALUES (?,?,?,?,?)`, params: [id, 'qr', total - cash, at, `VQR${id}${Math.floor(Math.random() * 900 + 100)}`] },
            { sql: `UPDATE orders SET status = 'completed' WHERE id = ?`, params: [id] },
            { sql: `INSERT INTO order_events (order_id, status, note, user_id, created_at) VALUES (?,?,?,?,?)`, params: [id, 'completed', 'Thanh toán tiền mặt + VietQR', ctx.cashierId, at] },
          ])
          return `Đã thu ${total.toLocaleString('vi-VN')} ₫ (mặt ${cash.toLocaleString('vi-VN')} ₫ · QR ${(total - cash).toLocaleString('vi-VN')} ₫)`
        },
      },
      {
        id: 'report',
        title: 'Dashboard & báo cáo đọc lại số liệu',
        module: 'Báo cáo',
        detail: 'Không ghi dữ liệu — chỉ đọc: doanh thu hôm nay, top món, tồn kho sau trừ.',
        run: (ctx) => {
          const day = nowVN().slice(0, 10)
          const rev = scalar<number>(`SELECT COALESCE(SUM(total),0) FROM orders WHERE branch_id = ? AND date(created_at) = ? AND status != 'cancelled'`, [ctx.branchId, day]) ?? 0
          const cnt = scalar<number>(`SELECT COUNT(*) FROM orders WHERE branch_id = ? AND date(created_at) = ?`, [ctx.branchId, day]) ?? 0
          return `Hôm nay chi nhánh có ${cnt} đơn · doanh thu ${rev.toLocaleString('vi-VN')} ₫ — Data Explorer đã thấy dòng mới`
        },
      },
    ],
  },
  {
    id: 'purchase',
    name: 'Nhập hàng từ nhà cung cấp',
    description: 'Cảnh báo tồn thấp → tạo PO → gửi NCC → nhận hàng vào kho → tăng công nợ & ghi sổ chi.',
    icon: '🚚',
    steps: [
      {
        id: 'detect', title: 'Phát hiện nguyên liệu dưới định mức', module: 'Kho',
        detail: 'Đọc lowStock() — so tồn hiện tại với định mức tối thiểu.',
        run: (ctx) => {
          const low = lowStock(ctx.branchId)
          return `${low.length} nguyên liệu cần nhập · thấp nhất: ${low[0]?.name ?? '—'}`
        },
      },
      {
        id: 'po', title: 'Tạo đơn mua hàng (PO) nháp', module: 'Mua hàng',
        detail: 'Ghi purchase_orders + purchase_order_items với giá vốn hiện hành.',
        run: (ctx, state) => {
          const low = lowStock(ctx.branchId).slice(0, 3)
          const items = low.map((l) => ({ ingredientId: l.ingredient_id, qty: Math.max(10, Math.round(l.min_stock * 2)), unitCost: l.avg_cost ?? 0 }))
          const supplierId = scalar<number>('SELECT id FROM suppliers ORDER BY id LIMIT 1') ?? 1
          createPO({ supplierId, branchId: ctx.branchId, userId: ctx.userId, note: 'PO tự sinh từ ERP Simulator', items })
          const poId = scalar<number>('SELECT MAX(id) FROM purchase_orders') ?? 0
          state.poId = poId
          return `PO #${poId} · ${items.length} nguyên liệu · tổng ${items.reduce((s, i) => s + i.qty * i.unitCost, 0).toLocaleString('vi-VN')} ₫`
        },
      },
      {
        id: 'send', title: 'Gửi đơn cho nhà cung cấp', module: 'Mua hàng',
        detail: 'purchase_orders.status: draft → ordered.',
        run: (_ctx, state) => { markPOOrdered(Number(state.poId)); return `PO #${state.poId} đã gửi NCC, chờ giao` },
      },
      {
        id: 'receive', title: 'Nhận hàng — cộng tồn kho & công nợ', module: 'Kho',
        detail: 'Ghi inventory_txns (in), cộng inventory_stock, tăng suppliers.debt, ghi finance_entries.',
        run: (ctx, state) => {
          receivePO(Number(state.poId), ctx.userId)
          const total = scalar<number>('SELECT total FROM purchase_orders WHERE id = ?', [Number(state.poId)]) ?? 0
          return `Đã nhập kho ${total.toLocaleString('vi-VN')} ₫ — công nợ NCC tăng tương ứng`
        },
      },
      {
        id: 'check', title: 'Đối chiếu lại tồn kho', module: 'Kho',
        detail: 'Đọc lại lowStock() sau khi nhập.',
        run: (ctx) => `Còn ${lowStock(ctx.branchId).length} nguyên liệu dưới định mức (trước đó nhiều hơn)`,
      },
    ],
  },
  {
    id: 'shift',
    name: 'Chạy một ca làm việc',
    description: 'Mở ca → bán 6 đơn → ghi chi phí phát sinh → chốt ca & đối soát tiền mặt.',
    icon: '⏳',
    steps: [
      {
        id: 'open', title: 'Mở ca thu ngân', module: 'Nhân sự',
        detail: 'Ghi shifts với tiền đầu ca 2.000.000 ₫.',
        run: (ctx, state) => {
          openShift(ctx.branchId, ctx.cashierId, 2000000)
          state.shiftId = scalar<number>(`SELECT id FROM shifts WHERE branch_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`, [ctx.branchId]) ?? 0
          return `Ca #${state.shiftId} đã mở · tiền đầu ca 2.000.000 ₫`
        },
      },
      {
        id: 'sell', title: 'Bán 6 đơn tại quầy', module: 'POS',
        detail: 'Mỗi đơn: tạo order + items + trừ kho + thanh toán tiền mặt/QR.',
        run: (ctx, state) => {
          let revenue = 0
          for (let i = 0; i < 6; i++) {
            const products = getProducts({ branchId: ctx.branchId }).filter((p) => p.is_active)
            const p = products[(i * 5 + 3) % products.length]
            const sizes = getProductSizes(p.id)
            const size = sizes.find((s) => s.code === 'L') ?? sizes[0]
            const res = checkout({
              branchId: ctx.branchId, channel: i % 3 === 0 ? 'takeaway' : 'dine_in', source: 'pos', cashierId: ctx.cashierId,
              items: [{ productId: p.id, productName: p.name, size: size?.code ?? 'M', sugar: 50, ice: 50, qty: 1, unitPrice: p.base_price + (size?.price_delta ?? 0), discount: 0, toppings: [] }],
              promotionDiscount: 0, voucherDiscount: 0, vatRate: 0.08, deliveryFee: 0, pointsUsed: 0,
              payments: [{ method: i % 2 === 0 ? 'cash' : 'qr', amount: p.base_price + (size?.price_delta ?? 0) }],
            })
            updateOrderStatus(res.orderId, 'completed', ctx.cashierId)
            revenue += res.total
            state.lastOrder = res.orderId
          }
          return `6 đơn hoàn tất · doanh thu ${revenue.toLocaleString('vi-VN')} ₫`
        },
      },
      {
        id: 'expense', title: 'Ghi chi phí phát sinh trong ca', module: 'Tài chính',
        detail: 'finance_entries: chi mua đá viên & ly nhựa.',
        run: (ctx) => {
          createFinanceEntry({ branchId: ctx.branchId, type: 'expense', category: 'other', amount: 320000, note: 'Mua đá viên + ly nhựa trong ca', userId: ctx.userId })
          return 'Đã ghi 320.000 ₫ chi phí vận hành'
        },
      },
      {
        id: 'close', title: 'Chốt ca & đối soát tiền mặt', module: 'Nhân sự',
        detail: 'Tính tiền mặt lý thuyết, so với kiểm đếm, lưu chênh lệch.',
        run: (ctx, state) => {
          const cash = scalar<number>(`SELECT COALESCE(SUM(amount),0) FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.shift_id = ? AND p.method = 'cash'`, [Number(state.shiftId)]) ?? 0
          closeShift(Number(state.shiftId), 2000000 + cash, 'Đối soát khớp')
          return `Chốt ca #${state.shiftId} · tiền mặt lý thuyết ${(2000000 + cash).toLocaleString('vi-VN')} ₫ · chênh lệch 0 ₫`
        },
      },
    ],
  },
  {
    id: 'waste',
    name: 'Hao hụt & kiểm kê kho',
    description: 'Ghi hao hụt → kiểm kê điều chỉnh → nguyên liệu hết hàng → đề xuất nhập.',
    icon: '🌿',
    steps: [
      {
        id: 'waste', title: 'Ghi hao hụt nguyên liệu', module: 'Kho',
        detail: 'createStockOp(type=out) → inventory_txns + giảm inventory_stock.',
        run: (ctx) => {
          const ing = all<{ ingredient_id: number; qty: number }>('SELECT ingredient_id, qty FROM inventory_stock WHERE branch_id = ? ORDER BY qty DESC LIMIT 1', [ctx.branchId])[0]
          createStockOp({ branchId: ctx.branchId, ingredientId: ing.ingredient_id, type: 'out', qty: 5, note: 'Hao hụt: hết hạn sử dụng', userId: ctx.userId })
          return `Đã trừ 5 đơn vị nguyên liệu #${ing.ingredient_id} (hao hụt)`
        },
      },
      {
        id: 'adjust', title: 'Kiểm kê điều chỉnh tồn', module: 'Kho',
        detail: 'createStockOp(type=adjust) — ghi nhận chênh lệch kiểm đếm.',
        run: (ctx) => {
          const ing = all<{ ingredient_id: number }>('SELECT ingredient_id FROM inventory_stock WHERE branch_id = ? LIMIT 1 OFFSET 3', [ctx.branchId])[0]
          createStockOp({ branchId: ctx.branchId, ingredientId: ing.ingredient_id, type: 'adjust', qty: 2, note: 'Kiểm kê: thừa 2 đơn vị', userId: ctx.userId })
          return `Điều chỉnh +2 cho nguyên liệu #${ing.ingredient_id}`
        },
      },
      {
        id: 'detect', title: 'Nguyên liệu chạm đáy → cảnh báo', module: 'Kho',
        detail: 'lowStock() trả về danh sách dưới định mức.',
        run: (ctx) => `Có ${lowStock(ctx.branchId).length} nguyên liệu cần nhập gấp`,
      },
      {
        id: 'suggest', title: 'Đề xuất PO tự động', module: 'Mua hàng',
        detail: 'Sinh PO nháp cho các nguyên liệu dưới định mức.',
        run: (ctx) => {
          const low = lowStock(ctx.branchId).slice(0, 4)
          if (!low.length) return 'Không còn nguyên liệu nào dưới định mức'
          createPO({
            supplierId: scalar<number>('SELECT id FROM suppliers ORDER BY id LIMIT 1') ?? 1, branchId: ctx.branchId, userId: ctx.userId,
            note: 'Đề xuất nhập tự động từ ERP Simulator',
            items: low.map((l) => ({ ingredientId: l.ingredient_id, qty: Math.max(20, Math.round(l.min_stock * 2)), unitCost: l.avg_cost ?? 0 })),
          })
          return `Đã tạo PO nháp cho ${low.length} nguyên liệu`
        },
      },
    ],
  },
  {
    id: 'cancel',
    name: 'Huỷ đơn & hoàn kho',
    description: 'Tạo đơn → huỷ có lý do → hoàn nguyên liệu về kho → ghi audit log.',
    icon: '↩️',
    steps: [
      {
        id: 'create', title: 'Tạo đơn để huỷ', module: 'POS',
        detail: 'Checkout đơn takeaway, trừ kho.',
        run: (ctx, state) => {
          const products = getProducts({ branchId: ctx.branchId }).filter((p) => p.is_active)
          const p = products[2]
          const sizes = getProductSizes(p.id)
          const size = sizes.find((s) => s.code === 'M') ?? sizes[0]
          const res = checkout({
            branchId: ctx.branchId, channel: 'takeaway', source: 'pos', cashierId: ctx.cashierId,
            items: [{ productId: p.id, productName: p.name, size: size?.code ?? 'M', sugar: 100, ice: 50, qty: 2, unitPrice: p.base_price + (size?.price_delta ?? 0), discount: 0, toppings: [] }],
            promotionDiscount: 0, voucherDiscount: 0, vatRate: 0.08, deliveryFee: 0, pointsUsed: 0, payments: [],
          })
          state.orderId = res.orderId
          return `Đơn ${res.code} · 2 ly ${p.name}`
        },
      },
      {
        id: 'cancel', title: 'Quản lý huỷ đơn (có lý do)', module: 'Quản lý đơn',
        detail: 'orders.status = cancelled, hoàn inventory_stock, ghi order_events + audit_logs.',
        run: (ctx, state) => {
          cancelOrder(Number(state.orderId), 'Khách đổi ý, huỷ trước khi pha chế', ctx.userId)
          return `Đơn #${state.orderId} đã huỷ — nguyên liệu được hoàn lại kho`
        },
      },
    ],
  },
]

function buildMenu(products: ReturnType<typeof getProducts>) {
  const p1 = products[4 % products.length]
  const p2 = products[11 % products.length]
  const make = (p: typeof p1) => {
    const sizes = getProductSizes(p.id)
    const size = sizes.find((s) => s.code === 'M') ?? sizes[0]
    const tops = getProductToppings(p.id).slice(0, 1)
    return {
      productId: p.id, productName: p.name, size: size?.code ?? 'M', sugar: 70, ice: 70, qty: 1,
      unitPrice: (p.base_price + (size?.price_delta ?? 0)) + tops.reduce((s, t) => s + t.price, 0),
      discount: 0, toppings: tops.map((t) => ({ id: t.id, name: t.name, qty: 1, price: t.price })),
    }
  }
  return { items: [make(p1), make(p2)], promotionDiscount: 0, customerId: scalar<number>('SELECT id FROM customers ORDER BY id LIMIT 1 OFFSET 6') }
}

export function prepareOrderScenario(ctx: SimContext) {
  const products = getProducts({ branchId: ctx.branchId }).filter((p) => p.is_active)
  if (!products.length) return null
  return buildMenu(products)
}

export function dbFingerprint() {
  const db = getDb()
  return db.export().byteLength
}

