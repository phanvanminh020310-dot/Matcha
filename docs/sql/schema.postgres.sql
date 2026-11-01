-- Matcha POS · schema Postgres (Supabase/Neon) — sinh tự động từ src/lib/schema.ts + schema-extra.ts
-- 74 bảng · schema v6 · chạy toàn bộ file này trong SQL Editor một lần.
-- Sau đó chạy docs/sql/rls.sql để siết quyền ghi bằng mã đồng bộ (khuyến nghị).

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

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  perms TEXT NOT NULL DEFAULT '',
  is_system INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roles_created ON roles(created_at);;

export type ModuleKey = 'sales' | 'inventory' | 'crm' | 'hr' | 'finance' | 'system';

export interface ColumnMeta {
  name: string;
  type: string;
  pk?: boolean;
  fk?: { table: string; column: string };
  unique?: boolean;
  nullable?: boolean;
  indexed?: boolean;
  description: string;
}

export interface TableMeta {
  name: string;
  label: string;
  module: ModuleKey;
  description: string;
  icon: string;
}

export const MODULES: Record<ModuleKey, { label: string; color: string }> = {
  sales: { label: 'Bán hàng', color: '#16a34a' },
  inventory: { label: 'Kho & Mua hàng', color: '#0ea5e9' },
  crm: { label: 'Khách hàng', color: '#fb7f14' },
  hr: { label: 'Nhân sự', color: '#8b5cf6' },
  finance: { label: 'Tài chính', color: '#e11d48' },
  system: { label: 'Hệ thống', color: '#64748b' },
};

export const TABLES: TableMeta[] = [
  { name: 'branches', label: 'Chi nhánh', module: 'system', icon: '🏬', description: 'Cửa hàng/chi nhánh trong chuỗi, cấu hình VAT riêng.' },
  { name: 'users', label: 'Người dùng', module: 'hr', icon: '👤', description: 'Nhân viên và tài khoản đăng nhập, gắn vai trò RBAC.' },
  { name: 'categories', label: 'Danh mục món', module: 'sales', icon: '🗂️', description: 'Nhóm thực đơn: trà sữa, cà phê, đá xay…' },
  { name: 'products', label: 'Sản phẩm', module: 'sales', icon: '🧋', description: 'Món bán, giá gốc, giá vốn, cờ bật/tắt bán.' },
  { name: 'product_sizes', label: 'Size & giá chênh', module: 'sales', icon: '📏', description: 'Size S/M/L và phần giá cộng thêm của từng món.' },
  { name: 'toppings', label: 'Topping', module: 'sales', icon: '🍡', description: 'Topping bán kèm và đơn giá.' },
  { name: 'product_toppings', label: 'Món ↔ Topping', module: 'sales', icon: '🔗', description: 'Bảng nối N-N: topping nào được phép dùng cho món nào.' },
  { name: 'orders', label: 'Đơn hàng', module: 'sales', icon: '🧾', description: 'Đầu đơn: kênh bán, tổng tiền, trạng thái, COGS.' },
  { name: 'order_items', label: 'Dòng đơn', module: 'sales', icon: '🥤', description: 'Từng ly trong đơn kèm size/đường/đá và giá vốn.' },
  { name: 'order_item_toppings', label: 'Topping của ly', module: 'sales', icon: '🍮', description: 'Topping gắn vào từng dòng đơn (giá đã chốt).' },
  { name: 'payments', label: 'Thanh toán', module: 'sales', icon: '💳', description: 'Các lần thanh toán của đơn, hỗ trợ nhiều phương thức.' },
  { name: 'order_events', label: 'Dòng thời gian đơn', module: 'sales', icon: '⏱️', description: 'Vết trạng thái: pending → preparing → ready → completed.' },
  { name: 'dining_tables', label: 'Bàn', module: 'sales', icon: '🪑', description: 'Sơ đồ bàn theo khu vực, toạ độ kéo thả.' },
  { name: 'shifts', label: 'Ca làm việc', module: 'hr', icon: '⏳', description: 'Ca thu ngân: tiền đầu ca, chốt ca, chênh lệch.' },
  { name: 'shift_cash_txns', label: 'Thu/chi trong ca', module: 'hr', icon: '💵', description: 'Các lần nộp/rút tiền mặt trong ca.' },
  { name: 'ingredients', label: 'Nguyên vật liệu', module: 'inventory', icon: '🌿', description: 'Nguyên liệu pha chế, đơn vị tính, giá vốn, định mức tối thiểu.' },
  { name: 'recipes', label: 'Công thức (BOM)', module: 'inventory', icon: '📖', description: 'Định lượng nguyên liệu cho từng món theo size.' },
  { name: 'inventory_stock', label: 'Tồn kho', module: 'inventory', icon: '📦', description: 'Tồn hiện tại theo chi nhánh + giá vốn bình quân.' },
  { name: 'inventory_txns', label: 'Thẻ kho', module: 'inventory', icon: '📜', description: 'Mọi biến động kho: nhập, xuất, chuyển, huỷ, bán.' },
  { name: 'suppliers', label: 'Nhà cung cấp', module: 'inventory', icon: '🚚', description: 'NCC, điều khoản thanh toán, công nợ.' },
  { name: 'purchase_orders', label: 'Đơn mua hàng', module: 'inventory', icon: '📝', description: 'PO: draft → ordered → received.' },
  { name: 'purchase_order_items', label: 'Dòng PO', module: 'inventory', icon: '📋', description: 'Nguyên liệu, số lượng, đơn giá trong PO.' },
  { name: 'customers', label: 'Khách hàng', module: 'crm', icon: '💚', description: 'Hồ sơ khách, hạng thành viên, điểm tích luỹ.' },
  { name: 'vouchers', label: 'Voucher', module: 'crm', icon: '🎟️', description: 'Mã giảm giá: % hoặc số tiền, điều kiện, hạn dùng.' },
  { name: 'promotions', label: 'Khuyến mãi', module: 'crm', icon: '🎉', description: 'CTKM tự động: giờ vàng, giảm theo hạng, combo, BOGO.' },
  { name: 'finance_entries', label: 'Sổ thu chi', module: 'finance', icon: '📊', description: 'Bút toán thu/chi: mặt bằng, điện nước, lương, nhập hàng…' },
  { name: 'audit_logs', label: 'Nhật ký', module: 'system', icon: '🔍', description: 'Audit log các thao tác ghi dữ liệu quan trọng.' },
  { name: 'deliveries', label: 'Vận đơn giao hàng', module: 'sales', icon: '🛵', description: 'Vận đơn: shipper, toạ độ, khoảng cách, phí ship, COD, ETA, bằng chứng giao.' },
  { name: 'delivery_events', label: 'Hành trình giao', module: 'sales', icon: '📍', description: 'Vết trạng thái giao hàng kèm toạ độ — nguồn cho trang theo dõi của khách.' },
  { name: 'bank_accounts', label: 'Tài khoản nhận tiền', module: 'finance', icon: '🏦', description: 'Số tài khoản ngân hàng dùng để sinh VietQR (chuẩn EMVCo).' },
  { name: 'print_templates', label: 'Mẫu in', module: 'system', icon: '🖨️', description: 'Thiết kế mẫu hoá đơn K80/K57/A5, tem ly, phiếu giao hàng (layout JSON).' },
  { name: 'print_jobs', label: 'Hàng đợi in', module: 'system', icon: '📤', description: 'Lịch sử lệnh in: mẫu, bản ghi liên quan, số bản, máy in, trạng thái.' },
  { name: 'app_meta', label: 'Cấu hình', module: 'system', icon: '⚙️', description: 'Metadata ứng dụng: phiên bản schema, seed time.' },
  { name: 'roles', label: 'Vai trò & quyền', module: 'system', icon: '🛡️', description: 'Vai trò RBAC động: tập quyền theo module, gán cho người dùng, không cần build lại app.' },
  ...TABLES_EXTRA,
];

