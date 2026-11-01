/**
 * Bộ bảng MỞ RỘNG cho vận hành chuỗi trà sữa thực tế (schema v6).
 * Nhóm nghiệp vụ: kho nâng cao (kiểm kê, chuyển kho, lô/hạn dùng, huỷ hàng),
 * mua hàng & công nợ NCC (hoá đơn, thanh toán, đề nghị mua), cấu hình món
 * (modifier đường/đá, combo, bảng giá theo kênh), CRM nâng cao (điểm, thẻ quà,
 * sổ địa chỉ), giao hàng thật (thiết bị tài xế, GPS, vùng phí, đối soát COD),
 * quỹ & két (phiên két, thu chi nội bộ), kế toán (thuế, hoá đơn), vận hành
 * (KPI, chi phí, đặt bàn, máy in, thông báo, cấp số chứng từ).
 *
 * Mọi bảng đều có PK, FK thật, CHECK constraint và index cho truy vấn nóng.
 */
import type { ColumnMeta, TableMeta } from './schema'

export const DDL_EXTRA = /* sql */ `
/* ------------------------- KHO NÂNG CAO ------------------------- */
CREATE TABLE warehouses (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'branch' CHECK (kind IN ('central','branch','cold','dry')),
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (branch_id, code)
);

CREATE TABLE stock_counts (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  counted_by INTEGER REFERENCES users(id),
  counted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','counting','posted','cancelled')),
  note TEXT
);
CREATE INDEX idx_stock_counts_branch ON stock_counts(branch_id, counted_at);

CREATE TABLE stock_count_lines (
  id INTEGER PRIMARY KEY,
  count_id INTEGER NOT NULL REFERENCES stock_counts(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  system_qty REAL NOT NULL DEFAULT 0,
  counted_qty REAL NOT NULL DEFAULT 0,
  variance REAL NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_stock_count_lines_count ON stock_count_lines(count_id);

CREATE TABLE stock_transfers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  from_branch_id INTEGER NOT NULL REFERENCES branches(id),
  to_branch_id INTEGER NOT NULL REFERENCES branches(id),
  created_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_transit','received','cancelled')),
  shipped_at TEXT,
  received_at TEXT,
  note TEXT
);
CREATE INDEX idx_stock_transfers_status ON stock_transfers(status, shipped_at);

CREATE TABLE stock_transfer_lines (
  id INTEGER PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL,
  unit_cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_stock_transfer_lines_tr ON stock_transfer_lines(transfer_id);

CREATE TABLE ingredient_batches (
  id INTEGER PRIMARY KEY,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  lot_code TEXT NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  mfg_date TEXT,
  exp_date TEXT,
  qty_received REAL NOT NULL DEFAULT 0,
  qty_left REAL NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_batches_exp ON ingredient_batches(exp_date);
CREATE INDEX idx_batches_ing ON ingredient_batches(ingredient_id, branch_id);

CREATE TABLE wastage_logs (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  reason TEXT NOT NULL CHECK (reason IN ('expired','spoiled','spillage','staff','other')),
  unit_cost INTEGER NOT NULL DEFAULT 0,
  logged_by INTEGER REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_wastage_time ON wastage_logs(created_at);

/* ---------------------- MUA HÀNG & CÔNG NỢ NCC ---------------------- */
CREATE TABLE supplier_invoices (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  po_id INTEGER REFERENCES purchase_orders(id),
  issued_at TEXT NOT NULL,
  due_at TEXT,
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','overdue','void')),
  note TEXT
);
CREATE INDEX idx_sup_inv_supplier ON supplier_invoices(supplier_id, status);

CREATE TABLE supplier_invoice_lines (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id),
  ingredient_id INTEGER REFERENCES ingredients(id),
  qty REAL NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sup_inv_lines ON supplier_invoice_lines(invoice_id);

CREATE TABLE supplier_payments (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  invoice_id INTEGER REFERENCES supplier_invoices(id),
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'bank' CHECK (method IN ('cash','bank','transfer','offset')),
  reference TEXT,
  paid_at TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  note TEXT
);
CREATE INDEX idx_sup_pay_time ON supplier_payments(paid_at);

CREATE TABLE purchase_requisitions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  requested_by INTEGER REFERENCES users(id),
  needed_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','ordered')),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE purchase_requisition_lines (
  id INTEGER PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES purchase_requisitions(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL,
  note TEXT
);

/* --------------------- CẤU HÌNH MÓN & BẢNG GIÁ --------------------- */
CREATE TABLE modifier_groups (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sugar','ice','topping','size','extra')),
  is_required INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE modifiers (
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES modifier_groups(id),
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_modifiers_group ON modifiers(group_id);

CREATE TABLE product_modifier_groups (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  group_id INTEGER NOT NULL REFERENCES modifier_groups(id),
  UNIQUE (product_id, group_id)
);

CREATE TABLE combo_deals (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE combo_deal_items (
  id INTEGER PRIMARY KEY,
  combo_id INTEGER NOT NULL REFERENCES combo_deals(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  size_code TEXT NOT NULL DEFAULT 'M',
  qty INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_combo_items_combo ON combo_deal_items(combo_id);

CREATE TABLE price_lists (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  channel TEXT NOT NULL DEFAULT 'all' CHECK (channel IN ('all','dine_in','takeaway','delivery','grabfood','shopeefood')),
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE price_list_items (
  id INTEGER PRIMARY KEY,
  price_list_id INTEGER NOT NULL REFERENCES price_lists(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  size_code TEXT NOT NULL DEFAULT 'M',
  price INTEGER NOT NULL,
  UNIQUE (price_list_id, product_id, size_code)
);

/* --------------------------- CRM NÂNG CAO --------------------------- */
CREATE TABLE loyalty_accounts (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id),
  tier TEXT NOT NULL DEFAULT 'member' CHECK (tier IN ('member','silver','gold','platinum')),
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE loyalty_ledger (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL CHECK (reason IN ('earn','redeem','adjust','expire')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_loyalty_ledger_cust ON loyalty_ledger(customer_id, created_at);

CREATE TABLE gift_cards (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  initial_amount INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE gift_card_txns (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES gift_cards(id),
  order_id INTEGER REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('issue','redeem','refund','topup')),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_gift_txn_card ON gift_card_txns(card_id);

CREATE TABLE customer_addresses (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  label TEXT NOT NULL DEFAULT 'Nhà riêng',
  address TEXT NOT NULL,
  lat REAL,
  lng REAL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);
CREATE INDEX idx_cust_addr ON customer_addresses(customer_id);

/* ------------------- GIAO HÀNG THẬT (GPS TÀI XẾ) ------------------- */
CREATE TABLE delivery_zones (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  radius_km REAL NOT NULL DEFAULT 3,
  base_fee INTEGER NOT NULL DEFAULT 12000,
  fee_per_km INTEGER NOT NULL DEFAULT 4000,
  free_from INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_zones_branch ON delivery_zones(branch_id);

CREATE TABLE driver_devices (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  device_name TEXT NOT NULL,
  platform TEXT,
  app_version TEXT,
  last_seen TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE driver_positions (
  id INTEGER PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  delivery_id INTEGER REFERENCES deliveries(id),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  heading REAL,
  speed_kmh REAL,
  accuracy REAL,
  source TEXT NOT NULL DEFAULT 'gps' CHECK (source IN ('gps','manual','sim')),
  recorded_at TEXT NOT NULL
);
CREATE INDEX idx_driver_pos_time ON driver_positions(driver_id, recorded_at);
CREATE INDEX idx_driver_pos_delivery ON driver_positions(delivery_id);

CREATE TABLE rider_payouts (
  id INTEGER PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  deliveries INTEGER NOT NULL DEFAULT 0,
  cod_collected INTEGER NOT NULL DEFAULT 0,
  fee_earned INTEGER NOT NULL DEFAULT 0,
  bonus INTEGER NOT NULL DEFAULT 0,
  deducted INTEGER NOT NULL DEFAULT 0,
  net INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  paid_at TEXT,
  note TEXT
);
CREATE INDEX idx_rider_payouts_driver ON rider_payouts(driver_id, period_start);

/* --------------------------- QUỸ & KÉT --------------------------- */
CREATE TABLE cash_register_sessions (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  register TEXT NOT NULL DEFAULT 'Két 1',
  opened_by INTEGER REFERENCES users(id),
  opened_at TEXT NOT NULL,
  opening_cash INTEGER NOT NULL DEFAULT 0,
  closed_by INTEGER REFERENCES users(id),
  closed_at TEXT,
  counted_cash INTEGER,
  expected_cash INTEGER,
  variance INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  note TEXT
);
CREATE INDEX idx_cash_sessions_branch ON cash_register_sessions(branch_id, opened_at);

CREATE TABLE cash_movements (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES cash_register_sessions(id),
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdraw','drop','pickup','payout')),
  amount INTEGER NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_cash_moves_session ON cash_movements(session_id);

/* ------------------------- KẾ TOÁN / THUẾ ------------------------- */
CREATE TABLE tax_rates (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 0.08,
  is_inclusive INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  order_id INTEGER REFERENCES orders(id),
  customer_id INTEGER REFERENCES customers(id),
  tax_rate_id INTEGER REFERENCES tax_rates(id),
  issued_at TEXT NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  e_invoice_no TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','cancelled','adjusted'))
);
CREATE INDEX idx_invoices_order ON invoices(order_id);

CREATE TABLE expense_categories (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'variable' CHECK (kind IN ('fixed','variable','capex'))
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  amount INTEGER NOT NULL,
  spent_at TEXT NOT NULL,
  vendor TEXT,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','approved','paid','rejected'))
);
CREATE INDEX idx_expenses_time ON expenses(spent_at);

CREATE TABLE kpi_targets (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  period TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_kpi_period ON kpi_targets(period, metric);

/* --------------------- VẬN HÀNH & THIẾT BỊ --------------------- */
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  customer_id INTEGER REFERENCES customers(id),
  table_id INTEGER REFERENCES dining_tables(id),
  party_size INTEGER NOT NULL DEFAULT 2,
  start_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','seated','done','no_show','cancelled')),
  note TEXT
);
CREATE INDEX idx_reservations_time ON reservations(branch_id, start_at);

CREATE TABLE printers (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'receipt' CHECK (kind IN ('receipt','label','kitchen','report')),
  target TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE printer_routes (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  printer_id INTEGER NOT NULL REFERENCES printers(id),
  doc_type TEXT NOT NULL,
  template_id INTEGER REFERENCES print_templates(id),
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_printer_routes_branch ON printer_routes(branch_id, doc_type);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  branch_id INTEGER REFERENCES branches(id),
  kind TEXT NOT NULL DEFAULT 'system' CHECK (kind IN ('order','stock','finance','system')),
  title TEXT NOT NULL,
  body TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE document_sequences (
  id INTEGER PRIMARY KEY,
  prefix TEXT NOT NULL UNIQUE,
  next_no INTEGER NOT NULL DEFAULT 1,
  pad INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT
);
`;

