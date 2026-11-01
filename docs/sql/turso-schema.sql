-- Matcha POS → Turso/libSQL (SQLite)


CREATE TABLE branches (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  vat_rate REAL NOT NULL DEFAULT 0.08,
  is_active INTEGER NOT NULL DEFAULT 1,
  opened_at TEXT
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','cashier','barista','accountant')),
  branch_id INTEGER REFERENCES branches(id),
  salary INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  hired_at TEXT,
  avatar_emoji TEXT
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_branch ON users(branch_id);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  description TEXT,
  base_price INTEGER NOT NULL,
  cost_price INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ly',
  emoji TEXT,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_bestseller INTEGER NOT NULL DEFAULT 0,
  has_size INTEGER NOT NULL DEFAULT 1,
  sugar_option INTEGER NOT NULL DEFAULT 1,
  ice_option INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

CREATE TABLE product_sizes (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('S','M','L')),
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, code)
);

CREATE TABLE toppings (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'phần',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE product_toppings (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  topping_id INTEGER NOT NULL REFERENCES toppings(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, topping_id)
);

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  debt INTEGER NOT NULL DEFAULT 0,
  payment_terms TEXT
);

CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_cost INTEGER NOT NULL,
  min_stock REAL NOT NULL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id),
  shelf_life_days INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_ing_category ON ingredients(category);

CREATE TABLE recipes (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_code TEXT NOT NULL CHECK (size_code IN ('S','M','L')),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL,
  UNIQUE (product_id, size_code, ingredient_id)
);
CREATE INDEX idx_recipes_product ON recipes(product_id);

CREATE TABLE inventory_stock (
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL DEFAULT 0,
  avg_cost INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (branch_id, ingredient_id)
);