const C = (name: string, type: string, description: string, extra: Partial<ColumnMeta> = {}): ColumnMeta => ({
  name, type, description, ...extra,
});

/** Mô tả cột — hiển thị ở tab "Cấu trúc bảng" của Data Explorer. */
const COLUMN_META_CORE: Record<string, ColumnMeta[]> = {
  branches: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('code', 'TEXT', 'Mã chi nhánh', { unique: true }),
    C('name', 'TEXT', 'Tên chi nhánh'),
    C('address', 'TEXT', 'Địa chỉ'),
    C('city', 'TEXT', 'Tỉnh/thành'),
    C('phone', 'TEXT', 'Hotline', { nullable: true }),
    C('vat_rate', 'DOUBLE PRECISION', 'Thuế VAT áp dụng (0.08 = 8%)'),
    C('is_active', 'INTEGER', 'Đang hoạt động'),
    C('opened_at', 'TEXT', 'Ngày khai trương', { nullable: true }),
  ],
  users: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('name', 'TEXT', 'Họ tên'),
    C('email', 'TEXT', 'Email đăng nhập', { unique: true }),
    C('phone', 'TEXT', 'Số điện thoại', { nullable: true }),
    C('password', 'TEXT', 'Mật khẩu demo (plaintext — chỉ dùng cho bản demo)'),
    C('role', 'TEXT', 'Vai trò RBAC'),
    C('branch_id', 'INTEGER', 'Chi nhánh trực thuộc', { fk: { table: 'branches', column: 'id' } }),
    C('salary', 'INTEGER', 'Lương cơ bản (VND)'),
    C('is_active', 'INTEGER', 'Đang làm việc'),
    C('hired_at', 'TEXT', 'Ngày vào làm', { nullable: true }),
    C('avatar_emoji', 'TEXT', 'Ảnh đại diện (emoji)', { nullable: true }),
  ],
  categories: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('name', 'TEXT', 'Tên danh mục'),
    C('slug', 'TEXT', 'Slug', { unique: true }),
    C('emoji', 'TEXT', 'Icon', { nullable: true }),
    C('sort_order', 'INTEGER', 'Thứ tự hiển thị'),
    C('is_active', 'INTEGER', 'Đang bán'),
  ],
  products: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('sku', 'TEXT', 'Mã món', { unique: true, indexed: true }),
    C('name', 'TEXT', 'Tên món'),
    C('category_id', 'INTEGER', 'Danh mục', { fk: { table: 'categories', column: 'id' }, indexed: true }),
    C('description', 'TEXT', 'Mô tả ngắn', { nullable: true }),
    C('base_price', 'INTEGER', 'Giá bán size M (VND)'),
    C('cost_price', 'INTEGER', 'Giá vốn bình quân (VND)'),
    C('unit', 'TEXT', 'Đơn vị bán'),
    C('emoji', 'TEXT', 'Icon fallback khi ảnh lỗi', { nullable: true }),
    C('image_url', 'TEXT', 'Ảnh minh hoạ', { nullable: true }),
    C('is_active', 'INTEGER', 'Đang bán', { indexed: true }),
    C('is_bestseller', 'INTEGER', 'Gắn nhãn bán chạy'),
    C('has_size', 'INTEGER', 'Có chọn size'),
    C('sugar_option', 'INTEGER', 'Cho chọn mức đường'),
    C('ice_option', 'INTEGER', 'Cho chọn mức đá'),
    C('created_at', 'TEXT', 'Ngày tạo'),
  ],
  product_sizes: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('product_id', 'INTEGER', 'Món', { fk: { table: 'products', column: 'id' } }),
    C('code', 'TEXT', 'S / M / L'),
    C('name', 'TEXT', 'Tên hiển thị'),
    C('price_delta', 'INTEGER', 'Giá cộng thêm so với size M'),
  ],
  toppings: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('name', 'TEXT', 'Tên topping'),
    C('price', 'INTEGER', 'Đơn giá'),
    C('unit', 'TEXT', 'Đơn vị'),
    C('is_active', 'INTEGER', 'Đang bán'),
  ],
  product_toppings: [
    C('product_id', 'INTEGER', 'Món', { pk: true, fk: { table: 'products', column: 'id' } }),
    C('topping_id', 'INTEGER', 'Topping', { pk: true, fk: { table: 'toppings', column: 'id' } }),
  ],
  orders: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('code', 'TEXT', 'Mã đơn', { unique: true }),
    C('branch_id', 'INTEGER', 'Chi nhánh', { fk: { table: 'branches', column: 'id' }, indexed: true }),
    C('channel', 'TEXT', 'Kênh: tại quán / mang đi / giao hàng'),
    C('source', 'TEXT', 'Nguồn đơn: POS, GrabFood, ShopeeFood, Website, App'),
    C('table_id', 'INTEGER', 'Bàn (đơn tại quán)', { fk: { table: 'dining_tables', column: 'id' }, nullable: true }),
    C('customer_id', 'INTEGER', 'Khách hàng', { fk: { table: 'customers', column: 'id' }, nullable: true, indexed: true }),
    C('cashier_id', 'INTEGER', 'Thu ngân', { fk: { table: 'users', column: 'id' }, nullable: true }),
    C('shift_id', 'INTEGER', 'Ca làm việc', { fk: { table: 'shifts', column: 'id' }, nullable: true }),
    C('queue_no', 'INTEGER', 'Số thứ tự gọi món', { nullable: true }),
    C('status', 'TEXT', 'Trạng thái đơn', { indexed: true }),
    C('subtotal', 'INTEGER', 'Tạm tính trước giảm giá'),
    C('item_discount', 'INTEGER', 'Giảm giá theo món'),
    C('promotion_discount', 'INTEGER', 'Giảm giá CTKM tự động'),
    C('voucher_id', 'INTEGER', 'Voucher đã áp', { fk: { table: 'vouchers', column: 'id' }, nullable: true }),
    C('voucher_discount', 'INTEGER', 'Số tiền voucher giảm'),
    C('vat_amount', 'INTEGER', 'Tiền VAT'),
    C('delivery_fee', 'INTEGER', 'Phí giao hàng'),
    C('points_used', 'INTEGER', 'Điểm đã dùng để trả'),
    C('points_earned', 'INTEGER', 'Điểm tích thêm'),
    C('total', 'INTEGER', 'Tổng khách phải trả'),
    C('cogs', 'INTEGER', 'Giá vốn hàng bán (COGS)'),
    C('note', 'TEXT', 'Ghi chú đơn', { nullable: true }),
    C('cancel_reason', 'TEXT', 'Lý do huỷ', { nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm tạo', { indexed: true }),
    C('preparing_at', 'TEXT', 'Bắt đầu pha chế', { nullable: true }),
    C('ready_at', 'TEXT', 'Pha chế xong', { nullable: true }),
    C('completed_at', 'TEXT', 'Hoàn tất / giao khách', { nullable: true }),
  ],
  order_items: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('order_id', 'INTEGER', 'Đơn hàng', { fk: { table: 'orders', column: 'id' }, indexed: true }),
    C('product_id', 'INTEGER', 'Món', { fk: { table: 'products', column: 'id' }, indexed: true }),
    C('product_name', 'TEXT', 'Tên món tại thời điểm bán (snapshot)'),
    C('size_code', 'TEXT', 'Size'),
    C('sugar_level', 'INTEGER', 'Mức đường 0/30/50/70/100'),
    C('ice_level', 'INTEGER', 'Mức đá 0/30/50/70/100'),
    C('qty', 'INTEGER', 'Số lượng'),
    C('unit_price', 'INTEGER', 'Đơn giá đã gồm size + topping'),
    C('discount', 'INTEGER', 'Giảm giá dòng'),
    C('unit_cost', 'INTEGER', 'Giá vốn đơn vị (từ BOM)'),
    C('note', 'TEXT', 'Ghi chú cho pha chế', { nullable: true }),
  ],
  order_item_toppings: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('order_item_id', 'INTEGER', 'Dòng đơn', { fk: { table: 'order_items', column: 'id' }, indexed: true }),
    C('topping_id', 'INTEGER', 'Topping', { fk: { table: 'toppings', column: 'id' } }),
    C('topping_name', 'TEXT', 'Tên topping (snapshot)'),
    C('qty', 'INTEGER', 'Số phần'),
    C('price', 'INTEGER', 'Đơn giá'),
  ],
  payments: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('order_id', 'INTEGER', 'Đơn hàng', { fk: { table: 'orders', column: 'id' }, indexed: true }),
    C('method', 'TEXT', 'Phương thức thanh toán', { indexed: true }),
    C('amount', 'INTEGER', 'Số tiền'),
    C('paid_at', 'TEXT', 'Thời điểm thanh toán'),
    C('ref', 'TEXT', 'Mã giao dịch/tham chiếu', { nullable: true }),
  ],
  order_events: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('order_id', 'INTEGER', 'Đơn hàng', { fk: { table: 'orders', column: 'id' }, indexed: true }),
    C('status', 'TEXT', 'Trạng thái ghi nhận'),
    C('note', 'TEXT', 'Ghi chú', { nullable: true }),
    C('user_id', 'INTEGER', 'Người thực hiện', { fk: { table: 'users', column: 'id' }, nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm'),
  ],
  dining_tables: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('branch_id', 'INTEGER', 'Chi nhánh', { fk: { table: 'branches', column: 'id' } }),
    C('code', 'TEXT', 'Mã bàn'),
    C('name', 'TEXT', 'Tên bàn'),
    C('zone', 'TEXT', 'Khu vực (Tầng 1, Sân vườn…)'),
    C('seats', 'INTEGER', 'Số chỗ'),
    C('x', 'INTEGER', 'Toạ độ X trên sơ đồ'),
    C('y', 'INTEGER', 'Toạ độ Y trên sơ đồ'),
    C('status', 'TEXT', 'Trạng thái bàn'),
  ],
  shifts: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('branch_id', 'INTEGER', 'Chi nhánh', { fk: { table: 'branches', column: 'id' }, indexed: true }),
    C('user_id', 'INTEGER', 'Thu ngân', { fk: { table: 'users', column: 'id' } }),
    C('opened_at', 'TEXT', 'Giờ mở ca'),
    C('closed_at', 'TEXT', 'Giờ chốt ca', { nullable: true }),
    C('opening_cash', 'INTEGER', 'Tiền mặt đầu ca'),
    C('cash_in', 'INTEGER', 'Tổng nộp vào két'),
    C('cash_out', 'INTEGER', 'Tổng rút khỏi két'),
    C('counted_cash', 'INTEGER', 'Tiền mặt kiểm đếm', { nullable: true }),
    C('expected_cash', 'INTEGER', 'Tiền mặt lý thuyết', { nullable: true }),
    C('variance', 'INTEGER', 'Chênh lệch', { nullable: true }),
    C('status', 'TEXT', 'Đang mở / đã chốt'),
    C('note', 'TEXT', 'Ghi chú', { nullable: true }),
  ],
  shift_cash_txns: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('shift_id', 'INTEGER', 'Ca', { fk: { table: 'shifts', column: 'id' } }),
    C('type', 'TEXT', 'Nộp / rút'),
    C('amount', 'INTEGER', 'Số tiền'),
    C('reason', 'TEXT', 'Lý do', { nullable: true }),
    C('user_id', 'INTEGER', 'Người thực hiện', { fk: { table: 'users', column: 'id' }, nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm'),
  ],
  ingredients: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('sku', 'TEXT', 'Mã nguyên liệu', { unique: true }),
    C('name', 'TEXT', 'Tên nguyên liệu'),
    C('category', 'TEXT', 'Nhóm: trà, sữa, trái cây, topping, bao bì…'),
    C('unit', 'TEXT', 'Đơn vị tính (g, ml, cái)'),
    C('unit_cost', 'INTEGER', 'Giá vốn trên 1 đơn vị'),
    C('min_stock', 'DOUBLE PRECISION', 'Định mức tồn tối thiểu'),
    C('supplier_id', 'INTEGER', 'NCC chính', { fk: { table: 'suppliers', column: 'id' }, nullable: true }),
    C('shelf_life_days', 'INTEGER', 'Hạn sử dụng (ngày)', { nullable: true }),
    C('is_active', 'INTEGER', 'Đang dùng'),
  ],
  recipes: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('product_id', 'INTEGER', 'Món', { fk: { table: 'products', column: 'id' }, indexed: true }),
    C('size_code', 'TEXT', 'Áp cho size nào'),
    C('ingredient_id', 'INTEGER', 'Nguyên liệu', { fk: { table: 'ingredients', column: 'id' } }),
    C('qty', 'DOUBLE PRECISION', 'Định lượng (theo đơn vị nguyên liệu)'),
  ],
  inventory_stock: [
    C('branch_id', 'INTEGER', 'Chi nhánh', { pk: true, fk: { table: 'branches', column: 'id' } }),
    C('ingredient_id', 'INTEGER', 'Nguyên liệu', { pk: true, fk: { table: 'ingredients', column: 'id' } }),
    C('qty', 'DOUBLE PRECISION', 'Tồn hiện tại'),
    C('avg_cost', 'INTEGER', 'Giá vốn bình quân'),
    C('updated_at', 'TEXT', 'Lần cập nhật cuối'),
  ],
  inventory_txns: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('branch_id', 'INTEGER', 'Chi nhánh', { fk: { table: 'branches', column: 'id' }, indexed: true }),
    C('ingredient_id', 'INTEGER', 'Nguyên liệu', { fk: { table: 'ingredients', column: 'id' }, indexed: true }),
    C('txn_type', 'TEXT', 'Loại biến động'),
    C('qty', 'DOUBLE PRECISION', 'Số lượng (+/-)'),
    C('unit_cost', 'INTEGER', 'Đơn giá vốn'),
    C('ref_type', 'TEXT', 'Bảng tham chiếu (orders, purchase_orders…)', { nullable: true }),
    C('ref_id', 'INTEGER', 'Id bản ghi tham chiếu', { nullable: true }),
    C('note', 'TEXT', 'Diễn giải', { nullable: true }),
    C('user_id', 'INTEGER', 'Người thực hiện', { fk: { table: 'users', column: 'id' }, nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm', { indexed: true }),
  ],
  suppliers: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('code', 'TEXT', 'Mã NCC', { unique: true }),
    C('name', 'TEXT', 'Tên nhà cung cấp'),
    C('contact_name', 'TEXT', 'Người liên hệ', { nullable: true }),
    C('phone', 'TEXT', 'Điện thoại', { nullable: true }),
    C('email', 'TEXT', 'Email', { nullable: true }),
    C('address', 'TEXT', 'Địa chỉ', { nullable: true }),
    C('debt', 'INTEGER', 'Công nợ hiện tại'),
    C('payment_terms', 'TEXT', 'Điều khoản thanh toán', { nullable: true }),
  ],
  purchase_orders: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('code', 'TEXT', 'Mã PO', { unique: true }),
    C('supplier_id', 'INTEGER', 'Nhà cung cấp', { fk: { table: 'suppliers', column: 'id' } }),
    C('branch_id', 'INTEGER', 'Chi nhánh nhận', { fk: { table: 'branches', column: 'id' }, indexed: true }),
    C('status', 'TEXT', 'Trạng thái PO', { indexed: true }),
    C('subtotal', 'INTEGER', 'Tiền hàng'),
    C('vat', 'INTEGER', 'VAT'),
    C('total', 'INTEGER', 'Tổng PO'),
    C('note', 'TEXT', 'Ghi chú', { nullable: true }),
    C('created_by', 'INTEGER', 'Người tạo', { fk: { table: 'users', column: 'id' }, nullable: true }),
    C('created_at', 'TEXT', 'Ngày tạo'),
    C('received_at', 'TEXT', 'Ngày nhận hàng', { nullable: true }),
  ],
  purchase_order_items: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('po_id', 'INTEGER', 'Đơn mua', { fk: { table: 'purchase_orders', column: 'id' }, indexed: true }),
    C('ingredient_id', 'INTEGER', 'Nguyên liệu', { fk: { table: 'ingredients', column: 'id' } }),
    C('qty', 'DOUBLE PRECISION', 'Số lượng đặt'),
    C('unit_cost', 'INTEGER', 'Đơn giá'),
    C('amount', 'INTEGER', 'Thành tiền'),
  ],
  customers: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('code', 'TEXT', 'Mã khách', { unique: true }),
    C('name', 'TEXT', 'Họ tên'),
    C('phone', 'TEXT', 'SĐT (dùng tra cứu tại POS)', { unique: true, indexed: true }),
    C('email', 'TEXT', 'Email', { nullable: true }),
    C('birthday', 'TEXT', 'Sinh nhật (MM-DD)', { nullable: true }),
    C('tier', 'TEXT', 'Hạng thành viên', { indexed: true }),
    C('points', 'INTEGER', 'Điểm hiện có'),
    C('total_spent', 'INTEGER', 'Tổng chi tiêu'),
    C('order_count', 'INTEGER', 'Số đơn'),
    C('note', 'TEXT', 'Ghi chú', { nullable: true }),
    C('created_at', 'TEXT', 'Ngày tạo'),
  ],
  vouchers: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('code', 'TEXT', 'Mã voucher', { unique: true }),
    C('name', 'TEXT', 'Tên chương trình'),
    C('campaign', 'TEXT', 'Nhóm chiến dịch', { nullable: true }),
    C('type', 'TEXT', 'percent / fixed'),
    C('value', 'INTEGER', 'Giá trị giảm'),
    C('min_order', 'INTEGER', 'Đơn tối thiểu'),
    C('max_discount', 'INTEGER', 'Giảm tối đa', { nullable: true }),
    C('usage_limit', 'INTEGER', 'Giới hạn lượt dùng', { nullable: true }),
    C('used_count', 'INTEGER', 'Đã dùng'),
    C('tier_required', 'TEXT', 'Hạng khách tối thiểu', { nullable: true }),
    C('start_at', 'TEXT', 'Bắt đầu'),
    C('end_at', 'TEXT', 'Kết thúc'),
    C('is_active', 'INTEGER', 'Đang chạy'),
  ],
  promotions: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('name', 'TEXT', 'Tên CTKM'),
    C('type', 'TEXT', 'Loại CTKM'),
    C('config', 'TEXT', 'Tham số (JSON)'),
    C('branch_id', 'INTEGER', 'Áp cho chi nhánh', { fk: { table: 'branches', column: 'id' }, nullable: true }),
    C('start_at', 'TEXT', 'Bắt đầu', { nullable: true }),
    C('end_at', 'TEXT', 'Kết thúc', { nullable: true }),
    C('is_active', 'INTEGER', 'Đang chạy'),
    C('created_at', 'TEXT', 'Ngày tạo'),
  ],
  finance_entries: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('branch_id', 'INTEGER', 'Chi nhánh', { fk: { table: 'branches', column: 'id' } }),
    C('entry_date', 'TEXT', 'Ngày hạch toán', { indexed: true }),
    C('type', 'TEXT', 'Thu / chi'),
    C('category', 'TEXT', 'Loại: rent, salary, utilities, purchase…'),
    C('amount', 'INTEGER', 'Số tiền'),
    C('ref_type', 'TEXT', 'Bảng tham chiếu', { nullable: true }),
    C('ref_id', 'INTEGER', 'Id tham chiếu', { nullable: true }),
    C('note', 'TEXT', 'Diễn giải', { nullable: true }),
    C('created_by', 'INTEGER', 'Người tạo', { fk: { table: 'users', column: 'id' }, nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm tạo'),
  ],
  audit_logs: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('user_id', 'INTEGER', 'Người thực hiện', { fk: { table: 'users', column: 'id' }, nullable: true }),
    C('action', 'TEXT', 'Hành động'),
    C('entity', 'TEXT', 'Bảng bị tác động'),
    C('entity_id', 'TEXT', 'Id bản ghi'),
    C('before_value', 'TEXT', 'Giá trị trước (JSON)', { nullable: true }),
    C('after_value', 'TEXT', 'Giá trị sau (JSON)', { nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm'),
  ],
  deliveries: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('order_id', 'INTEGER', 'Đơn hàng được giao', { fk: { table: 'orders', column: 'id' }, unique: true }),
    C('branch_id', 'INTEGER', 'Chi nhánh xuất phát', { fk: { table: 'branches', column: 'id' }, indexed: true }),
    C('shipper_id', 'INTEGER', 'Tài xế giao hàng', { fk: { table: 'users', column: 'id' }, nullable: true, indexed: true }),
    C('status', 'TEXT', 'waiting → assigned → picked_up → delivering → delivered / failed'),
    C('address', 'TEXT', 'Địa chỉ giao (đã geocode)'),
    C('district', 'TEXT', 'Quận/khu vực giao', { nullable: true }),
    C('lat', 'DOUBLE PRECISION', 'Vĩ độ điểm giao', { nullable: true }),
    C('lng', 'DOUBLE PRECISION', 'Kinh độ điểm giao', { nullable: true }),
    C('distance_km', 'DOUBLE PRECISION', 'Khoảng cách tuyến đường (OSRM)'),
    C('fee', 'INTEGER', 'Phí giao hàng thu khách'),
    C('cod_amount', 'INTEGER', 'Tiền thu hộ (COD)'),
    C('eta_minutes', 'INTEGER', 'Thời gian giao dự kiến (phút)', { nullable: true }),
    C('eta_at', 'TEXT', 'Thời điểm dự kiến giao xong', { nullable: true }),
    C('customer_note', 'TEXT', 'Ghi chú của khách', { nullable: true }),
    C('proof_photo', 'TEXT', 'Ảnh xác nhận giao (data URL)', { nullable: true }),
    C('rating', 'INTEGER', 'Khách đánh giá 1–5 sao', { nullable: true }),
    C('fail_reason', 'TEXT', 'Lý do giao thất bại', { nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm tạo vận đơn'),
    C('assigned_at', 'TEXT', 'Thời điểm gán shipper', { nullable: true }),
    C('picked_at', 'TEXT', 'Thời điểm lấy hàng', { nullable: true }),
    C('delivered_at', 'TEXT', 'Thời điểm giao thành công', { nullable: true }),
  ],
  delivery_events: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('delivery_id', 'INTEGER', 'Vận đơn', { fk: { table: 'deliveries', column: 'id' }, indexed: true }),
    C('status', 'TEXT', 'Trạng thái tại thời điểm ghi'),
    C('note', 'TEXT', 'Diễn giải', { nullable: true }),
    C('lat', 'DOUBLE PRECISION', 'Vĩ độ lúc ghi nhận', { nullable: true }),
    C('lng', 'DOUBLE PRECISION', 'Kinh độ lúc ghi nhận', { nullable: true }),
    C('actor', 'TEXT', 'Người/hệ thống ghi nhận', { nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm'),
  ],
  bank_accounts: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('branch_id', 'INTEGER', 'Chi nhánh', { fk: { table: 'branches', column: 'id' }, nullable: true }),
    C('bank_bin', 'TEXT', 'Mã BIN ngân hàng (NAPAS)'),
    C('bank_name', 'TEXT', 'Tên ngân hàng'),
    C('account_no', 'TEXT', 'Số tài khoản nhận tiền'),
    C('account_name', 'TEXT', 'Chủ tài khoản'),
    C('is_default', 'INTEGER', 'Dùng mặc định'),
  ],
  print_templates: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('code', 'TEXT', 'Mã mẫu', { unique: true }),
    C('name', 'TEXT', 'Tên mẫu in'),
    C('kind', 'TEXT', 'Loại: receipt, cup_label, delivery_note, stocktake, price_tag, shift_report'),
    C('paper', 'TEXT', 'Khổ giấy k80/k57/a5/a4'),
    C('width_mm', 'INTEGER', 'Chiều rộng (mm)'),
    C('layout', 'TEXT', 'JSON phần tử thiết kế'),
    C('is_default', 'INTEGER', 'Mẫu mặc định cho loại này'),
    C('updated_at', 'TEXT', 'Cập nhật lần cuối'),
  ],
  print_jobs: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('template_code', 'TEXT', 'Mẫu được in', { indexed: true }),
    C('ref_type', 'TEXT', 'Bảng tham chiếu', { nullable: true }),
    C('ref_id', 'INTEGER', 'Bản ghi tham chiếu', { nullable: true }),
    C('copies', 'INTEGER', 'Số bản in'),
    C('status', 'TEXT', 'queued / printed / failed / reprinted'),
    C('printer', 'TEXT', 'Máy in nhận lệnh', { nullable: true }),
    C('user_id', 'INTEGER', 'Người bấm in', { fk: { table: 'users', column: 'id' }, nullable: true }),
    C('payload', 'TEXT', 'Dữ liệu đã in (JSON)', { nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm'),
  ],
  app_meta: [
    C('key', 'TEXT', 'Khoá', { pk: true }),
    C('value', 'TEXT', 'Giá trị'),
  ],
  roles: [
    C('id', 'TEXT', 'Mã vai trò (vd: manager)', { pk: true }),
    C('name', 'TEXT', 'Tên hiển thị'),
    C('description', 'TEXT', 'Mô tả quyền hạn', { nullable: true }),
    C('perms', 'TEXT', 'Danh sách quyền, phân cách bằng dấu phẩy'),
    C('is_system', 'INTEGER', 'Vai trò hệ thống (không xoá được)'),
    C('color', 'TEXT', 'Màu nhận diện', { nullable: true }),
    C('created_at', 'TEXT', 'Thời điểm tạo'),
  ],
};

/** Mô tả cột: bảng lõi viết tay + bảng mở rộng sinh tự động từ DDL. */
export const COLUMN_META: Record<string, ColumnMeta[]> = { ...COLUMN_META_CORE, ...COLUMN_META_EXTRA };

export const FK_EDGES: { from: string; fromCol: string; to: string; toCol: string }[] = Object.entries(COLUMN_META).flatMap(
  ([table, cols]) =>
    cols
      .filter((c) => c.fk)
      .map((c) => ({ from: table, fromCol: c.name, to: c.fk!.table, toCol: c.fk!.column })),
);
/* ------------------------- KHO NÂNG CAO ------------------------- */
CREATE TABLE IF NOT EXISTS warehouses (
  id BIGINT PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'branch' CHECK (kind IN ('central','branch','cold','dry')),
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (branch_id, code)
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  counted_by INTEGER REFERENCES users(id),
  counted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','counting','posted','cancelled')),
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_stock_counts_branch ON stock_counts(branch_id, counted_at);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  id BIGINT PRIMARY KEY,
  count_id INTEGER NOT NULL REFERENCES stock_counts(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  system_qty DOUBLE PRECISION NOT NULL DEFAULT 0,
  counted_qty DOUBLE PRECISION NOT NULL DEFAULT 0,
  variance DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_count ON stock_count_lines(count_id);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  from_branch_id INTEGER NOT NULL REFERENCES branches(id),
  to_branch_id INTEGER NOT NULL REFERENCES branches(id),
  created_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_transit','received','cancelled')),
  shipped_at TEXT,
  received_at TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status, shipped_at);

CREATE TABLE IF NOT EXISTS stock_transfer_lines (
  id BIGINT PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty DOUBLE PRECISION NOT NULL,
  unit_cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_tr ON stock_transfer_lines(transfer_id);

CREATE TABLE IF NOT EXISTS ingredient_batches (
  id BIGINT PRIMARY KEY,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  lot_code TEXT NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  mfg_date TEXT,
  exp_date TEXT,
  qty_received DOUBLE PRECISION NOT NULL DEFAULT 0,
  qty_left DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_batches_exp ON ingredient_batches(exp_date);
CREATE INDEX IF NOT EXISTS idx_batches_ing ON ingredient_batches(ingredient_id, branch_id);

CREATE TABLE IF NOT EXISTS wastage_logs (
  id BIGINT PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  reason TEXT NOT NULL CHECK (reason IN ('expired','spoiled','spillage','staff','other')),
  unit_cost INTEGER NOT NULL DEFAULT 0,
  logged_by INTEGER REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wastage_time ON wastage_logs(created_at);

/* ---------------------- MUA HÀNG & CÔNG NỢ NCC ---------------------- */
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_sup_inv_supplier ON supplier_invoices(supplier_id, status);

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id BIGINT PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id),
  ingredient_id INTEGER REFERENCES ingredients(id),
  qty DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sup_inv_lines ON supplier_invoice_lines(invoice_id);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id BIGINT PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  invoice_id INTEGER REFERENCES supplier_invoices(id),
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'bank' CHECK (method IN ('cash','bank','transfer','offset')),
  reference TEXT,
  paid_at TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_sup_pay_time ON supplier_payments(paid_at);

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  requested_by INTEGER REFERENCES users(id),
  needed_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','ordered')),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_requisition_lines (
  id BIGINT PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES purchase_requisitions(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty DOUBLE PRECISION NOT NULL,
  note TEXT
);

/* --------------------- CẤU HÌNH MÓN & BẢNG GIÁ --------------------- */
CREATE TABLE IF NOT EXISTS modifier_groups (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sugar','ice','topping','size','extra')),
  is_required INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS modifiers (
  id BIGINT PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES modifier_groups(id),
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_modifiers_group ON modifiers(group_id);

CREATE TABLE IF NOT EXISTS product_modifier_groups (
  id BIGINT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  group_id INTEGER NOT NULL REFERENCES modifier_groups(id),
  UNIQUE (product_id, group_id)
);

CREATE TABLE IF NOT EXISTS combo_deals (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS combo_deal_items (
  id BIGINT PRIMARY KEY,
  combo_id INTEGER NOT NULL REFERENCES combo_deals(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  size_code TEXT NOT NULL DEFAULT 'M',
  qty INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_deal_items(combo_id);

CREATE TABLE IF NOT EXISTS price_lists (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  channel TEXT NOT NULL DEFAULT 'all' CHECK (channel IN ('all','dine_in','takeaway','delivery','grabfood','shopeefood')),
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS price_list_items (
  id BIGINT PRIMARY KEY,
  price_list_id INTEGER NOT NULL REFERENCES price_lists(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  size_code TEXT NOT NULL DEFAULT 'M',
  price INTEGER NOT NULL,
  UNIQUE (price_list_id, product_id, size_code)
);

/* --------------------------- CRM NÂNG CAO --------------------------- */
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id BIGINT PRIMARY KEY,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id),
  tier TEXT NOT NULL DEFAULT 'member' CHECK (tier IN ('member','silver','gold','platinum')),
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id BIGINT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL CHECK (reason IN ('earn','redeem','adjust','expire')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_cust ON loyalty_ledger(customer_id, created_at);

CREATE TABLE IF NOT EXISTS gift_cards (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  initial_amount INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS gift_card_txns (
  id BIGINT PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES gift_cards(id),
  order_id INTEGER REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('issue','redeem','refund','topup')),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gift_txn_card ON gift_card_txns(card_id);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id BIGINT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  label TEXT NOT NULL DEFAULT 'Nhà riêng',
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cust_addr ON customer_addresses(customer_id);

/* ------------------- GIAO HÀNG THẬT (GPS TÀI XẾ) ------------------- */
CREATE TABLE IF NOT EXISTS delivery_zones (
  id BIGINT PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  radius_km DOUBLE PRECISION NOT NULL DEFAULT 3,
  base_fee INTEGER NOT NULL DEFAULT 12000,
  fee_per_km INTEGER NOT NULL DEFAULT 4000,
  free_from INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_zones_branch ON delivery_zones(branch_id);

CREATE TABLE IF NOT EXISTS driver_devices (
  id BIGINT PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  device_name TEXT NOT NULL,
  platform TEXT,
  app_version TEXT,
  last_seen TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS driver_positions (
  id BIGINT PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  delivery_id INTEGER REFERENCES deliveries(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'gps' CHECK (source IN ('gps','manual','sim')),
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_driver_pos_time ON driver_positions(driver_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_driver_pos_delivery ON driver_positions(delivery_id);

CREATE TABLE IF NOT EXISTS rider_payouts (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_rider_payouts_driver ON rider_payouts(driver_id, period_start);

/* --------------------------- QUỸ & KÉT --------------------------- */
CREATE TABLE IF NOT EXISTS cash_register_sessions (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch ON cash_register_sessions(branch_id, opened_at);

CREATE TABLE IF NOT EXISTS cash_movements (
  id BIGINT PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES cash_register_sessions(id),
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdraw','drop','pickup','payout')),
  amount INTEGER NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cash_moves_session ON cash_movements(session_id);

/* ------------------------- KẾ TOÁN / THUẾ ------------------------- */
CREATE TABLE IF NOT EXISTS tax_rates (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rate DOUBLE PRECISION NOT NULL DEFAULT 0.08,
  is_inclusive INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);

CREATE TABLE IF NOT EXISTS expense_categories (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'variable' CHECK (kind IN ('fixed','variable','capex'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  amount INTEGER NOT NULL,
  spent_at TEXT NOT NULL,
  vendor TEXT,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','approved','paid','rejected'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_time ON expenses(spent_at);

CREATE TABLE IF NOT EXISTS kpi_targets (
  id BIGINT PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  period TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value DOUBLE PRECISION NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kpi_period ON kpi_targets(period, metric);

/* --------------------- VẬN HÀNH & THIẾT BỊ --------------------- */
CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(branch_id, start_at);

CREATE TABLE IF NOT EXISTS printers (
  id BIGINT PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'receipt' CHECK (kind IN ('receipt','label','kitchen','report')),
  target TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS printer_routes (
  id BIGINT PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  printer_id INTEGER NOT NULL REFERENCES printers(id),
  doc_type TEXT NOT NULL,
  template_id INTEGER REFERENCES print_templates(id),
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_printer_routes_branch ON printer_routes(branch_id, doc_type);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  branch_id INTEGER REFERENCES branches(id),
  kind TEXT NOT NULL DEFAULT 'system' CHECK (kind IN ('order','stock','finance','system')),
  title TEXT NOT NULL,
  body TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS document_sequences (
  id BIGINT PRIMARY KEY,
  prefix TEXT NOT NULL UNIQUE,
  next_no INTEGER NOT NULL DEFAULT 1,
  pad INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT
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

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_roles ON roles;
CREATE POLICY matcha_all_roles ON roles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_warehouses ON warehouses;
CREATE POLICY matcha_all_warehouses ON warehouses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_stock_counts ON stock_counts;
CREATE POLICY matcha_all_stock_counts ON stock_counts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE stock_count_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_stock_count_lines ON stock_count_lines;
CREATE POLICY matcha_all_stock_count_lines ON stock_count_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_stock_transfers ON stock_transfers;
CREATE POLICY matcha_all_stock_transfers ON stock_transfers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE stock_transfer_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_stock_transfer_lines ON stock_transfer_lines;
CREATE POLICY matcha_all_stock_transfer_lines ON stock_transfer_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE ingredient_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_ingredient_batches ON ingredient_batches;
CREATE POLICY matcha_all_ingredient_batches ON ingredient_batches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE wastage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_wastage_logs ON wastage_logs;
CREATE POLICY matcha_all_wastage_logs ON wastage_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_supplier_invoices ON supplier_invoices;
CREATE POLICY matcha_all_supplier_invoices ON supplier_invoices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_supplier_invoice_lines ON supplier_invoice_lines;
CREATE POLICY matcha_all_supplier_invoice_lines ON supplier_invoice_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_supplier_payments ON supplier_payments;
CREATE POLICY matcha_all_supplier_payments ON supplier_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_purchase_requisitions ON purchase_requisitions;
CREATE POLICY matcha_all_purchase_requisitions ON purchase_requisitions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE purchase_requisition_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_purchase_requisition_lines ON purchase_requisition_lines;
CREATE POLICY matcha_all_purchase_requisition_lines ON purchase_requisition_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_modifier_groups ON modifier_groups;
CREATE POLICY matcha_all_modifier_groups ON modifier_groups FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_modifiers ON modifiers;
CREATE POLICY matcha_all_modifiers ON modifiers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_product_modifier_groups ON product_modifier_groups;
CREATE POLICY matcha_all_product_modifier_groups ON product_modifier_groups FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE combo_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_combo_deals ON combo_deals;
CREATE POLICY matcha_all_combo_deals ON combo_deals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE combo_deal_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_combo_deal_items ON combo_deal_items;
CREATE POLICY matcha_all_combo_deal_items ON combo_deal_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_price_lists ON price_lists;
CREATE POLICY matcha_all_price_lists ON price_lists FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_price_list_items ON price_list_items;
CREATE POLICY matcha_all_price_list_items ON price_list_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_loyalty_accounts ON loyalty_accounts;
CREATE POLICY matcha_all_loyalty_accounts ON loyalty_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE loyalty_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_loyalty_ledger ON loyalty_ledger;
CREATE POLICY matcha_all_loyalty_ledger ON loyalty_ledger FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_gift_cards ON gift_cards;
CREATE POLICY matcha_all_gift_cards ON gift_cards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE gift_card_txns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_gift_card_txns ON gift_card_txns;
CREATE POLICY matcha_all_gift_card_txns ON gift_card_txns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_customer_addresses ON customer_addresses;
CREATE POLICY matcha_all_customer_addresses ON customer_addresses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_delivery_zones ON delivery_zones;
CREATE POLICY matcha_all_delivery_zones ON delivery_zones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE driver_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_driver_devices ON driver_devices;
CREATE POLICY matcha_all_driver_devices ON driver_devices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE driver_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_driver_positions ON driver_positions;
CREATE POLICY matcha_all_driver_positions ON driver_positions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE rider_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_rider_payouts ON rider_payouts;
CREATE POLICY matcha_all_rider_payouts ON rider_payouts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE cash_register_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_cash_register_sessions ON cash_register_sessions;
CREATE POLICY matcha_all_cash_register_sessions ON cash_register_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_cash_movements ON cash_movements;
CREATE POLICY matcha_all_cash_movements ON cash_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_tax_rates ON tax_rates;
CREATE POLICY matcha_all_tax_rates ON tax_rates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_invoices ON invoices;
CREATE POLICY matcha_all_invoices ON invoices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_kpi_targets ON kpi_targets;
CREATE POLICY matcha_all_kpi_targets ON kpi_targets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_expense_categories ON expense_categories;
CREATE POLICY matcha_all_expense_categories ON expense_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_expenses ON expenses;
CREATE POLICY matcha_all_expenses ON expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_reservations ON reservations;
CREATE POLICY matcha_all_reservations ON reservations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_printers ON printers;
CREATE POLICY matcha_all_printers ON printers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE printer_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_printer_routes ON printer_routes;
CREATE POLICY matcha_all_printer_routes ON printer_routes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_notifications ON notifications;
CREATE POLICY matcha_all_notifications ON notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS matcha_all_document_sequences ON document_sequences;
CREATE POLICY matcha_all_document_sequences ON document_sequences FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
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
GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON warehouses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_counts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_count_lines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_transfers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_transfer_lines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ingredient_batches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wastage_logs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_invoices TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_invoice_lines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_requisitions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_requisition_lines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON modifier_groups TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON modifiers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_modifier_groups TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON combo_deals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON combo_deal_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON price_lists TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON price_list_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON loyalty_accounts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON loyalty_ledger TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gift_cards TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gift_card_txns TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_addresses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_zones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON driver_devices TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON driver_positions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rider_payouts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cash_register_sessions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cash_movements TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tax_rates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_targets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON expense_categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reservations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON printers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON printer_routes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_sequences TO anon, authenticated;
COMMIT;