export const TABLES_EXTRA: TableMeta[] = [
  { name: 'warehouses', label: 'Kho', module: 'inventory', icon: '🏭', description: 'Kho trung tâm / kho chi nhánh / kho lạnh — nơi giữ tồn thật.' },
  { name: 'stock_counts', label: 'Phiếu kiểm kê', module: 'inventory', icon: '🧮', description: 'Đợt kiểm kê thực tế: hệ thống ghi gì, đếm được gì, lệch bao nhiêu.' },
  { name: 'stock_count_lines', label: 'Dòng kiểm kê', module: 'inventory', icon: '📐', description: 'Từng nguyên liệu trong phiếu kiểm kê kèm chênh lệch và giá vốn.' },
  { name: 'stock_transfers', label: 'Phiếu chuyển kho', module: 'inventory', icon: '🔁', description: 'Chuyển nguyên liệu giữa chi nhánh: nháp → đang chuyển → đã nhận.' },
  { name: 'stock_transfer_lines', label: 'Dòng chuyển kho', module: 'inventory', icon: '➡️', description: 'Nguyên liệu, số lượng, giá vốn của từng dòng chuyển kho.' },
  { name: 'ingredient_batches', label: 'Lô & hạn dùng', module: 'inventory', icon: '🏷️', description: 'Số lô, ngày sản xuất, hạn dùng, số lượng còn — cơ sở FEFO và cảnh báo hết hạn.' },
  { name: 'wastage_logs', label: 'Hàng huỷ / hao hụt', module: 'inventory', icon: '🗑️', description: 'Ghi nhận hỏng, hết hạn, đổ vỡ, nhân viên dùng — tính vào giá vốn.' },
  { name: 'supplier_invoices', label: 'Hoá đơn NCC', module: 'inventory', icon: '🧾', description: 'Hoá đơn nhà cung cấp, hạn thanh toán, trạng thái công nợ.' },
  { name: 'supplier_invoice_lines', label: 'Dòng hoá đơn NCC', module: 'inventory', icon: '📄', description: 'Chi tiết nguyên liệu trên hoá đơn NCC.' },
  { name: 'supplier_payments', label: 'Thanh toán NCC', module: 'inventory', icon: '💸', description: 'Các lần trả tiền NCC — đối chiếu công nợ tự động.' },
  { name: 'purchase_requisitions', label: 'Đề nghị mua hàng', module: 'inventory', icon: '📥', description: 'Chi nhánh xin mua gì, ai duyệt — trước khi thành PO.' },
  { name: 'purchase_requisition_lines', label: 'Dòng đề nghị mua', module: 'inventory', icon: '📋', description: 'Nguyên liệu và số lượng cần mua trong đề nghị.' },
  { name: 'modifier_groups', label: 'Nhóm tuỳ chọn', module: 'sales', icon: '🎛️', description: 'Nhóm lựa chọn khi order: mức đường, mức đá, topping, cỡ ly.' },
  { name: 'modifiers', label: 'Tuỳ chọn', module: 'sales', icon: '🔘', description: 'Từng lựa chọn trong nhóm: 0% đường, 50% đá, trân châu… kèm giá cộng.' },
  { name: 'product_modifier_groups', label: 'Món ↔ Nhóm tuỳ chọn', module: 'sales', icon: '🧩', description: 'Món nào hiện nhóm tuỳ chọn nào trên màn POS.' },
  { name: 'combo_deals', label: 'Combo', module: 'sales', icon: '🥤', description: 'Gói combo bán kèm giá ưu đãi, thời gian áp dụng.' },
  { name: 'combo_deal_items', label: 'Món trong combo', module: 'sales', icon: '🍹', description: 'Thành phần combo: món, size, số lượng.' },
  { name: 'price_lists', label: 'Bảng giá', module: 'sales', icon: '💰', description: 'Bảng giá theo kênh (tại quán / mang đi / giao hàng / đối tác).' },
  { name: 'price_list_items', label: 'Giá theo bảng', module: 'sales', icon: '🏷️', description: 'Giá từng món theo size trong một bảng giá.' },
  { name: 'loyalty_accounts', label: 'Tài khoản tích điểm', module: 'crm', icon: '⭐', description: 'Điểm hiện có, điểm trọn đời, hạng thành viên của khách.' },
  { name: 'loyalty_ledger', label: 'Sổ điểm', module: 'crm', icon: '📒', description: 'Mọi giao dịch điểm: tích, dùng, điều chỉnh, hết hạn.' },
  { name: 'gift_cards', label: 'Thẻ quà tặng', module: 'crm', icon: '🎁', description: 'Thẻ trả trước: mệnh giá, số dư, hạn dùng.' },
  { name: 'gift_card_txns', label: 'Giao dịch thẻ quà', module: 'crm', icon: '🧾', description: 'Phát hành, nạp, dùng, hoàn tiền trên thẻ quà.' },
  { name: 'customer_addresses', label: 'Sổ địa chỉ khách', module: 'crm', icon: '🏠', description: 'Nhiều địa chỉ giao hàng cho mỗi khách, có toạ độ.' },
  { name: 'delivery_zones', label: 'Vùng giao hàng', module: 'sales', icon: '🗺️', description: 'Bán kính giao, phí cơ bản, phí mỗi km, miễn phí từ bao nhiêu tiền.' },
  { name: 'driver_devices', label: 'Thiết bị tài xế', module: 'sales', icon: '📱', description: 'Máy của tài xế dùng để phát GPS thật, lần hoạt động cuối.' },
  { name: 'driver_positions', label: 'Toạ độ tài xế (GPS)', module: 'sales', icon: '📡', description: 'Dòng toạ độ thật do app tài xế gửi lên: lat/lng, hướng, tốc độ, thời điểm.' },
  { name: 'rider_payouts', label: 'Đối soát tài xế', module: 'sales', icon: '💵', description: 'Chốt kỳ: số đơn, tiền COD thu hộ, phí giao, thưởng, khấu trừ, thực nhận.' },
  { name: 'cash_register_sessions', label: 'Phiên két', module: 'finance', icon: '🧰', description: 'Mở/đóng két theo ca: tiền đầu ca, tiền đếm được, chênh lệch.' },
  { name: 'cash_movements', label: 'Thu chi trong két', module: 'finance', icon: '💰', description: 'Nộp quỹ, rút quỹ, chi tiền mặt trong phiên két.' },
  { name: 'tax_rates', label: 'Mức thuế', module: 'finance', icon: '％', description: 'Thuế suất VAT áp dụng cho hoá đơn.' },
  { name: 'invoices', label: 'Hoá đơn bán hàng', module: 'finance', icon: '🧾', description: 'Hoá đơn xuất cho khách, số hoá đơn điện tử, thuế.' },
  { name: 'kpi_targets', label: 'Mục tiêu KPI', module: 'finance', icon: '🎯', description: 'Chỉ tiêu doanh thu/lợi nhuận theo kỳ cho từng chi nhánh.' },
  { name: 'expense_categories', label: 'Nhóm chi phí', module: 'finance', icon: '🗂️', description: 'Phân loại chi phí: cố định, biến đổi, đầu tư.' },
  { name: 'expenses', label: 'Chi phí', module: 'finance', icon: '📉', description: 'Chi phí thực tế theo nhóm, chi nhánh, trạng thái duyệt.' },
  { name: 'reservations', label: 'Đặt bàn', module: 'sales', icon: '📅', description: 'Khách đặt bàn: giờ, số người, bàn, trạng thái.' },
  { name: 'printers', label: 'Máy in', module: 'system', icon: '🖨️', description: 'Danh sách máy in của từng chi nhánh (hoá đơn, tem ly, bếp, báo cáo).' },
  { name: 'printer_routes', label: 'Định tuyến in', module: 'system', icon: '🔀', description: 'Loại chứng từ nào in ra máy nào, dùng mẫu in nào.' },
  { name: 'notifications', label: 'Thông báo', module: 'system', icon: '🔔', description: 'Thông báo trong app: đơn mới, sắp hết hàng, cảnh báo tài chính.' },
  { name: 'document_sequences', label: 'Cấp số chứng từ', module: 'system', icon: '🔢', description: 'Bộ đếm số tự tăng cho mã đơn, phiếu kho, hoá đơn — không trùng số.' },
]

