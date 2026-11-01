import { DatabaseZap } from 'lucide-react'
import { useApp } from '../store/app'
import { can } from '../lib/rbac'
import { Button } from './ui'

/**
 * Lối tắt sang "Quản trị dữ liệu" đúng bảng của module đang mở.
 * Nhờ vậy module nào cũng có chỗ thêm/sửa/xoá dữ liệu chuẩn (không phải bảng cứng).
 */
export function ManageTableLink({ table, label = 'Quản trị bảng này' }: { table: string; label?: string }) {
  const { user } = useApp()
  if (!can(user?.role, 'admin.master')) return null
  return (
    <Button variant="secondary" icon={<DatabaseZap size={15} />} onClick={() => { location.hash = `#/admin?table=${table}` }}>
      {label}
    </Button>
  )
}
