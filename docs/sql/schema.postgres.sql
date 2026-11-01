BEGIN;



CREATE TABLE IF NOT EXISTS branches (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  vat_rate DOUBLE PRECISION NOT NULL DEFAULT 0.08,
  is_active INTEGER NOT NULL DEFAULT 1,
  opened_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE TABLE IF NOT EXISTS product_sizes (
  id BIGINT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('S','M','L')),
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, code)
);

CREATE TABLE IF NOT EXISTS toppings (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'phần',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS product_toppings (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  topping_id INTEGER NOT NULL REFERENCES toppings(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, topping_id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  debt INTEGER NOT NULL DEFAULT 0,
  payment_terms TEXT
);

CREATE TABLE IF NOT EXISTS ingredients (
  id BIGINT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_cost INTEGER NOT NULL,
  min_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id),
  shelf_life_days INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_ing_category ON ingredients(category);

CREATE TABLE IF NOT EXISTS recipes (
  id BIGINT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_code TEXT NOT NULL CHECK (size_code IN ('S','M','L')),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty DOUBLE PRECISION NOT NULL,
  UNIQUE (product_id, size_code, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);

CREATE TABLE IF NOT EXISTS inventory_stock (
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg_cost INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (branch_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_txns (
  id BIGINT PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  txn_type TEXT NOT NULL CHECK (txn_type IN ('in','out','transfer_in','transfer_out','waste','adjust','sale')),
  qty DOUBLE PRECISION NOT NULL,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  ref_type TEXT,
  ref_id INTEGER,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invtxn_branch_ing ON inventory_txns(branch_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_invtxn_created ON inventory_txns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invtxn_ref ON inventory_txns(ref_type, ref_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty DOUBLE PRECISION NOT NULL,
  unit_cost INTEGER NOT NULL,
  amount INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(po_id);

CREATE TABLE IF NOT EXISTS dining_tables (
  id BIGINT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS vouchers (
  id BIGINT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS promotions (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('happy_hour','tier_discount','combo','bogo')),
  config TEXT NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  start_at TEXT,
  end_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts(branch_id, status);

CREATE TABLE IF NOT EXISTS shift_cash_txns (
  id BIGINT PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  amount INTEGER NOT NULL,
  reason TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_branch_created ON orders(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE TABLE IF NOT EXISTS order_item_toppings (
  id BIGINT PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  topping_id INTEGER NOT NULL REFERENCES toppings(id),
  topping_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oit_item ON order_item_toppings(order_item_id);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash','qr','card','momo','zalopay','credit')),
  amount INTEGER NOT NULL,
  paid_at TEXT NOT NULL,
  ref TEXT,
  bank_txn_ref TEXT,
  verified_at TEXT,
  verified_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);

CREATE TABLE IF NOT EXISTS order_events (
  id BIGINT PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);

CREATE TABLE IF NOT EXISTS finance_entries (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_fin_date ON finance_entries(entry_date DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before_value TEXT,
  after_value TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS deliveries (
  id BIGINT PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  shipper_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('waiting','assigned','picked_up','delivering','delivered','failed','cancelled')),
  address TEXT NOT NULL,
  district TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_branch ON deliveries(branch_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_shipper ON deliveries(shipper_id);

CREATE TABLE IF NOT EXISTS delivery_events (
  id BIGINT PRIMARY KEY,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  actor TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_delivery_events_delivery ON delivery_events(delivery_id);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id BIGINT PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  bank_bin TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_no TEXT NOT NULL,
  account_name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS print_templates (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('receipt','cup_label','delivery_note','stocktake','price_tag','shift_report')),
  paper TEXT NOT NULL CHECK (paper IN ('k80','k57','a5','a4')),
  width_mm INTEGER NOT NULL,
  layout TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_print_jobs_created ON print_jobs(created_at);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);


ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_branches ON branches;
CREATE POLICY matcha_all_branches ON branches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_users ON users;
CREATE POLICY matcha_all_users ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_categories ON categories;
CREATE POLICY matcha_all_categories ON categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_products ON products;
CREATE POLICY matcha_all_products ON products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_product_sizes ON product_sizes;
CREATE POLICY matcha_all_product_sizes ON product_sizes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE toppings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_toppings ON toppings;
CREATE POLICY matcha_all_toppings ON toppings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE product_toppings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_product_toppings ON product_toppings;
CREATE POLICY matcha_all_product_toppings ON product_toppings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_orders ON orders;
CREATE POLICY matcha_all_orders ON orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_order_items ON order_items;
CREATE POLICY matcha_all_order_items ON order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE order_item_toppings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_order_item_toppings ON order_item_toppings;
CREATE POLICY matcha_all_order_item_toppings ON order_item_toppings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_payments ON payments;
CREATE POLICY matcha_all_payments ON payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_order_events ON order_events;
CREATE POLICY matcha_all_order_events ON order_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_dining_tables ON dining_tables;
CREATE POLICY matcha_all_dining_tables ON dining_tables FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_shifts ON shifts;
CREATE POLICY matcha_all_shifts ON shifts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shift_cash_txns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_shift_cash_txns ON shift_cash_txns;
CREATE POLICY matcha_all_shift_cash_txns ON shift_cash_txns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_ingredients ON ingredients;
CREATE POLICY matcha_all_ingredients ON ingredients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_recipes ON recipes;
CREATE POLICY matcha_all_recipes ON recipes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_inventory_stock ON inventory_stock;
CREATE POLICY matcha_all_inventory_stock ON inventory_stock FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE inventory_txns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_inventory_txns ON inventory_txns;
CREATE POLICY matcha_all_inventory_txns ON inventory_txns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_suppliers ON suppliers;
CREATE POLICY matcha_all_suppliers ON suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_purchase_orders ON purchase_orders;
CREATE POLICY matcha_all_purchase_orders ON purchase_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_purchase_order_items ON purchase_order_items;
CREATE POLICY matcha_all_purchase_order_items ON purchase_order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_customers ON customers;
CREATE POLICY matcha_all_customers ON customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_vouchers ON vouchers;
CREATE POLICY matcha_all_vouchers ON vouchers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_promotions ON promotions;
CREATE POLICY matcha_all_promotions ON promotions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE finance_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_finance_entries ON finance_entries;
CREATE POLICY matcha_all_finance_entries ON finance_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_audit_logs ON audit_logs;
CREATE POLICY matcha_all_audit_logs ON audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_deliveries ON deliveries;
CREATE POLICY matcha_all_deliveries ON deliveries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_delivery_events ON delivery_events;
CREATE POLICY matcha_all_delivery_events ON delivery_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_bank_accounts ON bank_accounts;
CREATE POLICY matcha_all_bank_accounts ON bank_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE print_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_print_templates ON print_templates;
CREATE POLICY matcha_all_print_templates ON print_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_print_jobs ON print_jobs;
CREATE POLICY matcha_all_print_jobs ON print_jobs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE app_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_app_meta ON app_meta;
CREATE POLICY matcha_all_app_meta ON app_meta FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON branches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_sizes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON toppings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_toppings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_item_toppings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dining_tables TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shifts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_cash_txns TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ingredients TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recipes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_stock TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_txns TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vouchers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON promotions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON finance_entries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deliveries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_accounts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON print_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON print_jobs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_meta TO anon, authenticated;
COMMIT;
