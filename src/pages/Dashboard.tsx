import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  AlertTriangle, ArrowUpRight, BadgeDollarSign, Boxes, ChefHat, Coins, CreditCard, CupSoda, LayoutDashboard,
  Receipt, ShoppingBag, TrendingUp, Users,
} from 'lucide-react'
import { byBranch, byCategory, byChannel, byHour, kpis, paymentBreakdown, revenueSeries, stockAlerts, topProducts } from '../lib/analytics'
import { getActiveOrders, type Order } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Card, CardHeader, ProgressBar, Stat, Tabs } from '../components/ui'
import { CHANNEL_LABEL, addDays, cx, formatNumber, formatPercent, formatVND, todayVN } from '../lib/format'

const RANGES = [
  { value: 'today', label: 'Hôm nay', days: 1 },
  { value: '7d', label: '7 ngày', days: 7 },
  { value: '30d', label: '30 ngày', days: 30 },
  { value: '90d', label: '90 ngày', days: 90 },
] as const

const CHART_COLORS = ['#16a34a', '#fb7f14', '#0ea5e9', '#8b5cf6', '#e11d48', '#65a30d', '#f59e0b']

export function DashboardPage() {
  const branchId = useApp((s) => s.branchId)
  const [range, setRange] = useState<'today' | '7d' | '30d' | '90d'>('7d')

  const days = RANGES.find((r) => r.value === range)!.days
  const to = todayVN()
  const from = addDays(to, -(days - 1))
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(days - 1))

  const current = useSql(() => kpis(from, to, branchId), [from, to, branchId])
  const previous = useSql(() => kpis(prevFrom, prevTo, branchId), [prevFrom, prevTo, branchId])
  const series = useSql(() => revenueSeries(Math.max(days, 7), branchId), [days, branchId])
  const hours = useSql(() => byHour(from, to, branchId), [from, to, branchId])
  const channels = useSql(() => byChannel(from, to, branchId), [from, to, branchId])
  const branchPerf = useSql(() => byBranch(from, to), [from, to])
  const top = useSql(() => topProducts(from, to, 8, branchId), [from, to, branchId])
  const cats = useSql(() => byCategory(from, to, branchId), [from, to, branchId])
  const payments = useSql(() => paymentBreakdown(from, to, branchId), [from, to, branchId])
  const alerts = useSql(() => stockAlerts(branchId).slice(0, 6), [branchId])

  const growth = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : cur > 0 ? 1 : 0)
  const channelTotals = useMemo(() => {
    const map = new Map<string, number>()
    channels.forEach((c) => map.set(c.channel, (map.get(c.channel) ?? 0) + c.revenue))
    return [...map.entries()].map(([channel, revenue]) => ({ channel, revenue }))
  }, [channels])

  const peakHour = hours.length ? hours.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard size={20} />}
        title="Tổng quan vận hành"
        description={`Doanh thu, lợi nhuận và hiệu suất chuỗi · ${from.split('-').reverse().join('/')} → ${to.split('-').reverse().join('/')}`}
        actions={<Tabs value={range} onChange={setRange} tabs={RANGES.map((r) => ({ value: r.value, label: r.label }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Doanh thu" value={formatVND(current.revenue, { compact: true })} icon={<BadgeDollarSign size={17} />}
          trend={growth(current.revenue, previous.revenue)} sub={`kỳ trước ${formatVND(previous.revenue, { compact: true })}`} />
        <Stat label="Số đơn" value={formatNumber(current.orders)} icon={<Receipt size={17} />} tone="blue"
          trend={growth(current.orders, previous.orders)} sub={`${formatNumber(current.items)} ly đã bán`} />
        <Stat label="Giá trị đơn TB" value={formatVND(current.aov)} icon={<ShoppingBag size={17} />} tone="amber"
          trend={growth(current.aov, previous.aov)} sub={`${formatNumber(current.customers)} khách có hồ sơ`} />
        <Stat label="Lợi nhuận gộp" value={formatVND(current.grossProfit, { compact: true })} icon={<TrendingUp size={17} />} tone="violet"
          trend={growth(current.grossProfit, previous.grossProfit)} sub={`biên ${formatPercent(current.margin)} · COGS ${formatVND(current.cogs, { compact: true })}`} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Doanh thu & lợi nhuận theo ngày" subtitle={`${days === 1 ? '7' : days} ngày gần nhất · đơn vị: nghìn đồng`} icon={<TrendingUp size={16} />} />
          <div className="h-[276px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9e6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7f8d84' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7f8d84' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  formatter={(v: any, n: any) => [formatVND(Number(v)), n === 'revenue' ? 'Doanh thu' : 'Lợi nhuận']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e9e6', fontSize: 12, boxShadow: '0 8px 24px -12px rgba(0,0,0,.2)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.4} fill="url(#gRev)" />
                <Area type="monotone" dataKey="profit" stroke="#fb7f14" strokeWidth={1.8} strokeDasharray="4 3" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Kênh bán" subtitle="Tỷ trọng doanh thu" icon={<CreditCard size={16} />} />
          <div className="h-[276px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channelTotals} dataKey="revenue" nameKey="channel" innerRadius={54} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                  {channelTotals.map((c, i) => <Cell key={c.channel} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend formatter={(v) => CHANNEL_LABEL[v as string] ?? v} wrapperStyle={{ fontSize: 11.5 }} />
                <Tooltip formatter={(v: any, n: any) => [formatVND(Number(v)), CHANNEL_LABEL[n as string] ?? n]} contentStyle={{ borderRadius: 12, border: '1px solid #e5e9e6', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Giờ cao điểm" subtitle={peakHour ? `Cao nhất ${peakHour.hour}h với ${formatVND(peakHour.revenue, { compact: true })}` : 'Chưa có dữ liệu'} icon={<TrendingUp size={16} />} />
          <div className="h-[220px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9e6" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 11, fill: '#7f8d84' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7f8d84' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v: any) => [formatVND(Number(v)), 'Doanh thu']} labelFormatter={(h) => `${h}:00 – ${Number(h) + 1}:00`} contentStyle={{ borderRadius: 12, border: '1px solid #e5e9e6', fontSize: 12 }} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Cảnh báo tồn kho" subtitle={`${alerts.length} nguyên liệu dưới định mức`} icon={<AlertTriangle size={16} />} right={<Link to="/inventory" className="text-[11.5px] font-medium text-matcha-700 hover:underline">Xem kho</Link>} />
          <ul className="divide-y divide-ink-100 px-4 dark:divide-ink-800">
            {alerts.length === 0 && <li className="py-6 text-center text-[12.5px] text-ink-400">Tồn kho đang ổn định</li>}
            {alerts.map((a) => (
              <li key={`${a.id}-${a.branch_name}`} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink-900 dark:text-ink-50">{a.name}</p>
                  <p className="text-[10.5px] text-ink-400">{a.branch_name} · định mức {formatNumber(a.min_stock)}{a.unit}</p>
                  <ProgressBar value={a.ratio} tone={a.ratio < 0.5 ? 'red' : 'amber'} className="mt-1" />
                </div>
                <span className={cx('shrink-0 text-[11.5px] font-semibold tabular-nums', a.ratio < 0.5 ? 'text-rose-600' : 'text-caramel-600')}>
                  {formatNumber(a.qty)}{a.unit}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Top món bán chạy" subtitle={`${days === 1 ? 'Hôm nay' : `${days} ngày`}`} icon={<CupSoda size={16} />} />
          <ul className="divide-y divide-ink-100 px-4 dark:divide-ink-800">
            {top.map((p, i) => (
              <li key={p.product_id} className="flex items-center gap-2.5 py-2">
                <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                  i === 0 ? 'bg-matcha-600 text-white' : i < 3 ? 'bg-matcha-100 text-matcha-800 dark:bg-matcha-900/40 dark:text-matcha-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink-900 dark:text-ink-50">{p.product_name}</p>
                  <p className="text-[10.5px] text-ink-400">{formatNumber(p.qty)} ly · lãi {formatVND(p.profit, { compact: true })}</p>
                </div>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-800 dark:text-ink-100">{formatVND(p.revenue, { compact: true })}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Theo chi nhánh" subtitle="So sánh doanh thu" icon={<Boxes size={16} />} />
          <div className="space-y-3 p-4">
            {branchPerf.map((b, i) => {
              const max = Math.max(...branchPerf.map((x) => x.revenue), 1)
              const profit = b.revenue - b.cogs
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-1.5 font-medium text-ink-800 dark:text-ink-100">
                      <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i] }} />{b.name.replace('Matcha House ', '')}
                    </span>
                    <span className="tabular-nums text-ink-600 dark:text-ink-300">{formatVND(b.revenue, { compact: true })}</span>
                  </div>
                  <ProgressBar value={b.revenue / max} className="mt-1.5" tone={i === 0 ? 'green' : 'amber'} />
                  <p className="mt-1 text-[10.5px] text-ink-400">{formatNumber(b.orders)} đơn · lãi gộp {formatVND(profit, { compact: true })}</p>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Phương thức thanh toán" subtitle="Đối soát dòng tiền" icon={<Coins size={16} />} />
          <div className="space-y-2.5 p-4">
            {payments.map((p, i) => {
              const totalPay = payments.reduce((s, x) => s + x.amount, 0) || 1
              return (
                <div key={p.method}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-ink-600 dark:text-ink-300">{p.method === 'cash' ? 'Tiền mặt' : p.method === 'qr' ? 'VietQR' : p.method === 'card' ? 'Thẻ' : p.method === 'momo' ? 'MoMo' : p.method === 'zalopay' ? 'ZaloPay' : 'Ghi nợ'}</span>
                    <span className="tabular-nums font-medium text-ink-800 dark:text-ink-100">{formatVND(p.amount, { compact: true })}</span>
                  </div>
                  <ProgressBar value={p.amount / totalPay} className="mt-1" tone="amber" />
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Doanh thu theo danh mục" icon={<CupSoda size={16} />} />
          <div className="h-[240px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9e6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#7f8d84' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: '#5d6b62' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [formatVND(Number(v)), 'Doanh thu']} contentStyle={{ borderRadius: 12, border: '1px solid #e5e9e6', fontSize: 12 }} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="#65a30d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Đơn đang xử lý" subtitle="Đồng bộ trực tiếp từ KDS" icon={<ChefHat size={16} />} right={<Link to="/kds" className="text-[11.5px] font-medium text-matcha-700 hover:underline">Mở KDS</Link>} />
          <ActiveOrdersMini />
        </Card>
      </div>
    </div>
  )
}

function ActiveOrdersMini() {
  const branchId = useApp((s) => s.branchId)
  const orders = useSql(() => getActiveOrders(branchId), [branchId])
  if (!orders.length) return <p className="py-10 text-center text-[13px] text-ink-400">Không có đơn nào đang chờ</p>
  return (
    <ul className="divide-y divide-ink-100 px-4 dark:divide-ink-800">
      {orders.slice(0, 6).map((o) => (
        <li key={o.id} className="flex items-center gap-2 py-2.5">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-caramel-100 px-1.5 text-[11.5px] font-bold text-caramel-800 dark:bg-caramel-900/30 dark:text-caramel-300">
            {o.queue_no ?? o.code.slice(-3)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-ink-900 dark:text-ink-50">{o.customer_name ?? 'Khách lẻ'} · {CHANNEL_LABEL[o.channel]}</p>
            <p className="text-[10.5px] text-ink-400">{o.code} · {o.item_count} món</p>
          </div>
          <Badge tone={o.status === 'ready' ? 'green' : o.status === 'preparing' ? 'blue' : 'amber'}>
            {o.status === 'ready' ? 'Sẵn sàng' : o.status === 'preparing' ? 'Đang pha' : 'Chờ'}
          </Badge>
          <Link to="/kds" className="text-ink-300 hover:text-matcha-600"><ArrowUpRight size={15} /></Link>
        </li>
      ))}
    </ul>
  )
}
