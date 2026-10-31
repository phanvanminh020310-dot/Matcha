import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartColumnBig, Download, FileSpreadsheet } from 'lucide-react'
import { byCategory, byChannel, byHour, inventoryValue, kpis, promotionEffectiveness, reportByProduct, shiftReport } from '../lib/analytics'
import { salesByStaff } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Button, Card, CardHeader, Input, Tabs } from '../components/ui'
import { ROLE_LABEL, addDays, downloadFile, formatNumber, formatPercent, formatVND, toCSV, todayVN } from '../lib/format'

const REPORTS = [
  { value: 'product', label: 'Theo sản phẩm' },
  { value: 'category', label: 'Theo danh mục' },
  { value: 'hour', label: 'Theo giờ' },
  { value: 'channel', label: 'Theo kênh' },
  { value: 'staff', label: 'Theo nhân viên' },
  { value: 'promo', label: 'Khuyến mãi' },
  { value: 'shift', label: 'Ca làm việc' },
] as const

export function ReportsPage() {
  const { branchId, toast } = useApp()
  const [type, setType] = useState<typeof REPORTS[number]['value']>('product')
  const [from, setFrom] = useState(addDays(todayVN(), -29))
  const [to, setTo] = useState(todayVN())

  const k = useSql(() => kpis(from, to, branchId), [from, to, branchId])
  const stockValue = useSql(() => inventoryValue(branchId), [branchId])

  const rows = useSql<Record<string, unknown>[]>(() => {
    switch (type) {
      case 'product': return reportByProduct(from, to, branchId)
      case 'category': return byCategory(from, to, branchId).map((c) => ({ 'Danh mục': `${c.emoji} ${c.name}`, 'Số ly': c.qty, 'Doanh thu': c.revenue }))
      case 'hour': return byHour(from, to, branchId).map((h) => ({ 'Giờ': `${h.hour}:00`, 'Số đơn': h.orders, 'Doanh thu': h.revenue }))
      case 'channel': return byChannel(from, to, branchId).map((c) => ({ 'Kênh': c.channel, 'Nguồn': c.source, 'Số đơn': c.orders, 'Doanh thu': c.revenue }))
      case 'staff': return salesByStaff(from, to).map((s2) => ({ 'Nhân viên': s2.name, 'Vai trò': ROLE_LABEL[s2.role as keyof typeof ROLE_LABEL] ?? s2.role, 'Số đơn': Number(s2.order_count), 'Doanh thu': Number(s2.revenue) }))
      case 'promo': return promotionEffectiveness(from, to)
      case 'shift': return shiftReport(branchId, 30)
    }
  }, [type, from, to, branchId])

  const headers = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows])
  const numericKeys = useMemo(() => headers.filter((h) => rows.some((r) => typeof r[h] === 'number')), [headers, rows])
  const primaryKey = numericKeys[0]

  return (
    <div>
      <PageHeader icon={<ChartColumnBig size={20} />} title="Báo cáo"
        description={`Kỳ ${from.split('-').reverse().join('/')} – ${to.split('-').reverse().join('/')} · ${headers.length} chỉ tiêu`}
        actions={<>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
          <Button variant="secondary" icon={<Download size={15} />} onClick={() => {
            downloadFile(`bao-cao-${type}-${from}-${to}.csv`, toCSV(rows as Record<string, unknown>[], headers))
            toast({ title: 'Đã xuất báo cáo CSV', description: `${rows.length} dòng`, tone: 'success' })
          }}>Xuất CSV</Button>
        </>} />

      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Doanh thu', value: formatVND(k.revenue, { compact: true }) },
          { label: 'Lãi gộp', value: `${formatVND(k.grossProfit, { compact: true })} · ${formatPercent(k.margin)}` },
          { label: 'Số đơn', value: formatNumber(k.orders) },
          { label: 'TB/đơn', value: formatVND(k.aov, { compact: true }) },
          { label: 'Giá trị tồn kho', value: formatVND(stockValue, { compact: true }) },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <p className="text-[11.5px] text-ink-500">{s.label}</p>
            <p className="mt-0.5 text-[16px] font-semibold text-ink-900 dark:text-ink-50">{s.value}</p>
          </Card>
        ))}
      </div>

      <Tabs value={type} onChange={setType} className="mb-3" tabs={REPORTS.map((r) => ({ value: r.value, label: r.label }))} />

      {primaryKey && type !== 'shift' && (
        <Card className="mb-3">
          <CardHeader title={`Biểu đồ: ${REPORTS.find((r) => r.value === type)?.label}`} subtitle={`Theo ${primaryKey.toLowerCase()}`} icon={<FileSpreadsheet size={16} />} />
          <div className="h-[240px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.slice(0, 12) as any[]} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9e6" vertical={false} />
                <XAxis dataKey={headers[0]} tick={{ fontSize: 10, fill: '#7f8d84' }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 10, fill: '#7f8d84' }} axisLine={false} tickLine={false} tickFormatter={(v) => Number(v) >= 1e6 ? `${Math.round(Number(v) / 1e6)}tr` : `${Math.round(Number(v) / 1e3)}k`} />
                <Tooltip formatter={(v: any) => formatNumber(Number(v), 1)} contentStyle={{ borderRadius: 12, border: '1px solid #e5e9e6', fontSize: 11.5 }} />
                <Bar dataKey={primaryKey} radius={[6, 6, 0, 0]} fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100dvh-420px)] overflow-auto">
          <table className="table-base">
            <thead><tr>{headers.map((h) => <th key={h} className={typeof rows[0]?.[h] === 'number' ? 'text-right' : ''}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {headers.map((h) => {
                    const v = r[h]
                    const isNum = typeof v === 'number'
                    return (
                      <td key={h} className={isNum ? 'text-right tabular-nums' : ''}>
                        {isNum ? (h.toLowerCase().includes('biên') || h.toLowerCase().includes('%') ? formatPercent(v as number) : Math.abs(v as number) >= 1000 ? formatVND(v as number) : formatNumber(v as number, 1)) : String(v ?? '—')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="py-10 text-center text-[13px] text-ink-400">Không có dữ liệu trong kỳ này</p>}
      </Card>
    </div>
  )
}
