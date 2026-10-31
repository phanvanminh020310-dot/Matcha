import { useState } from 'react'
import { Building2, ClipboardList, CreditCard, Database, Grid3x3, Save, Shield, Store } from 'lucide-react'
import { getAuditLogs, getBranches, getTables, updateTablePosition } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader, ResetDataButton } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, Switch, Tabs } from '../components/ui'
import { dbSizeBytes, run } from '../lib/db'
import {ROLE_PERMISSIONS, type Role} from '../lib/rbac'
import { METHOD_LABEL, ROLE_LABEL, cx, formatDateTime, formatVND } from '../lib/format'

const PERM_LABEL: Record<string, string> = {
  'pos.sell': 'Bán hàng tại quầy', 'pos.discount': 'Giảm giá đơn', 'pos.cancel': 'Huỷ đơn', 'pos.shift': 'Quản lý ca',
  'kds.view': 'Xem KDS', 'kds.update': 'Cập nhật KDS', 'bo.dashboard': 'Dashboard', 'bo.products': 'Sản phẩm',
  'bo.recipes': 'Công thức', 'bo.inventory': 'Kho', 'bo.purchasing': 'Mua hàng', 'bo.customers': 'Khách hàng',
  'bo.promotions': 'Khuyến mãi', 'bo.orders': 'Đơn hàng', 'bo.staff': 'Nhân sự', 'bo.finance': 'Tài chính',
  'bo.reports': 'Báo cáo', 'bo.settings': 'Cài đặt', 'admin.data': 'Data Explorer', 'admin.erp': 'ERP Simulator',
}

