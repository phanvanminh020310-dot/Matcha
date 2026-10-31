import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, Check, ChevronRight, Download, Eye, Filter, Printer, ReceiptText, Search, X } from 'lucide-react'
import { cancelOrder, getOrderDetail, getOrders, updateOrderStatus } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, Pagination, Select, Tabs } from '../components/ui'
import { CHANNEL_LABEL, METHOD_LABEL, SOURCE_LABEL, STATUS_LABEL, addDays, cx, downloadFile, formatDateTime, formatVND, todayVN, toCSV } from '../lib/format'

const STATUS_TONE: Record<string, 'green' | 'amber' | 'blue' | 'red' | 'gray' | 'purple'> = {
  completed: 'green', ready: 'blue', preparing: 'amber', pending: 'amber', cancelled: 'red',
}

export function OrdersPage() {
  const { branchId, user, toast, role } = useApp()
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [from, setFrom] = useState(addDays(todayVN(), -6))
  const [to, setTo] = useState(todayVN())
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(params.get('order') ? Number(params.get('order')) : null)
  const [cancelId, setCancelId] = useState<number | null>(null)
  const pageSize = 25

  const { rows, total } = useSql(
    () => getOrders({ branchId, search, status: status || undefined, channel: channel || undefined, from, to, limit: pageSize, offset: (page - 1) * pageSize }),
    [branchId, search, status, channel, from, to, page],
  )

  const summary = useMemo(() => {
    const valid = rows.filter((r) => r.status !== 'cancelled')
    return { revenue: valid.reduce((s, r) => s + r.total, 0), count: valid.length }
  }, [rows])

  const exportCsv = () => {
    const data = rows.map((o) => ({
      'Mã đơn': o.code, 'Thời gian': o.created_at, 'Chi nhánh': o.branch_name, 'Kênh': CHANNEL_LABEL[o.channel],
      'Nguồn': SOURCE_LABEL[o.source], 'Khách': o.customer_name ?? 'Khách lẻ', 'SĐT': o.customer_phone ?? '',
      'Thu ngân': o.cashier_name ?? '', 'Trạng thái': STATUS_LABEL[o.status], 'Tạm tính': o.subtotal,
      'Giảm giá': o.promotion_discount + o.voucher_discount, 'VAT': o.vat_amount, 'Phí giao': o.delivery_fee, 'Tổng': o.total, 'Giá vốn': o.cogs,
    }))
    downloadFile(`don-hang-${from}-${to}.csv`, toCSV(data))
    toast({ title: 'Đã xuất CSV', description: `${data.length} dòng`, tone: 'success' })
  }

  return (
    <div>
      <PageHeader
        icon={<ReceiptText size={20} />}
        title="Quản lý đơn hàng"
        description="Tra cứu, theo dõi trạng thái, huỷ đơn và xuất dữ liệu"
        actions={<Button variant="secondary" icon={<Download size={15} />} onClick={exportCsv}>Xuất CSV</Button>}
      />

      <Card className="mb-3 p-3">
        <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Mã đơn, SĐT hoặc tên khách…" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">Mọi trạng thái</option>
            {Object.entries(STATUS_LABEL).filter(([k]) => ['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1) }}>
            <option value="">Mọi kênh</option>
            {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-ink-500">
          <span>{total.toLocaleString('vi-VN')} đơn trong khoảng thời gian · trang này doanh thu {formatVND(summary.revenue)}</span>
          <span className="text-ink-400">Bấm vào dòng để xem chi tiết</span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Mã đơn</th><th>Thời gian</th><th>Kênh</th><th>Khách</th><th className="text-center">Món</th>
                <th className="text-right">Tổng tiền</th><th className="text-right">Lãi gộp</th><th>Trạng thái</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="cursor-pointer" onClick={() => setOpenId(o.id)}>
                  <td className="font-medium text-ink-900 dark:text-ink-50">{o.code}</td>
                  <td className="whitespace-nowrap text-ink-500">{formatDateTime(o.created_at)}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      {CHANNEL_LABEL[o.channel]}
                      {o.source !== 'pos' && <Badge tone="purple">{SOURCE_LABEL[o.source]}</Badge>}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate">{o.customer_name ?? <span className="text-ink-400">Khách lẻ</span>}</td>
                  <td className="text-center tabular-nums">{o.item_count}</td>
                  <td className="text-right font-semibold tabular-nums">{formatVND(o.total)}</td>
                  <td className="text-right tabular-nums text-ink-500">{formatVND(o.total - o.cogs)}</td>
                  <td><Badge tone={STATUS_TONE[o.status] ?? 'gray'}>{STATUS_LABEL[o.status]}</Badge></td>
                  <td><ChevronRight size={15} className="text-ink-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <EmptyState icon={<ReceiptText size={20} />} title="Không có đơn nào" description="Thử đổi khoảng ngày hoặc bộ lọc." />}
        <div className="px-3"><Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} /></div>
      </Card>

      {openId && <OrderDetailModal id={openId} onClose={() => setOpenId(null)} onCancel={(id) => setCancelId(id)} canCancel={role === 'owner' || role === 'manager'} />}

      <ConfirmDialog
        open={!!cancelId}
        title="Huỷ đơn hàng"
        message="Đơn sẽ chuyển sang trạng thái Đã huỷ, nguyên liệu được hoàn lại kho, điểm khách được trừ lại và ghi audit log."
        confirmLabel="Huỷ đơn"
        requireReason
        onCancel={() => setCancelId(null)}
        onConfirm={(reason) => {
          if (cancelId && user) {
            cancelOrder(cancelId, reason || 'Không rõ lý do', user.id)
            toast({ title: 'Đã huỷ đơn', description: 'Nguyên liệu đã được hoàn lại kho.', tone: 'success' })
          }
          setCancelId(null); setOpenId(null)
        }}
      />
    </div>
  )
}

function OrderDetailModal({ id, onClose, onCancel, canCancel }: { id: number; onClose: () => void; onCancel: (id: number) => void; canCancel: boolean }) {
  const { user, toast } = useApp()
  const detail = useSql(() => getOrderDetail(id), [id])
  if (!detail) return null
  const { order, items, payments, events } = detail

  return (
    <Modal open onClose={onClose} title={`Đơn ${order.code}`} description={`${formatDateTime(order.created_at)} · ${CHANNEL_LABEL[order.channel]} · ${order.branch_name}`} size="lg"
      footer={
        <>
          {order.status === 'pending' && <Button icon={<Check size={15} />} onClick={() => { if (user) { updateOrderStatus(order.id, 'preparing', user.id); toast({ title: 'Đã chuyển sang pha chế', tone: 'success' }) } }}>Bắt đầu pha chế</Button>}
          {order.status === 'preparing' && <Button icon={<Check size={15} />} onClick={() => { if (user) { updateOrderStatus(order.id, 'ready', user.id); toast({ title: 'Đã báo sẵn sàng', tone: 'success' }) } }}>Pha chế xong</Button>}
          {order.status === 'ready' && <Button icon={<Check size={15} />} onClick={() => { if (user) { updateOrderStatus(order.id, 'completed', user.id); toast({ title: 'Đã hoàn tất đơn', tone: 'success' }) } }}>Giao khách</Button>}
          {canCancel && order.status !== 'cancelled' && order.status !== 'completed' && (
            <Button variant="danger" icon={<Ban size={15} />} onClick={() => onCancel(order.id)}>Huỷ đơn</Button>
          )}
          <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>In</Button>
          <Button onClick={onClose}>Đóng</Button>
        </>
      }>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-3 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-4">
            <Mini label="Trạng thái" value={<Badge tone={STATUS_TONE[order.status] ?? 'gray'}>{STATUS_LABEL[order.status]}</Badge>} />
            <Mini label="Thu ngân" value={order.cashier_name ?? '—'} />
            <Mini label="Khách" value={order.customer_name ?? 'Khách lẻ'} />
            <Mini label="Bàn / Số gọi" value={order.table_name ?? (order.queue_no ? `#${order.queue_no}` : '—')} />
          </div>

          <table className="table-base">
            <thead><tr><th>Món</th><th className="text-center">SL</th><th className="text-right">Đơn giá</th><th className="text-right">T.Tiền</th><th className="text-right">Giá vốn</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <p className="font-medium text-ink-900 dark:text-ink-50">{it.product_name} <span className="text-ink-400">({it.size_code})</span></p>
                    <p className="text-[11px] text-ink-500">Đường {it.sugar_level}% · Đá {it.ice_level}%{it.toppings?.length ? ` · ${it.toppings.map((t) => t.topping_name).join(', ')}` : ''}</p>
                    {it.note && <p className="text-[11px] italic text-caramel-600">* {it.note}</p>}
                  </td>
                  <td className="text-center tabular-nums">{it.qty}</td>
                  <td className="text-right tabular-nums">{formatVND(it.unit_price)}</td>
                  <td className="text-right font-medium tabular-nums">{formatVND(it.unit_price * it.qty)}</td>
                  <td className="text-right tabular-nums text-ink-400">{formatVND(it.unit_cost * it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 space-y-1 rounded-xl bg-ink-50 p-3 text-[12.5px] dark:bg-ink-800/60">
            <Row label="Tạm tính" value={formatVND(order.subtotal)} />
            {order.promotion_discount > 0 && <Row label="Khuyến mãi tự động" value={`−${formatVND(order.promotion_discount)}`} />}
            {order.voucher_discount > 0 && <Row label="Voucher" value={`−${formatVND(order.voucher_discount)}`} />}
            {order.points_used > 0 && <Row label={`Điểm đã dùng (${order.points_used})`} value={`−${formatVND(order.points_used * 1000)}`} />}
            {order.delivery_fee > 0 && <Row label="Phí giao hàng" value={formatVND(order.delivery_fee)} />}
            <Row label="VAT (đã gồm)" value={formatVND(order.vat_amount)} />
            <div className="flex justify-between border-t border-ink-200 pt-1 text-[14px] font-bold dark:border-ink-700">
              <dt>Khách phải trả</dt><dd className="tabular-nums text-matcha-700 dark:text-matcha-300">{formatVND(order.total)}</dd>
            </div>
            <Row label="Giá vốn (COGS)" value={formatVND(order.cogs)} />
            <Row label="Lãi gộp" value={formatVND(order.total - order.cogs)} />
          </dl>
        </div>

        <div>
          <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Thanh toán</h4>
          <ul className="space-y-1.5">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl border border-ink-200 px-2.5 py-1.5 text-[12.5px] dark:border-ink-700">
                <span>{METHOD_LABEL[p.method] ?? p.method}{p.ref ? <span className="ml-1 text-[10.5px] text-ink-400">{p.ref}</span> : null}</span>
                <span className="font-semibold tabular-nums">{formatVND(p.amount)}</span>
              </li>
            ))}
          </ul>

          <h4 className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Dòng thời gian</h4>
          <ol className="relative space-y-2.5 border-l border-ink-200 pl-3.5 dark:border-ink-700">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-matcha-500" />
                <p className="text-[12.5px] font-medium text-ink-800 dark:text-ink-100">{STATUS_LABEL[e.status] ?? e.status}</p>
                <p className="text-[10.5px] text-ink-400">{formatDateTime(e.created_at)} · {e.user_name ?? 'Hệ thống'}</p>
                {e.note && <p className="text-[10.5px] italic text-ink-500">{e.note}</p>}
              </li>
            ))}
          </ol>
          {order.cancel_reason && <p className="mt-3 rounded-lg bg-rose-50 px-2.5 py-2 text-[11.5px] text-rose-700">Lý do huỷ: {order.cancel_reason}</p>}
        </div>
      </div>
    </Modal>
  )
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-ink-50 px-2.5 py-2 dark:bg-ink-800/60">
      <p className="text-[10.5px] text-ink-400">{label}</p>
      <p className="font-medium text-ink-800 dark:text-ink-100">{value}</p>
    </div>
  )
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-ink-500">{label}</dt><dd className="tabular-nums text-ink-800 dark:text-ink-100">{value}</dd></div>
}