/* ---------------- Sinh COLUMN_META cho bảng mở rộng ----------------
 * Đọc thẳng từ DDL ở trên để nhãn cột / khoá ngoại luôn khớp với schema thật
 * (không phải bảo trì hai nơi). */
const VI: Record<string, string> = {
  id: 'Khoá chính', code: 'Mã', name: 'Tên', status: 'Trạng thái', note: 'Ghi chú',
  branch_id: 'Chi nhánh', created_at: 'Thời điểm tạo', created_by: 'Người tạo',
  updated_at: 'Cập nhật lúc', warehouse_id: 'Kho', counted_by: 'Người kiểm kê',
  counted_at: 'Ngày kiểm kê', count_id: 'Phiếu kiểm kê', ingredient_id: 'Nguyên liệu',
  system_qty: 'SL hệ thống', counted_qty: 'SL đếm được', variance: 'Chênh lệch',
  unit_cost: 'Giá vốn/đơn vị', from_branch_id: 'Từ chi nhánh', to_branch_id: 'Đến chi nhánh',
  shipped_at: 'Xuất kho lúc', received_at: 'Nhận hàng lúc', transfer_id: 'Phiếu chuyển',
  qty: 'Số lượng', qty_left: 'SL còn lại', qty_received: 'SL nhập', lot_code: 'Số lô',
  mfg_date: 'Ngày sản xuất', exp_date: 'Hạn dùng', supplier_id: 'Nhà cung cấp',
  unit: 'Đơn vị', reason: 'Lý do', logged_by: 'Người ghi', po_id: 'Đơn mua hàng',
  issued_at: 'Ngày phát hành', due_at: 'Hạn thanh toán', amount: 'Số tiền',
  paid_amount: 'Đã trả', invoice_id: 'Hoá đơn', method: 'Phương thức', reference: 'Số tham chiếu',
  paid_at: 'Ngày trả', requested_by: 'Người đề nghị', needed_at: 'Cần hàng lúc',
  requisition_id: 'Đề nghị mua', group_id: 'Nhóm tuỳ chọn', kind: 'Loại',
  is_required: 'Bắt buộc chọn', max_select: 'Chọn tối đa', sort_order: 'Thứ tự',
  is_active: 'Đang dùng', price_delta: 'Giá cộng thêm', is_default: 'Mặc định',
  product_id: 'Sản phẩm', price: 'Giá', starts_at: 'Bắt đầu', ends_at: 'Kết thúc',
  combo_id: 'Combo', size_code: 'Size', channel: 'Kênh bán', price_list_id: 'Bảng giá',
  customer_id: 'Khách hàng', tier: 'Hạng thành viên', points_balance: 'Điểm hiện có',
  lifetime_points: 'Điểm trọn đời', joined_at: 'Ngày tham gia', delta: 'Thay đổi điểm',
  balance_after: 'Số dư sau', order_id: 'Đơn hàng', initial_amount: 'Mệnh giá ban đầu',
  balance: 'Số dư', expires_at: 'Hết hạn', card_id: 'Thẻ quà', label: 'Nhãn',
  address: 'Địa chỉ', lat: 'Vĩ độ', lng: 'Kinh độ', radius_km: 'Bán kính (km)',
  base_fee: 'Phí cơ bản', fee_per_km: 'Phí mỗi km', free_from: 'Miễn phí từ',
  user_id: 'Người dùng', device_name: 'Tên thiết bị', platform: 'Nền tảng',
  app_version: 'Phiên bản app', last_seen: 'Hoạt động lần cuối', driver_id: 'Tài xế',
  delivery_id: 'Vận đơn', heading: 'Hướng di chuyển', speed_kmh: 'Tốc độ (km/h)',
  accuracy: 'Sai số (m)', source: 'Nguồn', recorded_at: 'Thời điểm ghi',
  period_start: 'Kỳ từ ngày', period_end: 'Kỳ đến ngày', deliveries: 'Số đơn',
  cod_collected: 'COD thu hộ', fee_earned: 'Phí giao nhận', bonus: 'Thưởng',
  deducted: 'Khấu trừ', net: 'Thực nhận', register: 'Két', opened_by: 'Người mở két',
  opened_at: 'Mở lúc', opening_cash: 'Tiền đầu ca', closed_by: 'Người đóng két',
  closed_at: 'Đóng lúc', counted_cash: 'Tiền đếm được', expected_cash: 'Tiền phải có',
  session_id: 'Phiên két', rate: 'Thuế suất', is_inclusive: 'Giá đã gồm thuế',
  tax_rate_id: 'Mức thuế', subtotal: 'Tạm tính', tax_amount: 'Tiền thuế', total: 'Tổng cộng',
  e_invoice_no: 'Số hoá đơn điện tử', period: 'Kỳ', metric: 'Chỉ số',
  target_value: 'Giá trị mục tiêu', category_id: 'Nhóm chi phí', spent_at: 'Ngày chi',
  vendor: 'Nhà bán', table_id: 'Bàn', party_size: 'Số khách', start_at: 'Bắt đầu lúc',
  duration_min: 'Thời lượng (phút)', printer_id: 'Máy in', doc_type: 'Loại chứng từ',
  template_id: 'Mẫu in', title: 'Tiêu đề', body: 'Nội dung', is_read: 'Đã đọc',
  prefix: 'Tiền tố', next_no: 'Số kế tiếp', pad: 'Độ dài số',
}

