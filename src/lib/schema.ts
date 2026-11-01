/**
 * Schema quan hệ của Matcha POS (SQLite / sql.js).
 * Mọi bảng đều có PK, FK có ràng buộc, có index cho các truy vấn nóng.
 * TABLE_META cung cấp mô tả nghiệp vụ tiếng Việt dùng cho Data Explorer + ERD.
 */

import { COLUMN_META_EXTRA, DDL_EXTRA, TABLES_EXTRA } from './schema-extra'

export const SCHEMA_VERSION = 6;

export const DDL = /* sql */ `
PRAGMA foreign_keys = ON;

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
` + DDL_EXTRA;

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
    C('vat_rate', 'REAL', 'Thuế VAT áp dụng (0.08 = 8%)'),
    C('is_active', 'INTEGER', 'Đang hoạt động'),
    C('opened_at', 'TEXT', 'Ngày khai trương', { nullable: true }),
  ],
  users: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('name', 'TEXT', 'Họ tên'),
    C('email', 'TEXT', 'Email đăng nhập', { unique: true }),
    C('phone', 'TEXT', 'Số điện thoại', { nullable: true }),
    C('password', 'TEXT', 'Mật khẩu đăng nhập (băm PBKDF2, không bao giờ lưu chữ thường)'),
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
    C('min_stock', 'REAL', 'Định mức tồn tối thiểu'),
    C('supplier_id', 'INTEGER', 'NCC chính', { fk: { table: 'suppliers', column: 'id' }, nullable: true }),
    C('shelf_life_days', 'INTEGER', 'Hạn sử dụng (ngày)', { nullable: true }),
    C('is_active', 'INTEGER', 'Đang dùng'),
  ],
  recipes: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('product_id', 'INTEGER', 'Món', { fk: { table: 'products', column: 'id' }, indexed: true }),
    C('size_code', 'TEXT', 'Áp cho size nào'),
    C('ingredient_id', 'INTEGER', 'Nguyên liệu', { fk: { table: 'ingredients', column: 'id' } }),
    C('qty', 'REAL', 'Định lượng (theo đơn vị nguyên liệu)'),
  ],
  inventory_stock: [
    C('branch_id', 'INTEGER', 'Chi nhánh', { pk: true, fk: { table: 'branches', column: 'id' } }),
    C('ingredient_id', 'INTEGER', 'Nguyên liệu', { pk: true, fk: { table: 'ingredients', column: 'id' } }),
    C('qty', 'REAL', 'Tồn hiện tại'),
    C('avg_cost', 'INTEGER', 'Giá vốn bình quân'),
    C('updated_at', 'TEXT', 'Lần cập nhật cuối'),
  ],
  inventory_txns: [
    C('id', 'INTEGER', 'Khoá chính', { pk: true }),
    C('branch_id', 'INTEGER', 'Chi nhánh', { fk: { table: 'branches', column: 'id' }, indexed: true }),
    C('ingredient_id', 'INTEGER', 'Nguyên liệu', { fk: { table: 'ingredients', column: 'id' }, indexed: true }),
    C('txn_type', 'TEXT', 'Loại biến động'),
    C('qty', 'REAL', 'Số lượng (+/-)'),
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
    C('qty', 'REAL', 'Số lượng đặt'),
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
    C('lat', 'REAL', 'Vĩ độ điểm giao', { nullable: true }),
    C('lng', 'REAL', 'Kinh độ điểm giao', { nullable: true }),
    C('distance_km', 'REAL', 'Khoảng cách tuyến đường (OSRM)'),
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
    C('lat', 'REAL', 'Vĩ độ lúc ghi nhận', { nullable: true }),
    C('lng', 'REAL', 'Kinh độ lúc ghi nhận', { nullable: true }),
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