CREATE TABLE inventory_txns (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  txn_type TEXT NOT NULL CHECK (txn_type IN ('in','out','transfer_in','transfer_out','waste','adjust','sale')),
  qty REAL NOT NULL,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  ref_type TEXT,
  ref_id INTEGER,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_invtxn_branch_ing ON inventory_txns(branch_id, ingredient_id);
CREATE INDEX idx_invtxn_created ON inventory_txns(created_at DESC);
CREATE INDEX idx_invtxn_ref ON inventory_txns(ref_type, ref_id);

CREATE TABLE purchase_orders (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  status TEXT NOT NULL CHECK (status IN ('draft','ordered','received','cancelled')),
  subtotal INTEGER NOT NULL DEFAULT 0,
  vat INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  received_at TEXT
);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_branch ON purchase_orders(branch_id);

CREATE TABLE purchase_order_items (
  id INTEGER PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty REAL NOT NULL,
  unit_cost INTEGER NOT NULL,
  amount INTEGER NOT NULL
);
CREATE INDEX idx_poi_po ON purchase_order_items(po_id);

CREATE TABLE dining_tables (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  zone TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 4,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'empty' CHECK (status IN ('empty','occupied','reserved')),
  UNIQUE (branch_id, code)
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  birthday TEXT,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','diamond')),
  points INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_customers_tier ON customers(tier);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TABLE vouchers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  campaign TEXT,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value INTEGER NOT NULL,
  min_order INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  tier_required TEXT CHECK (tier_required IN ('bronze','silver','gold','diamond')),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE promotions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('happy_hour','tier_discount','combo','bogo')),
  config TEXT NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  start_at TEXT,
  end_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE shifts (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_cash INTEGER NOT NULL DEFAULT 0,
  cash_in INTEGER NOT NULL DEFAULT 0,
  cash_out INTEGER NOT NULL DEFAULT 0,
  counted_cash INTEGER,
  expected_cash INTEGER,
  variance INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  note TEXT
);
CREATE INDEX idx_shifts_branch ON shifts(branch_id, status);

CREATE TABLE shift_cash_txns (
  id INTEGER PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  amount INTEGER NOT NULL,
  reason TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  channel TEXT NOT NULL CHECK (channel IN ('dine_in','takeaway','delivery')),
  source TEXT NOT NULL DEFAULT 'pos' CHECK (source IN ('pos','grabfood','shopeefood','website','app')),
  table_id INTEGER REFERENCES dining_tables(id),
  customer_id INTEGER REFERENCES customers(id),
  cashier_id INTEGER REFERENCES users(id),
  shift_id INTEGER REFERENCES shifts(id),
  queue_no INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','completed','cancelled')),
  subtotal INTEGER NOT NULL DEFAULT 0,
  item_discount INTEGER NOT NULL DEFAULT 0,
  promotion_discount INTEGER NOT NULL DEFAULT 0,
  voucher_id INTEGER REFERENCES vouchers(id),
  voucher_discount INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  points_used INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  cogs INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  cancel_reason TEXT,
  created_at TEXT NOT NULL,
  preparing_at TEXT,
  ready_at TEXT,
  completed_at TEXT
);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_branch_created ON orders(branch_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  size_code TEXT NOT NULL DEFAULT 'M',
  sugar_level INTEGER NOT NULL DEFAULT 100,
  ice_level INTEGER NOT NULL DEFAULT 100,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE TABLE order_item_toppings (
  id INTEGER PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  topping_id INTEGER NOT NULL REFERENCES toppings(id),
  topping_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL
);
CREATE INDEX idx_oit_item ON order_item_toppings(order_item_id);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash','qr','card','momo','zalopay','credit')),
  amount INTEGER NOT NULL,
  paid_at TEXT NOT NULL,
  ref TEXT,
  bank_txn_ref TEXT,
  verified_at TEXT,
  verified_by INTEGER REFERENCES users(id)
);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_method ON payments(method);

CREATE TABLE order_events (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_events_order ON order_events(order_id);

CREATE TABLE finance_entries (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  entry_date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ref_type TEXT,
  ref_id INTEGER,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_fin_date ON finance_entries(entry_date DESC);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before_value TEXT,
  after_value TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);

CREATE TABLE deliveries (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  shipper_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('waiting','assigned','picked_up','delivering','delivered','failed','cancelled')),
  address TEXT NOT NULL,
  district TEXT,
  lat REAL, lng REAL,
  distance_km REAL NOT NULL DEFAULT 0,
  fee INTEGER NOT NULL DEFAULT 0,
  cod_amount INTEGER NOT NULL DEFAULT 0,
  eta_minutes INTEGER,
  eta_at TEXT,
  customer_note TEXT,
  proof_photo TEXT,
  rating INTEGER,
  fail_reason TEXT,
  created_at TEXT NOT NULL,
  assigned_at TEXT,
  picked_at TEXT,
  delivered_at TEXT
);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_branch ON deliveries(branch_id);
CREATE INDEX idx_deliveries_shipper ON deliveries(shipper_id);

CREATE TABLE delivery_events (
  id INTEGER PRIMARY KEY,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  lat REAL, lng REAL,
  actor TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_delivery_events_delivery ON delivery_events(delivery_id);

CREATE TABLE bank_accounts (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  bank_bin TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_no TEXT NOT NULL,
  account_name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE print_templates (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('receipt','cup_label','delivery_note','stocktake','price_tag','shift_report')),
  paper TEXT NOT NULL CHECK (paper IN ('k80','k57','a5','a4')),
  width_mm INTEGER NOT NULL,
  layout TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE print_jobs (
  id INTEGER PRIMARY KEY,
  template_code TEXT NOT NULL,
  ref_type TEXT,
  ref_id INTEGER,
  copies INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('queued','printed','failed','reprinted')),
  printer TEXT,
  user_id INTEGER REFERENCES users(id),
  payload TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_print_jobs_created ON print_jobs(created_at);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  perms TEXT NOT NULL DEFAULT '',
  is_system INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_roles_created ON roles(created_at);


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

CREATE TABLE IF NOT EXISTS admin_accounts (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, is_active INTEGER DEFAULT 1, failed_count INTEGER DEFAULT 0, locked_until TEXT, last_login TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS admin_sessions (id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, username TEXT, expires_at TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS sync_tokens (id TEXT PRIMARY KEY, label TEXT, token_hash TEXT UNIQUE, branch_id INTEGER, active INTEGER DEFAULT 1, note TEXT, created_at TEXT, can_write INTEGER DEFAULT 0);
