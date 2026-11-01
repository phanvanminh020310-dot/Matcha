/** Dựng dữ liệu thật cho từng mẫu in (hoá đơn, tem ly, phiếu giao, kiểm kê, chốt ca). */
import { all, one } from './db'
import { getDeliveryByOrder, getOrderDetail, shiftSummary } from './api'
import { bankByBin, buildVietQR } from './vietqr'
import { formatDateTime, formatVND, nowVN } from './format'

export type PrintCtx = Record<string, unknown>

const CHANNEL_LABEL: Record<string, string> = { dine_in: 'Tại quán', takeaway: 'Mang đi', delivery: 'Giao hàng' }
const METHOD_LABEL: Record<string, string> = { cash: 'Tiền mặt', qr: 'Chuyển khoản QR', card: 'Thẻ', momo: 'MoMo', zalopay: 'ZaloPay', credit: 'Ghi nợ' }

export const methodLabel = (m: string) => METHOD_LABEL[m] ?? m

export function buildOrderCtx(orderId: number, opts: { cashier?: string; trackBase?: string } = {}): PrintCtx | null {
  const detail = getOrderDetail(orderId)
  if (!detail) return null
  const { order, items, payments } = detail
  const branch = one<{ name: string; address: string; phone: string }>('SELECT name, address, phone FROM branches WHERE id = ?', [order.branch_id])
  const account = one<{ bank_bin: string; account_no: string; account_name: string }>(
    'SELECT bank_bin, account_no, account_name FROM bank_accounts WHERE branch_id = ? ORDER BY is_default DESC, id LIMIT 1', [order.branch_id],
  )
  const delivery = getDeliveryByOrder(order.id)
  const base = opts.trackBase ?? `${location.origin}${location.pathname}`
  const trackUrl = delivery ? `${base}#/track/VD${String(delivery.id).padStart(6, '0')}` : `${base}#/orders/${order.id}`

  const qrPayload = account
    ? buildVietQR({
        bankBin: account.bank_bin,
        accountNo: account.account_no,
        amount: order.total,
        memo: order.code,
        merchantName: 'MATCHA HOUSE',
      })
    : trackUrl

  const toppingsOf = (it: { toppings?: { topping_name: string; qty: number }[] }) =>
    (it.toppings ?? []).map((t) => `${t.topping_name}${t.qty > 1 ? ` x${t.qty}` : ''}`).join(', ')

  return {
    branch: { name: branch?.name ?? '', address: branch?.address ?? '', phone: branch?.phone ?? '' },
    cashier: opts.cashier ?? detail.order.cashier_name ?? 'Thu ngân',
    date: formatDateTime(order.created_at).slice(0, 10),
    order: {
      id: order.id,
      code: order.code,
      created_at: order.created_at,
      channel: order.channel,
      channel_label: CHANNEL_LABEL[order.channel] ?? order.channel,
      place: order.table_name ? `Bàn ${order.table_name}` : order.queue_no ? `Số ${order.queue_no}` : '—',
      queue_label: order.queue_no ? `#${String(order.queue_no).padStart(3, '0')}` : order.code.slice(-3),
      time: order.created_at.slice(11, 16),
      track_url: trackUrl,
      status: order.status,
    },
    customer: { name: order.customer_name ?? 'Khách lẻ', phone: order.customer_phone ?? '—' },
    items: items.map((it) => ({
      name: it.product_name,
      size: it.size_code,
      qty: it.qty,
      unit_price: it.unit_price,
      amount: it.unit_price * it.qty - (it.discount ?? 0),
      sugar: it.sugar_level,
      ice: it.ice_level,
      toppings: toppingsOf(it) || 'Không',
      note: it.note ?? '',
      emoji: one<{ emoji: string }>('SELECT emoji FROM products WHERE id = ?', [it.product_id])?.emoji ?? '🧋',
      sku: `SP${String(it.product_id).padStart(4, '0')}`,
      category: '',
    })),
    subtotal: order.subtotal,
    item_discount: order.item_discount,
    promotion_discount: order.promotion_discount,
    voucher_discount: order.voucher_discount,
    delivery_fee: order.delivery_fee,
    vat_amount: order.vat_amount,
    total: order.total,
    points_earned: order.points_earned,
    payments: payments.map((p) => ({ method: methodLabel(p.method), amount: p.amount, ref: p.ref ?? '' })),
    payment_methods: payments.map((p) => methodLabel(p.method)).join(', '),
    vietqr: qrPayload,
    bank: account ? { ...bankByBin(account.bank_bin), account_no: account.account_no, account_name: account.account_name } : { short: '—', account_no: '—', account_name: '—' },
    delivery: delivery ? {
      code: `VD${String(delivery.id).padStart(6, '0')}`,
      address: delivery.address,
      shipper: delivery.shipper_name ?? 'Chưa gán',
      distance: `${delivery.distance_km} km`,
      fee: formatVND(delivery.fee),
      cod: delivery.cod_amount ? formatVND(delivery.cod_amount) : 'Không thu hộ',
      eta_at: delivery.eta_at ? formatDateTime(delivery.eta_at) : '—',
    } : { code: '—', address: '—', shipper: '—', distance: '—', fee: '—', cod: '—', eta_at: '—' },
  }
}

