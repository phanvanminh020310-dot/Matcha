/**
 * Phân quyền RBAC ĐỘNG: vai trò & quyền nằm trong bảng `roles` (SQLite/Postgres),
 * sửa được ngay trong app (màn hình Vai trò & phân quyền) — không hard-code.
 * `DEFAULT_ROLES` chỉ dùng khi CSDL chưa có bảng roles (lần chạy đầu).
 */
import { dbEvents } from './db'
import { ALL_PERMS, DEFAULT_ROLES, getRoles, permsOf } from './permissions'

export type Role = string

export type Permission =
  | 'pos.sell' | 'pos.discount' | 'pos.cancel' | 'pos.shift'
  | 'kds.view' | 'kds.update'
  | 'bo.dashboard' | 'bo.products' | 'bo.recipes' | 'bo.inventory' | 'bo.purchasing' | 'bo.customers'
  | 'bo.promotions' | 'bo.orders' | 'bo.delivery' | 'bo.print' | 'bo.staff' | 'bo.finance' | 'bo.reports' | 'bo.settings'
  | 'admin.master' | 'admin.roles' | 'admin.data' | 'admin.erp'

export { ALL_PERMS }

let cache: Record<string, string[]> | null = null

/** Xoá cache khi dữ liệu đổi (sửa vai trò, đăng nhập vai trò khác…). */
export function refreshRbac() { cache = null }
dbEvents.subscribe(refreshRbac)

function permMap(): Record<string, string[]> {
  if (cache) return cache
  const out: Record<string, string[]> = {}
  try {
    const rows = getRoles()
    if (rows.length) {
      rows.forEach((r) => { out[r.id] = permsOf(r) })
    }
  } catch { /* CSDL chưa sẵn sàng */ }
  if (!Object.keys(out).length) DEFAULT_ROLES.forEach((r) => { out[r.id] = r.perms })
  cache = out
  return out
}

export function permsFor(role: Role | undefined | null): string[] {
  if (!role) return []
  return permMap()[role] ?? []
}

export function can(role: Role | undefined | null, perm: Permission | string): boolean {
  if (!role) return false
  return permsFor(role).includes(perm)
}

export function canAny(role: Role | undefined | null, perms: (Permission | string)[]): boolean {
  return perms.some((p) => can(role, p))
}

export interface NavItem {
  to: string
  label: string
  icon: string
  perm?: Permission | string
  group: 'Bán hàng' | 'Vận hành' | 'Quản trị' | 'Hệ thống'
  badge?: 'kds'
}

export const NAV: NavItem[] = [
  { to: '/pos', label: 'POS bán hàng', icon: 'ShoppingCart', perm: 'pos.sell', group: 'Bán hàng' },
  { to: '/kds', label: 'Màn hình bếp (KDS)', icon: 'ChefHat', perm: 'kds.view', group: 'Bán hàng', badge: 'kds' },
  { to: '/display', label: 'Màn hình gọi số', icon: 'MonitorPlay', perm: 'pos.sell', group: 'Bán hàng' },
  { to: '/orders', label: 'Đơn hàng', icon: 'ReceiptText', perm: 'bo.orders', group: 'Bán hàng' },
  { to: '/delivery', label: 'Giao hàng & điều phối', icon: 'Bike', perm: 'bo.delivery', group: 'Bán hàng' },
  { to: '/driver', label: 'App tài xế (GPS)', icon: 'Satellite', perm: 'bo.delivery', group: 'Bán hàng' },

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
  { to: '/admin', label: 'Quản trị dữ liệu', icon: 'DatabaseZap', perm: 'admin.master', group: 'Quản trị' },
  { to: '/roles', label: 'Vai trò & phân quyền', icon: 'ShieldCheck', perm: 'admin.roles', group: 'Quản trị' },
  { to: '/settings', label: 'Cài đặt', icon: 'Settings', perm: 'bo.settings', group: 'Quản trị' },

  { to: '/print', label: 'Studio in ấn', icon: 'Printer', perm: 'bo.print', group: 'Hệ thống' },
  { to: '/data', label: 'Data Explorer', icon: 'Database', perm: 'admin.data', group: 'Hệ thống' },
  { to: '/erp', label: 'ERP Simulator', icon: 'Workflow', perm: 'admin.erp', group: 'Hệ thống' },
]

export function navFor(role: Role): NavItem[] {
  return NAV.filter((n) => !n.perm || can(role, n.perm))
}
