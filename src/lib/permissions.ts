/**
 * Danh mục quyền (permission catalog) — dùng cho màn hình "Vai trò & phân quyền".
 * Quyền lưu trong bảng `roles.perms` (chuỗi phân cách bằng dấu phẩy) nên thêm/sửa
 * quyền của vai trò không cần build lại app.
 */
import { all, run, scalar } from './db'

export interface PermGroup {
  module: string
  label: string
  icon: string
  perms: { code: string; label: string; hint?: string }[]
}

export const PERM_GROUPS: PermGroup[] = [
  {
    module: 'pos', label: 'Bán hàng (POS)', icon: '🛒',
    perms: [
      { code: 'pos.sell', label: 'Bán hàng', hint: 'Mở quầy, tạo đơn, thanh toán' },
      { code: 'pos.discount', label: 'Giảm giá', hint: 'Áp voucher / giảm tay' },
      { code: 'pos.cancel', label: 'Huỷ đơn', hint: 'Huỷ đơn đã tạo và hoàn kho' },
      { code: 'pos.shift', label: 'Ca & két tiền', hint: 'Mở/đóng ca, nộp tiền' },
    ],
  },
  {
    module: 'kds', label: 'Bếp & màn hình gọi số', icon: '👩‍🍳',
    perms: [
      { code: 'kds.view', label: 'Xem hàng đợi bếp' },
      { code: 'kds.update', label: 'Cập nhật trạng thái pha chế' },
    ],
  },
  {
    module: 'sales', label: 'Đơn hàng & giao hàng', icon: '🧾',
    perms: [
      { code: 'bo.orders', label: 'Đơn hàng', hint: 'Xem, sửa, in, huỷ đơn' },
      { code: 'bo.delivery', label: 'Giao hàng & điều phối' },
      { code: 'bo.customers', label: 'Khách hàng & CRM' },
      { code: 'bo.promotions', label: 'Khuyến mãi & voucher' },
      { code: 'bo.print', label: 'Studio in ấn' },
    ],
  },
  {
    module: 'inventory', label: 'Kho & mua hàng', icon: '📦',
    perms: [
      { code: 'bo.inventory', label: 'Kho & nguyên liệu', hint: 'Nhập/xuất/kiểm kê' },
      { code: 'bo.purchasing', label: 'Mua hàng & NCC' },
      { code: 'bo.products', label: 'Thực đơn & sản phẩm' },
      { code: 'bo.recipes', label: 'Công thức (BOM)' },
    ],
  },
  {
    module: 'hr', label: 'Nhân sự & tài chính', icon: '👥',
    perms: [
      { code: 'bo.staff', label: 'Nhân sự & ca' },
      { code: 'bo.finance', label: 'Tài chính (sổ thu chi)' },
      { code: 'bo.dashboard', label: 'Tổng quan' },
      { code: 'bo.reports', label: 'Báo cáo' },
    ],
  },
  {
    module: 'admin', label: 'Quản trị hệ thống', icon: '🛡️',
    perms: [
      { code: 'bo.settings', label: 'Cài đặt hệ thống' },
      { code: 'admin.master', label: 'Quản trị dữ liệu', hint: 'Thêm/sửa/xoá mọi danh mục' },
      { code: 'admin.roles', label: 'Vai trò & phân quyền' },
      { code: 'admin.data', label: 'Data Explorer / SQL' },
      { code: 'admin.erp', label: 'ERP Simulator' },
    ],
  },
]

export const ALL_PERMS: string[] = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.code))

export const PERM_LABEL: Record<string, string> = Object.fromEntries(
  PERM_GROUPS.flatMap((g) => g.perms.map((p) => [p.code, p.label])),
)

export interface RoleDef {
  id: string
  name: string
  description: string
  perms: string[]
  is_system: boolean
  color: string
}

export const DEFAULT_ROLES: RoleDef[] = [
  {
    id: 'owner', name: 'Chủ chuỗi', color: '#8b5cf6', is_system: true,
    description: 'Toàn quyền toàn hệ thống, mọi chi nhánh',
    perms: [...ALL_PERMS],
  },
  {
    id: 'manager', name: 'Quản lý chi nhánh', color: '#0ea5e9', is_system: true,
    description: 'Quản lý vận hành một chi nhánh, không xem lương & phân quyền',
    perms: ALL_PERMS.filter((p) => !['admin.roles', 'bo.finance'].includes(p)),
  },
  {
    id: 'cashier', name: 'Thu ngân', color: '#16a34a', is_system: true,
    description: 'Bán hàng tại quầy, thu tiền, in hoá đơn',
    perms: ['pos.sell', 'pos.discount', 'pos.shift', 'kds.view', 'bo.orders', 'bo.delivery', 'bo.print', 'bo.customers'],
  },
  {
    id: 'barista', name: 'Pha chế', color: '#fb7f14', is_system: true,
    description: 'Chỉ màn hình bếp và tra cứu đơn',
    perms: ['kds.view', 'kds.update', 'bo.orders', 'bo.delivery'],
  },
  {
    id: 'accountant', name: 'Kế toán', color: '#e11d48', is_system: true,
    description: 'Kho, mua hàng, sổ thu chi, báo cáo — không bán hàng',
    perms: ['bo.dashboard', 'bo.inventory', 'bo.purchasing', 'bo.finance', 'bo.reports', 'bo.orders', 'bo.delivery', 'bo.print', 'bo.customers'],
  },
  {
    id: 'shipper', name: 'Tài xế giao hàng', color: '#0891b2', is_system: true,
    description: 'Chỉ xem vận đơn được gán và cập nhật trạng thái giao',
    perms: ['bo.delivery', 'bo.orders'],
  },
]

/** Tạo bảng roles + dữ liệu mặc định (idempotent — gọi sau khi DB sẵn sàng). */
export function ensureRoles() {
  try {
    const exists = scalar<number>(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'roles'`)
    if (!exists) return
    const count = scalar<number>('SELECT COUNT(*) FROM roles') ?? 0
    if (count > 0) return
    const now = new Date().toISOString()
    for (const r of DEFAULT_ROLES) {
      run(`INSERT INTO roles (id, name, description, perms, is_system, color, created_at) VALUES (?,?,?,?,?,?,?)`,
        [r.id, r.name, r.description, r.perms.join(','), r.is_system ? 1 : 0, r.color, now], { silent: true })
    }
    console.info('[matcha] đã tạo', DEFAULT_ROLES.length, 'vai trò mặc định')
  } catch (e) {
    console.warn('[matcha] ensureRoles:', (e as Error).message)
  }
}

export interface RoleRow {
  id: string
  name: string
  description: string | null
  perms: string
  is_system: number
  color: string | null
  created_at: string
}

export function getRoles(): RoleRow[] {
  try {
    return all<RoleRow>('SELECT * FROM roles ORDER BY is_system DESC, name')
  } catch {
    return []
  }
}

export function permsOf(role: RoleRow | RoleDef | undefined | null): string[] {
  const raw: string | string[] = role?.perms ?? ''
  const list = Array.isArray(raw) ? raw : String(raw).split(',')
  return list.map((p: string) => p.trim()).filter(Boolean)
}
