import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Plus, Wallet } from 'lucide-react'
import { createFinanceEntry, getBranches, getFinanceEntries } from '../lib/api'
import { pnl } from '../lib/analytics'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, Field, Input, Modal, MoneyInput, Select, Stat, Tabs, Textarea } from '../components/ui'
import { addDays, cx, downloadFile, formatDate, formatPercent, formatVND, todayVN, toCSV } from '../lib/format'

const CATEGORY_LABEL: Record<string, string> = {
  rent: 'Thuê mặt bằng', salary: 'Lương nhân sự', utilities: 'Điện nước', marketing: 'Marketing',
  purchase: 'Nhập hàng', other: 'Khác', sales: 'Doanh thu', service: 'Dịch vụ khác',
}

export function FinancePage() {
  const { branchId, user, toast } = useApp()
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [adding, setAdding] = useState(false)
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const to = todayVN()
  const from = addDays(to, -(days - 1))
  const report = useSql(() => pnl(from, to, branchId), [from, to, branchId])
  const entries = useSql(() => getFinanceEntries(200, branchId), [branchId])
  const branches = useSql(() => getBranches(), [])

  const chartData = [
    { name: 'Doanh thu', value: report.revenue, color: '#16a34a' },
    { name: 'Giá vốn', value: report.cogs, color: '#0ea5e9' },
    { name: 'Chi phí vận hành', value: report.opTotal, color: '#fb7f14' },
    { name: 'Lợi nhuận ròng', value: Math.max(0, report.netProfit), color: '#8b5cf6' },
  ]

  return (
    <div>
      <PageHeader icon={<Wallet size={20} />} title="Tài chính & lãi lỗ"
        description={`Kỳ ${formatDate(from)} – ${formatDate(to)} · doanh thu từ đơn hàng, giá vốn từ công thức, chi phí từ sổ thu chi`}
        actions={
          <>
            <Tabs value={range} onChange={setRange} tabs={[{ value: '7d', label: '7 ngày' }, { value: '30d', label: '30 ngày' }, { value: '90d', label: '90 ngày' }]} />
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Ghi bút toán</Button>
          </>
        } />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Doanh thu" value={formatVND(report.revenue, { compact: true })} icon={<ArrowUpRight size={17} />} sub="đã trừ đơn huỷ" />
        <Stat label="Giá vốn hàng bán" value={formatVND(report.cogs, { compact: true })} icon={<ArrowDownRight size={17} />} tone="blue" sub={`Lãi gộp ${formatVND(report.grossProfit, { compact: true })}`} />
        <Stat label="Chi phí vận hành" value={formatVND(report.opTotal, { compact: true })} icon={<Wallet size={17} />} tone="amber" sub={`${report.opExpenses.length} nhóm chi phí`} />
        <Stat label="Lợi nhuận ròng" value={formatVND(report.netProfit, { compact: true })} icon={<ArrowUpRight size={17} />} tone="violet" sub={`biên ${formatPercent(report.netMargin)}`} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Cơ cấu tài chính trong kỳ" subtitle="So sánh doanh thu, giá vốn, chi phí và lợi nhuận" icon={<Wallet size={16} />} />
          <div className="h-[260px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9e6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7f8d84' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7f8d84' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000000)}tr`} />
                <Tooltip formatter={(v: any) => [formatVND(Number(v)), '']} contentStyle={{ borderRadius: 12, border: '1px solid #e5e9e6', fontSize: 12 }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Chi phí theo nhóm" subtitle={`Kỳ ${days} ngày`} />
          <div className="space-y-2.5 p-4">
            {report.opExpenses.length === 0 && <p className="py-6 text-center text-[12.5px] text-ink-400">Chưa có chi phí trong kỳ</p>}
            {report.opExpenses.map((e) => (
              <div key={e.category}>
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-ink-600 dark:text-ink-300">{CATEGORY_LABEL[e.category] ?? e.category}</span>
                  <span className="tabular-nums font-medium">{formatVND(e.amount, { compact: true })}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
                  <div className="h-full rounded-full bg-caramel-500" style={{ width: `${Math.min(100, (e.amount / Math.max(1, report.opTotal)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-3 overflow-hidden">
        <CardHeader title="Sổ thu chi" subtitle={`${entries.length} bút toán gần nhất`} icon={<Wallet size={16} />}
          right={<Button size="sm" variant="secondary" onClick={() => {
            downloadFile('so-thu-chi.csv', toCSV(entries.map((e) => ({ 'Ngày': formatDate(e.entry_date), 'Chi nhánh': e.branch_name, 'Loại': e.type, 'Nhóm': CATEGORY_LABEL[e.category] ?? e.category, 'Số tiền': e.amount, 'Diễn giải': e.note }))))
            toast({ title: 'Đã xuất sổ thu chi', tone: 'success' })
          }}>Xuất CSV</Button>} />
        <div className="max-h-[420px] overflow-auto">
          <table className="table-base">
            <thead><tr><th>Ngày</th><th>Chi nhánh</th><th>Loại</th><th>Nhóm</th><th className="text-right">Số tiền</th><th>Diễn giải</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-ink-500">{formatDate(e.entry_date)}</td>
                  <td className="text-ink-500">{e.branch_name.replace('Matcha House ', '')}</td>
                  <td><Badge tone={e.type === 'income' ? 'green' : 'red'}>{e.type === 'income' ? 'Thu' : 'Chi'}</Badge></td>
                  <td>{CATEGORY_LABEL[e.category] ?? e.category}</td>
                  <td className={cx('text-right font-semibold tabular-nums', e.type === 'income' ? 'text-matcha-600' : 'text-rose-600')}>
                    {e.type === 'income' ? '+' : '−'}{formatVND(e.amount)}
                  </td>
                  <td className="max-w-[320px] truncate text-ink-500">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <AddEntryModal onClose={() => setAdding(false)} branches={branches} />}
    </div>
  )
}

function AddEntryModal({ onClose, branches }: { onClose: () => void; branches: ReturnType<typeof getBranches> }) {
  const { branchId, user, toast } = useApp()
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState('rent')
  const [amount, setAmount] = useState(1000000)
  const [note, setNote] = useState('')
  const [entryDate, setEntryDate] = useState(todayVN())
  const [branch, setBranch] = useState(branchId)

  return (
    <Modal open onClose={onClose} title="Ghi bút toán thu/chi" size="sm"
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" onClick={() => {
        if (!user) return
        createFinanceEntry({ branchId: branch, type, category, amount, note, userId: user.id, entryDate })
        toast({ title: 'Đã ghi bút toán', description: `${type === 'income' ? 'Thu' : 'Chi'} ${formatVND(amount)}`, tone: 'success' })
        onClose()
      }}>Lưu</Button></>}>
      <div className="space-y-3">
        <Field label="Loại"><Select value={type} onChange={(e) => setType(e.target.value as any)}><option value="expense">Chi phí</option><option value="income">Thu nhập</option></Select></Field>
        <Field label="Nhóm"><Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {type === 'expense' ? ['rent', 'salary', 'utilities', 'marketing', 'purchase', 'other'].map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)
            : ['sales', 'service', 'other'].map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </Select></Field>
        <Field label="Số tiền" required><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label="Chi nhánh"><Select value={branch} onChange={(e) => setBranch(Number(e.target.value))}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
        <Field label="Ngày hạch toán"><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></Field>
        <Field label="Diễn giải"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hoá đơn điện tháng 10, tiền thuê mặt bằng quý 4…" /></Field>
      </div>
    </Modal>
  )
}