/** Một món — dùng cho tem ly */
export function buildCupCtx(orderId: number, itemIndex = 0, cashier?: string): PrintCtx | null {
  const ctx = buildOrderCtx(orderId, { cashier })
  if (!ctx) return null
  const items = (ctx.items as PrintCtx[]) ?? []
  const item = items[Math.min(itemIndex, items.length - 1)]
  if (!item) return null
  return { ...ctx, item }
}

/** Biên bản kiểm kê: tồn kho hiện tại của chi nhánh */
export function buildStocktakeCtx(branchId: number): PrintCtx {
  const branch = one<{ name: string }>('SELECT name FROM branches WHERE id = ?', [branchId])
  const rows = all<{ name: string; unit: string; qty: number; min_qty: number }>(
    `SELECT i.name, i.unit, s.qty, i.min_qty FROM inventory_stock s JOIN ingredients i ON i.id = s.ingredient_id
     WHERE s.branch_id = ? ORDER BY i.name`, [branchId],
  )
  return {
    branch: { name: branch?.name ?? '' },
    date: formatDateTime(nowVN()).slice(0, 10),
    stocktake: rows.map((r) => ({
      name: r.name,
      value: `${r.qty} ${r.unit}${r.qty < r.min_qty ? ' ⚠ dưới định mức' : ''}`,
    })),
  }
}

/** Báo cáo chốt ca */
export function buildShiftCtx(shiftId: number): PrintCtx {
  const s = shiftSummary(shiftId)
  if (!s) return {}
  const branch = one<{ name: string }>('SELECT name FROM branches WHERE id = ?', [s.shift.branch_id])
  const user = one<{ name: string }>('SELECT name FROM users WHERE id = ?', [s.shift.user_id])
  return {
    branch: { name: branch?.name ?? '' },
    date: formatDateTime(s.shift.opened_at).slice(0, 10),
    shift: {
      cashier: user?.name ?? '—',
      opened: formatDateTime(s.shift.opened_at),
      closed: s.shift.closed_at ? formatDateTime(s.shift.closed_at) : '—',
      opening_cash: formatVND(s.shift.opening_cash),
      expected_cash: formatVND(s.expected),
      counted: s.shift.counted_cash != null ? formatVND(s.shift.counted_cash) : '—',
      diff: s.shift.variance != null ? formatVND(s.shift.variance) : '—',
      orders: s.orders,
    },
    payments: s.byMethod.map((m: { method: string; amount: number }) => ({ name: methodLabel(m.method), value: formatVND(m.amount) })),
  }
}

/** Nhãn kệ cho một sản phẩm */
export function buildPriceTagCtx(productId: number): PrintCtx {
  const p = one<{ name: string; emoji: string; base_price: number; category: string }>(
    `SELECT p.name, p.emoji, p.base_price, c.name AS category FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`, [productId],
  )
  if (!p) return {}
  return {
    item: { name: p.name, emoji: p.emoji, price: formatVND(p.base_price), category: p.category, sku: `SP${String(productId).padStart(4, '0')}` },
  }
}
