/** Phân quyền RBAC: vai trò → tập quyền; menu lọc theo quyền. */
export type Role = 'owner' | 'manager' | 'cashier' | 'barista' | 'accountant'

export type Permission =
  | 'pos.sell'
  | 'pos.discount'
  | 'pos.cancel'
  | 'pos.shift'
  | 'kds.view'
  | 'kds.update'
  | 'bo.dashboard'
  | 'bo.products'
  | 'bo.recipes'
  | 'bo.inventory'
  | 'bo.purchasing'
  | 'bo.customers'
  | 'bo.promotions'
  | 'bo.orders'
  | 'bo.staff'
  | 'bo.finance'
  | 'bo.reports'
  | 'bo.settings'
  | 'admin.data'
  | 'admin.erp'

const ALL: Permission[] = [
  'pos.sell', 'pos.discount', 'pos.cancel', 'pos.shift', 'kds.view', 'kds.update',
  'bo.dashboard', 'bo.products', 'bo.recipes', 'bo.inventory', 'bo.purchasing', 'bo.customers',
  'bo.promotions', 'bo.orders', 'bo.staff', 'bo.finance', 'bo.reports', 'bo.settings', 'admin.data', 'admin.erp',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  manager: [
    'pos.sell', 'pos.discount', 'pos.cancel', 'pos.shift', 'kds.view', 'kds.update',
    'bo.dashboard', 'bo.products', 'bo.recipes', 'bo.inventory', 'bo.purchasing', 'bo.customers',
    'bo.promotions', 'bo.orders', 'bo.staff', 'bo.reports', 'bo.settings', 'admin.erp',
  ],
  cashier: ['pos.sell', 'pos.discount', 'pos.shift', 'kds.view', 'bo.orders', 'bo.customers'],
  barista: ['kds.view', 'kds.update', 'bo.orders'],
  accountant: ['bo.dashboard', 'bo.inventory', 'bo.purchasing', 'bo.finance', 'bo.reports', 'bo.orders', 'bo.customers'],
}

export function can(role: Role | undefined, perm: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false
}

export interface NavItem {
  to: string
  label: string
  icon: string
  perm?: Permission
  group: 'Bán hàng' | 'Vận hành' | 'Quản trị' | 'Hệ thống'
  badge?: 'kds'
}

export const NAV: NavItem[] = [
  { to: '/pos', label: 'POS bán hàng', icon: 'ShoppingCart', perm: 'pos.sell', group: 'Bán hàng' },
  { to: '/kds', label: 'Màn hình bếp (KDS)', icon: 'ChefHat', perm: 'kds.view', group: 'Bán hàng', badge: 'kds' },
  { to: '/display', label: 'Màn hình gọi số', icon: 'MonitorPlay', perm: 'pos.sell', group: 'Bán hàng' },
  { to: '/orders', label: 'Đơn hàng', icon: 'ReceiptText', perm: 'bo.orders', group: 'Bán hàng' },

  { to: '/dashboard', label: 'Tổng quan', icon: 'LayoutDashboard', perm: 'bo.dashboard', group: 'Vận hành' },
  { to: '/inventory', label: 'Kho & nguyên liệu', icon: 'Boxes', perm: 'bo.inventory', group: 'Vận hành' },
  { to: '/purchasing', label: 'Mua hàng & NCC', icon: 'Truck', perm: 'bo.purchasing', group: 'Vận hành' },
  { to: '/products', label: 'Thực đơn & sản phẩm', icon: 'CupSoda', perm: 'bo.products', group: 'Vận hành' },
  { to: '/recipes', label: 'Công thức (BOM)', icon: 'BookOpenCheck', perm: 'bo.recipes', group: 'Vận hành' },
  { to: '/promotions', label: 'Khuyến mãi & voucher', icon: 'TicketPercent', perm: 'bo.promotions', group: 'Vận hành' },
  { to: '/customers', label: 'Khách hàng & CRM', icon: 'HeartHandshake', perm: 'bo.customers', group: 'Vận hành' },
  { to: '/staff', label: 'Nhân sự & ca', icon: 'Users', perm: 'bo.staff', group: 'Vận hành' },

  { to: '/reports', label: 'Báo cáo', icon: 'ChartColumnBig', perm: 'bo.reports', group: 'Quản trị' },
  { to: '/finance', label: 'Tài chính', icon: 'Wallet', perm: 'bo.finance', group: 'Quản trị' },
  { to: '/settings', label: 'Cài đặt', icon: 'Settings', perm: 'bo.settings', group: 'Quản trị' },

  { to: '/data', label: 'Data Explorer', icon: 'Database', perm: 'admin.data', group: 'Hệ thống' },
  { to: '/erp', label: 'ERP Simulator', icon: 'Workflow', perm: 'admin.erp', group: 'Hệ thống' },
]

export function navFor(role: Role): NavItem[] {
  return NAV.filter((n) => !n.perm || can(role, n.perm))
}