export function SettingsPage() {
  const { branchId, toast } = useApp()
  const [tab, setTab] = useState<'store' | 'tables' | 'rbac' | 'audit' | 'system'>('store')
  const branches = useSql(() => getBranches(), [])
  const tables = useSql(() => getTables(branchId), [branchId])
  const audit = useSql(() => getAuditLogs(80), [])
  const branch = branches.find((b) => b.id === branchId)
  const [form, setForm] = useState({ name: branch?.name ?? '', address: branch?.address ?? '', phone: branch?.phone ?? '', vat: (branch?.vat_rate ?? 0.08) * 100 })

  return (
    <div>
      <PageHeader icon={<Store size={20} />} title="Cài đặt hệ thống" description="Thông tin cửa hàng, sơ đồ bàn, phân quyền, nhật ký và dữ liệu" />
      <Tabs value={tab} onChange={setTab} className="mb-3" tabs={[
        { value: 'store', label: 'Cửa hàng' }, { value: 'tables', label: 'Sơ đồ bàn' }, { value: 'rbac', label: 'Phân quyền' },
        { value: 'audit', label: 'Nhật ký' }, { value: 'system', label: 'Hệ thống' },
      ]} />

      {tab === 'store' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Thông tin chi nhánh" subtitle={branch?.code} icon={<Building2 size={16} />} />
            <div className="space-y-3 p-4">
              <Field label="Tên chi nhánh"><Input value={form.name || branch?.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Địa chỉ"><Input value={form.address || branch?.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              <Field label="Hotline"><Input value={form.phone || branch?.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Thuế VAT (%)" hint="Áp dụng cho hoá đơn mới"><Input type="number" value={form.vat} onChange={(e) => setForm({ ...form, vat: Number(e.target.value) })} /></Field>
              <Button variant="primary" icon={<Save size={15} />} onClick={() => {
                run('UPDATE branches SET name = ?, address = ?, phone = ?, vat_rate = ? WHERE id = ?', [form.name || branch?.name || '', form.address || branch?.address || '', form.phone || branch?.phone || '', form.vat / 100, branchId])
                toast({ title: 'Đã lưu thông tin chi nhánh', tone: 'success' })
              }}>Lưu thay đổi</Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Phương thức thanh toán" subtitle="Bật/tắt theo nhu cầu từng chi nhánh" icon={<CreditCard size={16} />} />
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {Object.entries(METHOD_LABEL).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px] text-ink-700 dark:text-ink-200">{v}</span>
                  <Switch checked={k !== 'credit'} onChange={() => toast({ title: 'Cấu hình mẫu', description: 'Bản demo chưa lưu cấu hình phương thức thanh toán.', tone: 'info' })} label={v} />
                </li>
              ))}
            </ul>
            <p className="border-t border-ink-100 px-4 py-3 text-[11.5px] text-ink-400 dark:border-ink-800">
              Máy in hoá đơn (K80) và tem ly được mô phỏng qua hộp thoại in của trình duyệt — CSS in đã chuẩn hoá khổ 80mm.
            </p>
          </Card>
        </div>
      )}

      {tab === 'tables' && (
        <Card>
          <CardHeader title="Sơ đồ bàn" subtitle="Kéo thả để sắp xếp vị trí (toạ độ lưu vào bảng dining_tables)" icon={<Grid3x3 size={16} />} />
          <div className="relative m-4 h-[420px] overflow-hidden rounded-2xl border border-ink-200 bg-[radial-gradient(circle,#d9e2db_1px,transparent_1px)] [background-size:18px_18px] dark:border-ink-700 dark:bg-[radial-gradient(circle,#2a322c_1px,transparent_1px)]">
            {tables.map((t) => (
              <div key={t.id} className="absolute cursor-move select-none rounded-xl border border-matcha-300 bg-white px-3 py-2 text-[11.5px] font-medium text-ink-800 shadow-soft dark:border-matcha-700 dark:bg-ink-900 dark:text-ink-100"
                style={{ left: t.x, top: t.y }}
                draggable
                onDragEnd={(e) => {
                  const parent = e.currentTarget.parentElement!.getBoundingClientRect()
                  updateTablePosition(t.id, Math.round(e.clientX - parent.left - 30), Math.round(e.clientY - parent.top - 16))
                }}>
                <p className="font-semibold">{t.name}</p>
                <p className="text-[10px] text-ink-400">{t.zone} · {t.seats} chỗ</p>
              </div>
            ))}
          </div>
          <p className="px-4 pb-4 text-[11.5px] text-ink-400">Có {tables.length} bàn tại chi nhánh này. Kéo thả để mô phỏng lại cách bố trí mặt bằng.</p>
        </Card>
      )}

      {tab === 'rbac' && (
        <Card className="overflow-hidden">
          <CardHeader title="Ma trận phân quyền" subtitle="5 vai trò × 20 quyền — menu và nút thao tác lọc theo bảng này" icon={<Shield size={16} />} />
          <div className="max-h-[calc(100dvh-280px)] overflow-auto">
            <table className="table-base">
              <thead>
                <tr><th>Quyền</th>{(['owner', 'manager', 'cashier', 'barista', 'accountant'] as Role[]).map((r) => <th key={r} className="text-center">{ROLE_LABEL[r]}</th>)}</tr>
              </thead>
              <tbody>
                {Object.keys(PERM_LABEL).map((perm) => (
                  <tr key={perm}>
                    <td className="text-ink-700 dark:text-ink-200">{PERM_LABEL[perm]}<span className="ml-1.5 font-mono text-[10px] text-ink-400">{perm}</span></td>
                    {(['owner', 'manager', 'cashier', 'barista', 'accountant'] as Role[]).map((r) => (
                      <td key={r} className="text-center">
                        {ROLE_PERMISSIONS[r].includes(perm as any) ? <span className="text-matcha-600">✓</span> : <span className="text-ink-300">–</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'audit' && (
        <Card className="overflow-hidden">
          <CardHeader title="Nhật ký hoạt động" subtitle={`${audit.length} bản ghi gần nhất`} icon={<ClipboardList size={16} />} />
          <table className="table-base">
            <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Bảng</th><th>Bản ghi</th><th>Giá trị sau</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-ink-500">{formatDateTime(a.created_at)}</td>
                  <td className="font-medium text-ink-900 dark:text-ink-50">{a.user_name ?? 'Hệ thống'}</td>
                  <td><Badge tone="gray">{a.action}</Badge></td>
                  <td className="font-mono text-[11.5px] text-ink-500">{a.entity}</td>
                  <td className="text-ink-500">{a.entity_id}</td>
                  <td className="max-w-[280px] truncate font-mono text-[10.5px] text-ink-400">{a.after_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'system' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Cơ sở dữ liệu" subtitle="SQLite WASM + IndexedDB" icon={<Database size={16} />} />
            <div className="space-y-2 p-4 text-[12.5px]">
              <Row label="Kích thước CSDL" value={`${(dbSizeBytes() / 1048576).toFixed(2)} MB`} />
              <Row label="Engine" value="sql.js (SQLite 3 WASM)" />
              <Row label="Lưu trữ" value="IndexedDB — tồn tại qua reload" />
              <Row label="Múi giờ" value="Asia/Ho_Chi_Minh (UTC+7)" />
              <Row label="Tiền tệ" value="VND — 45.000 ₫" />
              <div className="pt-2"><ResetDataButton /></div>
              <p className="text-[11.5px] leading-relaxed text-ink-400">
                Bản demo chạy hoàn toàn phía trình duyệt: không có server, không có tài khoản, dữ liệu chỉ nằm trên máy bạn.
                Reset sẽ sinh lại bộ dữ liệu 90 ngày (~3 giây).
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Chi nhánh trong chuỗi" icon={<Store size={16} />} />
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {branches.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-ink-900 dark:text-ink-50">{b.name}</p>
                    <Badge tone="green">VAT {Math.round(b.vat_rate * 100)}%</Badge>
                  </div>
                  <p className="text-[11.5px] text-ink-400">{b.address}, {b.city} · {b.phone}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-ink-500">{label}</span><span className="font-medium text-ink-800 dark:text-ink-100">{value}</span></div>
}
