/**
 * Sinh dữ liệu cho 40 bảng mở rộng (schema v6) — dựa trên dữ liệu lõi đã có
 * nên mọi con số đều nhất quán: kiểm kê bám tồn kho thật, hoá đơn bám PO,
 * điểm tích luỹ bám đơn hàng, GPS bám vận đơn, chi phí bám chi nhánh.
 */
import type { Database } from 'sql.js'
import { mulberry32 } from './seed'

const rnd = mulberry32(20261101)
const ri = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

const pad = (n: number, w = 5) => String(n).padStart(w, '0')
const d = (iso: string, addDays = 0, addMin = 0) => {
  const t = new Date(`${iso.replace(' ', 'T')}Z`)
  t.setUTCDate(t.getUTCDate() + addDays)
  t.setUTCMinutes(t.getUTCMinutes() + addMin)
  return t.toISOString().slice(0, 19).replace('T', ' ')
}

export function seedExtras(db: Database): Record<string, number> {
  const q = (sql: string): Record<string, unknown>[] => {
    const r = db.exec(sql)
    if (!r[0]) return []
    return r[0].values.map((v) => {
      const o: Record<string, unknown> = {}
      r[0].columns.forEach((c, i) => { o[c] = v[i] })
      return o
    })
  }
  const num = (x: unknown) => Number(x ?? 0)
  const str = (x: unknown) => String(x ?? '')

  const branches = q('SELECT id, name, city FROM branches ORDER BY id') as { id: number; name: string; city: string }[]
  const users = q('SELECT id, name, role, branch_id FROM users ORDER BY id') as { id: number; name: string; role: string; branch_id: number | null }[]
  const products = q('SELECT id, name, base_price, cost_price FROM products ORDER BY id') as { id: number; name: string; base_price: number; cost_price: number }[]
  const ings = q('SELECT id, name, unit, unit_cost, min_stock FROM ingredients ORDER BY id') as { id: number; name: string; unit: string; unit_cost: number; min_stock: number }[]
  const sups = q('SELECT id, name FROM suppliers ORDER BY id') as { id: number; name: string }[]
  const custs = q('SELECT id, name, phone, created_at, points, total_spent FROM customers ORDER BY id') as { id: number; name: string; phone: string; created_at: string; points: number; total_spent: number }[]
  const orders = q("SELECT id, code, branch_id, customer_id, total, created_at, status, channel FROM orders WHERE status='completed' ORDER BY created_at DESC LIMIT 900") as { id: number; code: string; branch_id: number; customer_id: number | null; total: number; created_at: string; status: string; channel: string }[]
  const stock = q('SELECT branch_id, ingredient_id, qty, avg_cost FROM inventory_stock') as { branch_id: number; ingredient_id: number; qty: number; avg_cost: number }[]
  const pos = q('SELECT id, code, supplier_id, branch_id, total, created_at, status FROM purchase_orders ORDER BY id') as { id: number; code: string; supplier_id: number; branch_id: number; total: number; created_at: string; status: string }[]
  const dels = q("SELECT id, order_id, shipper_id, branch_id, cod_amount, fee, status, created_at FROM deliveries WHERE shipper_id IS NOT NULL ORDER BY id") as { id: number; order_id: number; shipper_id: number; branch_id: number; cod_amount: number; fee: number; status: string; created_at: string }[]
  const tables = q('SELECT id, branch_id, name FROM dining_tables ORDER BY id') as { id: number; branch_id: number; name: string }[]
  const tpls = q('SELECT id, name, kind FROM print_templates ORDER BY id') as { id: number; name: string; kind: string }[]

  const NOW = str(q("SELECT value FROM app_meta WHERE key='seeded_at'")[0]?.value ?? '2026-11-01 19:00:00')
  const TODAY = NOW.slice(0, 10)

  let seq = 0
  const ins = (table: string, row: Record<string, unknown>) => {
    const cols = Object.keys(row)
    db.run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      cols.map((c) => row[c] as never))
    seq++
  }

  db.run('BEGIN')

  /* ------------------------------ KHO ------------------------------ */
  let wid = 0
  branches.forEach((b) => {
    ins('warehouses', { id: ++wid, branch_id: b.id, code: `KHO-${b.id}`, name: `Kho chi nhánh ${b.name}`, kind: 'branch', address: `Tầng trệt ${b.name}`, is_active: 1 })
  })
  ins('warehouses', { id: ++wid, branch_id: branches[0].id, code: 'KHO-TT', name: 'Kho trung tâm HCM', kind: 'central', address: 'Kho trung tâm Bình Thạnh, TP.HCM', is_active: 1 })
  ins('warehouses', { id: ++wid, branch_id: branches[0].id, code: 'KHO-LANH', name: 'Kho lạnh trung tâm', kind: 'cold', address: 'Kho lạnh Bình Thạnh', is_active: 1 })

  // Kiểm kê: 1 phiếu / chi nhánh, dòng lấy từ tồn kho thật
  let scId = 0
  branches.forEach((b, bi) => {
    const at = d(TODAY, -2 - bi, -180)
    ins('stock_counts', { id: ++scId, code: `KK${TODAY.slice(0, 7).replace('-', '')}-${pad(scId, 3)}`, branch_id: b.id, warehouse_id: b.id, counted_by: users.find((u) => u.role === 'manager')?.id ?? 2, counted_at: at, status: 'posted', note: 'Kiểm kê định kỳ cuối tuần' })
    const lines = stock.filter((s) => s.branch_id === b.id).slice(0, 12)
    lines.forEach((s, i) => {
      const variance = rnd() < 0.25 ? Math.round((rnd() * 2 - 1) * 400) / 100 : 0
      ins('stock_count_lines', { id: ++seq, count_id: scId, ingredient_id: s.ingredient_id, system_qty: s.qty, counted_qty: Math.max(0, s.qty + variance), variance, unit_cost: s.avg_cost })
      void i
    })
  })

  // Chuyển kho: kho trung tâm → chi nhánh
  let stId = 0
  branches.forEach((b, bi) => {
    const shipped = d(TODAY, -7 + bi, -300)
    ins('stock_transfers', { id: ++stId, code: `CK${pad(stId, 4)}`, from_branch_id: branches[0].id, to_branch_id: b.id, created_by: 2, status: bi === 0 ? 'received' : 'received', shipped_at: shipped, received_at: d(shipped, 0, 240), note: 'Bổ sung nguyên liệu tuần' })
    ings.slice(bi * 4, bi * 4 + 5).forEach((ing) => {
      ins('stock_transfer_lines', { id: ++seq, transfer_id: stId, ingredient_id: ing.id, qty: ri(2, 20), unit_cost: num(ing.unit_cost) })
    })
  })

  // Lô & hạn dùng (FEFO)
  let batchId = 0
  stock.slice(0, 90).forEach((s, i) => {
    const ing = ings.find((x) => x.id === s.ingredient_id)
    if (!ing) return
    const mfg = d(TODAY, -ri(3, 40))
    ins('ingredient_batches', {
      id: ++batchId, ingredient_id: s.ingredient_id, branch_id: s.branch_id,
      lot_code: `L${TODAY.slice(2, 7).replace('-', '')}${pad(i + 1, 3)}`,
      supplier_id: sups[i % sups.length].id,
      mfg_date: mfg, exp_date: d(mfg, ing.unit === 'g' || ing.unit === 'ml' ? ri(20, 120) : ri(60, 300)),
      qty_received: Math.round(num(s.qty) * 1.6), qty_left: s.qty, unit_cost: s.avg_cost,
    })
  })

  // Hàng huỷ / hao hụt
  const reasons = ['expired', 'spoiled', 'spillage', 'staff', 'other'] as const
  for (let i = 0; i < 46; i++) {
    const s = stock[i % stock.length]
    const ing = ings.find((x) => x.id === s.ingredient_id)
    if (!ing) continue
    ins('wastage_logs', {
      id: ++seq, branch_id: s.branch_id, ingredient_id: s.ingredient_id, qty: ri(50, 900),
      unit: str(ing.unit), reason: pick([...reasons]), unit_cost: s.avg_cost,
      logged_by: users.find((u) => u.role === 'barista')?.id ?? 4, note: 'Ghi nhận theo quy trình huỷ hàng',
      created_at: d(TODAY, -ri(0, 28), -ri(0, 600)),
    })
  }

  /* --------------------- MUA HÀNG & CÔNG NỢ NCC --------------------- */
  let invId = 0
  pos.slice(0, 14).forEach((po, i) => {
    const amount = Math.round(num(po.total))
    const paid = i < 8 ? amount : i < 11 ? Math.round(amount * 0.5) : 0
    const status = paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
    const invIdCur = ++invId
    ins('supplier_invoices', {
      id: invIdCur, code: `HDNCC${pad(invIdCur, 4)}`, supplier_id: po.supplier_id, po_id: po.id,
      issued_at: po.created_at, due_at: d(str(po.created_at), 15), amount, paid_amount: paid, status,
      note: 'Hoá đơn GTGT kèm phiếu nhập',
    })
    const lines = ings.slice(i * 2, i * 2 + 3)
    lines.forEach((ing, k) => {
      const qty = ri(5, 40)
      ins('supplier_invoice_lines', { id: ++seq, invoice_id: invIdCur, ingredient_id: ing.id, qty, unit_cost: num(ing.unit_cost), amount: Math.round(qty * num(ing.unit_cost) * (1 + k * 0)) })
    })
    if (paid > 0) {
      ins('supplier_payments', {
        id: ++seq, supplier_id: po.supplier_id, invoice_id: invIdCur, amount: paid,
        method: pick(['bank', 'transfer', 'cash']), reference: `UNC${pad(seq, 5)}`,
        paid_at: d(str(po.created_at), ri(3, 12)), created_by: 6, note: 'Thanh toán theo kỳ',
      })
    }
  })

  let prId = 0
  branches.forEach((b, i) => {
    const id = ++prId
    ins('purchase_requisitions', { id, code: `DNM${pad(id, 4)}`, branch_id: b.id, requested_by: users.find((u) => u.role === 'manager')?.id ?? 2, needed_at: d(TODAY, 3 + i), status: i === 0 ? 'approved' : 'submitted', note: 'Bổ sung hàng tuần', created_at: d(TODAY, -2 - i) })
    ings.slice(i * 3, i * 3 + 4).forEach((ing) => {
      ins('purchase_requisition_lines', { id: ++seq, requisition_id: id, ingredient_id: ing.id, qty: ri(5, 30), note: 'Sắp hết' })
    })
  })

  /* ------------------- TUỲ CHỌN MÓN / COMBO / GIÁ ------------------- */
  const groups: { id: number; code: string; name: string; kind: string; items: [string, number][] }[] = [
    { id: 1, code: 'SUGAR', name: 'Mức đường', kind: 'sugar', items: [['0% đường', 0], ['30% đường', 0], ['50% đường', 0], ['70% đường', 0], ['100% đường', 0]] },
    { id: 2, code: 'ICE', name: 'Mức đá', kind: 'ice', items: [['Không đá', 0], ['Ít đá', 0], ['Đá bình thường', 0], ['Nhiều đá', 0]] },
    { id: 3, code: 'SIZE', name: 'Cỡ ly', kind: 'size', items: [['Size S', -4000], ['Size M', 0], ['Size L', 6000]] },
    { id: 4, code: 'TOPPING', name: 'Topping thêm', kind: 'topping', items: [['Trân châu', 8000], ['Thạch phô mai', 8000], ['Kem cheese', 10000], ['Pudding trứng', 8000], ['Hạt é', 6000]] },
    { id: 5, code: 'EXTRA', name: 'Yêu cầu khác', kind: 'extra', items: [['Không ống hút', 0], ['Mang đi', 0], ['Tách riêng đá', 0]] },
  ]
  let modId = 0
  groups.forEach((g) => {
    ins('modifier_groups', { id: g.id, code: g.code, name: g.name, kind: g.kind, is_required: g.kind === 'sugar' || g.kind === 'ice' ? 1 : 0, max_select: g.kind === 'topping' ? 3 : 1, sort_order: g.id, is_active: 1 })
    g.items.forEach(([name, price], i) => {
      ins('modifiers', { id: ++modId, group_id: g.id, name, price_delta: price, is_default: i === 2 && g.kind === 'sugar' ? 1 : g.kind === 'ice' && i === 2 ? 1 : g.kind === 'size' && i === 1 ? 1 : 0, is_active: 1, sort_order: i + 1 })
    })
  })
  products.forEach((p) => {
    ins('product_modifier_groups', { id: ++seq, product_id: p.id, group_id: 1 })
    ins('product_modifier_groups', { id: ++seq, product_id: p.id, group_id: 2 })
    ins('product_modifier_groups', { id: ++seq, product_id: p.id, group_id: 4 })
  })

  const combos: [string, string, number, number[]][] = [
    ['COMBO1', 'Combo 2 ly trà sữa + 1 topping', 89000, [1, 2]],
    ['COMBO2', 'Combo cà phê + bánh', 69000, [7, 9]],
    ['COMBO3', 'Combo nhóm 4 ly', 169000, [3, 4, 5, 6]],
  ]
  combos.forEach(([code, name, price, pids], i) => {
    const id = i + 1
    ins('combo_deals', { id, code, name, price, starts_at: '2026-08-01 00:00:00', ends_at: '2026-12-31 23:59:59', is_active: 1 })
    pids.forEach((pid) => {
      ins('combo_deal_items', { id: ++seq, combo_id: id, product_id: pid, size_code: 'M', qty: 1 })
    })
  })

  const lists: [string, string, string][] = [['BG-DINEIN', 'Giá tại quán', 'dine_in'], ['BG-TAKEAWAY', 'Giá mang đi', 'takeaway'], ['BG-DELIVERY', 'Giá giao hàng (app)', 'delivery'], ['BG-GRAB', 'Giá đối tác GrabFood', 'grabfood']]
  lists.forEach(([code, name, channel], i) => {
    const id = i + 1
    ins('price_lists', { id, code, name, branch_id: null, channel, starts_at: '2026-08-01 00:00:00', ends_at: null, is_active: 1 })
    products.forEach((p) => {
      const bump = channel === 'grabfood' ? 1.25 : channel === 'delivery' ? 1.1 : 1
      ins('price_list_items', { id: ++seq, price_list_id: id, product_id: p.id, size_code: 'M', price: Math.round((num(p.base_price) * bump) / 1000) * 1000 })
    })
  })

  /* --------------------------- CRM NÂNG CAO --------------------------- */
  custs.forEach((c, i) => {
    const spent = num(c.total_spent)
    const tier = spent > 3000000 ? 'platinum' : spent > 1500000 ? 'gold' : spent > 700000 ? 'silver' : 'member'
    ins('loyalty_accounts', { id: i + 1, customer_id: c.id, tier, points_balance: num(c.points), lifetime_points: Math.round(num(c.points) * 1.4), joined_at: str(c.created_at), updated_at: NOW })
  })
  let lgId = 0
  orders.slice(0, 260).forEach((o) => {
    if (!o.customer_id) return
    const earn = Math.floor(num(o.total) / 10000)
    if (earn <= 0) return
    const acc = q(`SELECT points_balance FROM loyalty_accounts WHERE customer_id=${o.customer_id}`)[0]
    ins('loyalty_ledger', { id: ++lgId, customer_id: o.customer_id, order_id: o.id, delta: earn, balance_after: num(acc?.points_balance), reason: 'earn', created_at: o.created_at })
  })

  let gcId = 0
  for (let i = 0; i < 16; i++) {
    const amount = pick([100000, 200000, 300000, 500000])
    const id = ++gcId
    ins('gift_cards', { id, code: `GIFT${pad(id, 5)}`, customer_id: i < 10 ? custs[i * 3]?.id ?? null : null, initial_amount: amount, balance: Math.round(amount * (0.3 + rnd() * 0.6) / 1000) * 1000, issued_at: d(TODAY, -ri(10, 90)), expires_at: d(TODAY, ri(180, 500)), is_active: 1 })
    ins('gift_card_txns', { id: ++seq, card_id: id, order_id: null, kind: 'issue', amount, created_at: d(TODAY, -ri(10, 90)) })
  }
  for (let i = 0; i < 22; i++) {
    const card = ri(1, gcId)
    ins('gift_card_txns', { id: ++seq, card_id: card, order_id: orders[i]?.id ?? null, kind: 'redeem', amount: -ri(20000, 90000), created_at: orders[i]?.created_at ?? NOW })
  }

  custs.slice(0, 130).forEach((c, i) => {
    ins('customer_addresses', {
      id: ++seq, customer_id: c.id, label: i % 3 === 0 ? 'Văn phòng' : 'Nhà riêng',
      address: `${ri(10, 320)} ${pick(['Nguyễn Trãi', 'Lê Lợi', 'Điện Biên Phủ', 'Hai Bà Trưng', 'Võ Văn Tần', 'Nguyễn Thị Minh Khai'])}, Quận ${ri(1, 7)}, TP.HCM`,
      lat: 10.75 + rnd() * 0.05, lng: 106.68 + rnd() * 0.05, is_default: i % 3 === 0 ? 0 : 1, created_at: str(c.created_at),
    })
  })

  /* ------------------- GIAO HÀNG: VÙNG / GPS / ĐỐI SOÁT ------------------- */
  branches.forEach((b) => {
    ins('delivery_zones', { id: ++seq, branch_id: b.id, name: `Nội thành gần ${b.name}`, radius_km: 3, base_fee: 12000, fee_per_km: 4000, free_from: 200000, is_active: 1 })
    ins('delivery_zones', { id: ++seq, branch_id: b.id, name: `Mở rộng ${b.name}`, radius_km: 9, base_fee: 20000, fee_per_km: 5000, free_from: null, is_active: 1 })
  })

  const driverIds = [...new Set(dels.map((x) => x.shipper_id))]
  const drivers = driverIds.map((id) => users.find((u) => u.id === id)!).filter(Boolean)
  if (!drivers.length) drivers.push(users.find((u) => u.role === 'cashier') ?? users[0])
  drivers.forEach((u, i) => {
    ins('driver_devices', { id: i + 1, user_id: u.id, device_name: pick(['Samsung Galaxy A54', 'iPhone 13', 'Xiaomi Redmi Note 12']), platform: pick(['android', 'ios']), app_version: '1.4.0', last_seen: NOW, is_active: 1 })
  })
  // Vài mẫu GPS lịch sử (nguồn 'sim') để bản đồ có dữ liệu ngay khi chưa có tài xế phát thật
  let dpId = 0
  dels.slice(0, 12).forEach((dl) => {
    if (!dl.shipper_id) return
    const n = 6
    for (let i = 0; i < n; i++) {
      ins('driver_positions', {
        id: ++dpId, driver_id: dl.shipper_id, delivery_id: dl.id,
        lat: 10.77564 + (rnd() - 0.5) * 0.01, lng: 106.70207 + (rnd() - 0.5) * 0.01,
        heading: Math.round(rnd() * 359), speed_kmh: Math.round(rnd() * 28), accuracy: Math.round(5 + rnd() * 20),
        source: 'sim', recorded_at: d(str(dl.created_at), 0, i * 2),
      })
    }
  })

  drivers.forEach((u, i) => {
    const myDels = dels.filter((x) => x.shipper_id === u.id)
    const cod = myDels.reduce((s, x) => s + num(x.cod_amount), 0)
    const fee = myDels.reduce((s, x) => s + num(x.fee), 0)
    const bonus = i * 50000
    ins('rider_payouts', {
      id: i + 1, driver_id: u.id, period_start: d(TODAY, -7), period_end: d(TODAY, -1),
      deliveries: myDels.length, cod_collected: cod, fee_earned: fee, bonus,
      deducted: 0, net: fee + bonus - cod * 0, status: i === 0 ? 'paid' : 'pending', paid_at: i === 0 ? d(TODAY, -1) : null,
      note: 'Đối soát tuần',
    })
  })

  /* --------------------------- QUỸ & KÉT --------------------------- */
  let csId = 0
  branches.forEach((b, bi) => {
    for (let k = 0; k < 4; k++) {
      const open = d(TODAY, -k, -600 + bi * 30)
      const id = ++csId
      const isClosed = k > 0
      const expected = 3000000 + ri(-200000, 400000)
      const counted = isClosed ? expected + ri(-60000, 40000) : null
      ins('cash_register_sessions', {
        id, branch_id: b.id, register: 'Két 1', opened_by: users.find((u) => u.role === 'cashier')?.id ?? 3,
        opened_at: open, opening_cash: 500000, closed_by: isClosed ? 3 : null, closed_at: isClosed ? d(open, 0, 720) : null,
        counted_cash: counted, expected_cash: expected, variance: counted === null ? null : num(counted) - expected,
        status: isClosed ? 'closed' : 'open', note: isClosed ? 'Chốt ca' : 'Đang mở',
      })
      ins('cash_movements', { id: ++seq, session_id: id, kind: 'deposit', amount: 2000000, reason: 'Nộp quỹ đầu ca', created_by: 3, created_at: open })
      if (isClosed) ins('cash_movements', { id: ++seq, session_id: id, kind: 'drop', amount: 1500000, reason: 'Rút tiền nộp ngân hàng', created_by: 2, created_at: d(open, 0, 400) })
    }
  })

  /* --------------------------- KẾ TOÁN --------------------------- */
  ins('tax_rates', { id: 1, code: 'VAT8', name: 'VAT 8% (F&B)', rate: 0.08, is_inclusive: 0, is_default: 1 })
  ins('tax_rates', { id: 2, code: 'VAT10', name: 'VAT 10%', rate: 0.1, is_inclusive: 0, is_default: 0 })
  ins('tax_rates', { id: 3, code: 'VAT0', name: 'Không chịu thuế (0%)', rate: 0, is_inclusive: 0, is_default: 0 })

  orders.slice(0, 70).forEach((o, i) => {
    const total = num(o.total)
    const sub = Math.round(total / 1.08)
    ins('invoices', {
      id: i + 1, code: `HD${pad(i + 1, 6)}`, order_id: o.id, customer_id: o.customer_id, tax_rate_id: 1,
      issued_at: o.created_at, subtotal: sub, tax_amount: total - sub, total,
      e_invoice_no: i < 40 ? `1C26TAA-${pad(i + 1, 6)}` : null, status: i < 66 ? 'issued' : 'cancelled',
    })
  })

  const cats: [string, string, string][] = [['RENT', 'Mặt bằng', 'fixed'], ['SALARY', 'Lương & thưởng', 'fixed'], ['UTIL', 'Điện nước & internet', 'variable'], ['PACK', 'Bao bì & ly', 'variable'], ['MKT', 'Marketing', 'variable'], ['CAPEX', 'Mua sắm thiết bị', 'capex']]
  cats.forEach(([code, name, kind], i) => ins('expense_categories', { id: i + 1, code, name, kind }))
  for (let i = 0; i < 60; i++) {
    const cat = ri(1, 6)
    ins('expenses', {
      id: ++seq, category_id: cat, branch_id: branches[i % branches.length].id,
      amount: cat === 1 ? ri(20000000, 32000000) : cat === 2 ? ri(15000000, 26000000) : ri(400000, 6000000),
      spent_at: d(TODAY, -ri(0, 60)), vendor: pick(['EVN HCMC', 'Cấp nước Chợ Lớn', 'VNPT', 'Shopee Mall', 'Công ty Bao Bì Sài Gòn', 'Facebook Ads']),
      note: 'Chi phí vận hành tháng', created_by: 6, status: pick(['paid', 'paid', 'approved', 'pending']),
    })
  }

  branches.forEach((b, i) => {
    ;['revenue', 'orders', 'gross_margin'].forEach((metric, k) => {
      ins('kpi_targets', { id: ++seq, branch_id: b.id, period: TODAY.slice(0, 7), metric, target_value: metric === 'revenue' ? 350000000 + i * 50000000 : metric === 'orders' ? 4000 + k * 0 : 62 + k, created_at: d(TODAY, -20) })
    })
  })

  /* --------------------- VẬN HÀNH & THIẾT BỊ --------------------- */
  for (let i = 0; i < 26; i++) {
    const t = tables[i % tables.length]
    ins('reservations', {
      id: i + 1, code: `BK${pad(i + 1, 5)}`, branch_id: t.branch_id, customer_id: custs[i * 2]?.id ?? null, table_id: t.id,
      party_size: ri(2, 8), start_at: d(TODAY, ri(0, 6), ri(0, 8) * 60), duration_min: 90,
      status: pick(['booked', 'booked', 'seated', 'done', 'cancelled']), note: 'Khách đặt qua hotline',
    })
  }

  let prnId = 0
  branches.forEach((b) => {
    const receipt = ++prnId
    ins('printers', { id: receipt, branch_id: b.id, name: `Máy in hoá đơn ${b.name}`, kind: 'receipt', target: 'USB001 / 192.168.1.51', is_active: 1 })
    const label = ++prnId
    ins('printers', { id: label, branch_id: b.id, name: `Máy in tem ly ${b.name}`, kind: 'label', target: 'USB002', is_active: 1 })
    const kitchen = ++prnId
    ins('printers', { id: kitchen, branch_id: b.id, name: `Máy in bếp ${b.name}`, kind: 'kitchen', target: '192.168.1.52', is_active: 1 })
    const rt = tpls.find((t) => /hoá đơn/i.test(t.name)) ?? tpls[0]
    if (rt) ins('printer_routes', { id: ++seq, branch_id: b.id, printer_id: receipt, doc_type: 'receipt', template_id: rt.id, is_active: 1 })
    const lt = tpls.find((t) => /tem/i.test(t.name))
    if (lt) ins('printer_routes', { id: ++seq, branch_id: b.id, printer_id: label, doc_type: 'cup_label', template_id: lt.id, is_active: 1 })
    ins('printer_routes', { id: ++seq, branch_id: b.id, printer_id: kitchen, doc_type: 'kitchen_ticket', template_id: null, is_active: 1 })
  })

  const notes: [string, string, string][] = [
    ['stock', 'Sắp hết nguyên liệu', 'Trân châu tại Q1 còn dưới định mức 20%'],
    ['order', 'Đơn giao hàng trễ', 'VD000016 trễ 10 phút so với ETA'],
    ['finance', 'Chênh lệch két', 'Phiên két Q3 lệch -45.000 ₫'],
    ['system', 'Sao lưu cloud hoàn tất', 'Đã đẩy 60.861 dòng lên Postgres'],
    ['stock', 'Lô sắp hết hạn', 'Lô L2611 003 hết hạn sau 5 ngày'],
  ]
  for (let i = 0; i < 15; i++) {
    const [kind, title, body] = notes[i % notes.length]
    ins('notifications', { id: i + 1, user_id: users[i % users.length]?.id ?? null, branch_id: branches[i % branches.length].id, kind, title, body, is_read: i % 3 === 0 ? 1 : 0, created_at: d(TODAY, -ri(0, 10), -ri(0, 600)) })
  }

  const seqs: [string, number, number][] = [['DH', 4102, 5], ['VD', 36, 5], ['PN', 25, 4], ['HD', 71, 6], ['KK', 5, 3], ['CK', 4, 4]]
  seqs.forEach(([prefix, next, w], i) => {
    ins('document_sequences', { id: i + 1, prefix, next_no: next, pad: w, updated_at: NOW })
  })

  db.run('COMMIT')

  const out: Record<string, number> = {}
  for (const t of ['warehouses', 'stock_counts', 'stock_count_lines', 'stock_transfers', 'stock_transfer_lines', 'ingredient_batches', 'wastage_logs', 'supplier_invoices', 'supplier_invoice_lines', 'supplier_payments', 'purchase_requisitions', 'purchase_requisition_lines', 'modifier_groups', 'modifiers', 'product_modifier_groups', 'combo_deals', 'combo_deal_items', 'price_lists', 'price_list_items', 'loyalty_accounts', 'loyalty_ledger', 'gift_cards', 'gift_card_txns', 'customer_addresses', 'delivery_zones', 'driver_devices', 'driver_positions', 'rider_payouts', 'cash_register_sessions', 'cash_movements', 'tax_rates', 'invoices', 'kpi_targets', 'expense_categories', 'expenses', 'reservations', 'printers', 'printer_routes', 'notifications', 'document_sequences']) {
    out[t] = Number(q(`SELECT COUNT(*) AS n FROM ${t}`)[0]?.n ?? 0)
  }
  return out
}
