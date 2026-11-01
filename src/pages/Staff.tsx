import { useState } from 'react'
import { BadgeDollarSign, Clock, Users, Wallet } from 'lucide-react'
import { getShifts, getUsers, salesByStaff } from '../lib/api'
import { shiftReport } from '../lib/analytics'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { ManageTableLink } from '../components/ManageTableLink'
import { Badge, Card, CardHeader, EmptyState, ProgressBar, Stat, Tabs } from '../components/ui'
import { ROLE_LABEL, addDays, cx, formatDate, formatDateTime, formatNumber, formatVND, todayVN } from '../lib/format'

export function StaffPage() {
  const { branchId } = useApp()
  const [tab, setTab] = useState<'team' | 'shift' | 'payroll'>('team')
  const users = useSql(() => getUsers(), [])
  const to = todayVN()
  const from = addDays(to, -29)
  const sales = useSql(() => salesByStaff(from, to) as { user_id: number; name: string; role: string; order_count: number; revenue: number }[], [from, to])
  const shifts = useSql(() => getShifts(branchId, 24), [branchId])
  const shiftRows = useSql(() => shiftReport(branchId, 24) as Record<string, any>[], [branchId])

  const totalSalary = users.reduce((s, u) => s + Number(u.salary), 0)
  const revenue = sales.reduce((s, x) => s + Number(x.revenue), 0)

  return (
    <div>
      <PageHeader icon={<Users size={20} />} title="Nhân sự & ca làm việc"
        description={`${users.length} nhân viên · quỹ lương ${formatVND(totalSalary, { compact: true })}/tháng · doanh thu 30 ngày ${formatVND(revenue, { compact: true })}`}
        actions={<ManageTableLink table="users" label="Thêm / sửa nhân viên" />} />

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Nhân viên đang làm" value={users.filter((u) => u.is_active).length} icon={<Users size={17} />} sub={`${users.filter((u) => u.role === 'barista').length} pha chế · ${users.filter((u) => u.role === 'cashier').length} thu ngân`} />
        <Stat label="Ca đã chốt (30 ngày)" value={shiftRows.filter((s) => s['Trạng thái'] === 'closed').length} icon={<Clock size={17} />} tone="blue" sub={`${shiftRows.filter((s) => s['Trạng thái'] === 'open').length} ca đang mở`} />
        <Stat label="Chênh lệch quỹ tiền mặt" value={formatVND(shiftRows.reduce((s, r) => s + Number(r['Chênh lệch'] ?? 0), 0), { sign: true })} icon={<Wallet size={17} />} tone="amber" sub="Tổng đối soát tiền mặt các ca" />
      </div>

      <Tabs value={tab} onChange={setTab} className="mb-3 w-fit" tabs={[{ value: 'team', label: 'Đội ngũ' }, { value: 'shift', label: 'Ca làm việc' }, { value: 'payroll', label: 'Bảng lương' }]} />

      {tab === 'team' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Chi nhánh</th><th>Vào làm</th><th className="text-right">Lương cơ bản</th><th className="text-right">Đơn (30d)</th><th className="text-right">Doanh thu (30d)</th></tr></thead>
              <tbody>
                {users.map((u) => {
                  const s = sales.find((x) => x.user_id === u.id)
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cream-200 dark:bg-ink-800">{u.avatar_emoji}</span>
                          <div>
                            <p className="font-medium text-ink-900 dark:text-ink-50">{u.name}</p>
                            <p className="text-[11px] text-ink-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone={u.role === 'owner' ? 'purple' : u.role === 'manager' ? 'blue' : u.role === 'accountant' ? 'amber' : 'green'}>{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]}</Badge></td>
                      <td className="text-ink-500">{(u as any).branch_name?.replace('Matcha House ', '') ?? '—'}</td>
                      <td className="text-ink-500">{formatDate(u.hired_at)}</td>
                      <td className="text-right tabular-nums">{formatVND(u.salary, { compact: true })}</td>
                      <td className="text-right tabular-nums">{s ? formatNumber(s.order_count) : '—'}</td>
                      <td className="text-right font-semibold tabular-nums">{s ? formatVND(s.revenue, { compact: true }) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'shift' && (
        <Card className="overflow-hidden">
          <CardHeader title="Ca làm việc & đối soát" subtitle="Tiền mặt lý thuyết = đầu ca + thu tiền mặt − chi tiền mặt" icon={<Clock size={16} />} />
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Mở ca</th><th>Chốt ca</th><th>Thu ngân</th><th className="text-center">Đơn</th><th className="text-right">Doanh thu</th><th className="text-right">Đầu ca</th><th className="text-right">Lý thuyết</th><th className="text-right">Kiểm đếm</th><th className="text-right">Chênh lệch</th></tr></thead>
              <tbody>
                {shiftRows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-ink-500">{formatDateTime(r['Mở ca'])}</td>
                    <td className="whitespace-nowrap text-ink-500">{r['Chốt ca'] ? formatDateTime(r['Chốt ca']) : <Badge tone="amber">đang mở</Badge>}</td>
                    <td className="font-medium text-ink-900 dark:text-ink-50">{r['Thu ngân']}</td>
                    <td className="text-center tabular-nums">{r['Số đơn']}</td>
                    <td className="text-right tabular-nums">{formatVND(r['Doanh thu'], { compact: true })}</td>
                    <td className="text-right tabular-nums text-ink-500">{formatVND(r['Tiền đầu ca'], { compact: true })}</td>
                    <td className="text-right tabular-nums text-ink-500">{r['Lý thuyết'] ? formatVND(r['Lý thuyết'], { compact: true }) : '—'}</td>
                    <td className="text-right tabular-nums">{r['Kiểm đếm'] ? formatVND(r['Kiểm đếm'], { compact: true }) : '—'}</td>
                    <td className={cx('text-right font-semibold tabular-nums', Number(r['Chênh lệch'] ?? 0) === 0 ? 'text-ink-400' : Number(r['Chênh lệch'] ?? 0) > 0 ? 'text-matcha-600' : 'text-rose-600')}>
                      {r['Chênh lệch'] !== null ? formatVND(r['Chênh lệch'], { sign: true }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shiftRows.length === 0 && <EmptyState title="Chưa có ca nào" />}
        </Card>
      )}

      {tab === 'payroll' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Bảng lương mô phỏng (30 ngày)" subtitle="Lương cơ bản + 0,5% doanh thu + thưởng chuyên cần" icon={<BadgeDollarSign size={16} />} />
            <table className="table-base">
              <thead><tr><th>Nhân viên</th><th className="text-right">Cơ bản</th><th className="text-right">Hoa hồng</th><th className="text-right">Thực lĩnh</th></tr></thead>
              <tbody>
                {users.map((u) => {
                  const s = sales.find((x) => x.user_id === u.id)
                  const commission = Math.round(Number(s?.revenue ?? 0) * 0.005)
                  const total = Number(u.salary) + commission
                  return (
                    <tr key={u.id}>
                      <td className="font-medium text-ink-900 dark:text-ink-50">{u.name}</td>
                      <td className="text-right tabular-nums">{formatVND(u.salary, { compact: true })}</td>
                      <td className="text-right tabular-nums text-matcha-700 dark:text-matcha-300">{formatVND(commission, { compact: true })}</td>
                      <td className="text-right font-semibold tabular-nums">{formatVND(total, { compact: true })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
          <Card>
            <CardHeader title="Hiệu suất bán hàng theo nhân viên" subtitle="30 ngày gần nhất" icon={<Wallet size={16} />} />
            <div className="space-y-3 p-4">
              {sales.filter((s) => Number(s.order_count) > 0).slice(0, 8).map((s) => {
                const max = Math.max(...sales.map((x) => Number(x.revenue)), 1)
                return (
                  <div key={s.user_id}>
                    <div className="flex justify-between text-[12.5px]">
                      <span className="font-medium text-ink-800 dark:text-ink-100">{s.name}</span>
                      <span className="tabular-nums text-ink-500">{formatVND(s.revenue, { compact: true })} · {s.order_count} đơn</span>
                    </div>
                    <ProgressBar value={Number(s.revenue) / max} className="mt-1" />
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