const humanize = (c: string) =>
  VI[c] ?? c.replace(/_id$/, '').replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase())

/** Tách thân CREATE TABLE thành từng dòng cột, tôn trọng dấu phẩy trong CHECK (...). */
function splitTopLevel(body: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of body) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export function parseExtraColumns(): Record<string, ColumnMeta[]> {
  const res: Record<string, ColumnMeta[]> = {}
  const re = /CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(DDL_EXTRA))) {
    const [, table, body] = m
    const cols: ColumnMeta[] = []
    for (const line of splitTopLevel(body)) {
      if (/^(UNIQUE|PRIMARY KEY|CONSTRAINT|FOREIGN KEY|CHECK)\b/i.test(line)) continue
      const cm = /^(\w+)\s+([A-Z]+)(.*)$/i.exec(line)
      if (!cm) continue
      const [, name, type, rest] = cm
      const fk = /REFERENCES\s+(\w+)\s*\((\w+)\)/i.exec(rest)
      cols.push({
        name,
        type,
        description: humanize(name),
        ...(/(^|\s)PRIMARY KEY/i.test(rest) ? { pk: true } : {}),
        ...(/(^|\s)UNIQUE/i.test(rest) ? { unique: true } : {}),
        ...(/NOT NULL/i.test(rest) ? {} : { nullable: true }),
        ...(fk ? { fk: { table: fk[1], column: fk[2] } } : {}),
      })
    }
    res[table] = cols
  }
  return res
}

export const COLUMN_META_EXTRA: Record<string, ColumnMeta[]> = parseExtraColumns()
