import { useMemo, useState } from 'react'
import { Cake, Crown, HeartHandshake, Phone, Search, Sparkles, UserPlus } from 'lucide-react'
import { createCustomer, getCustomer, getCustomerOrders, getCustomers, type Customer } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Tabs } from '../components/ui'
import { CHANNEL_LABEL, STATUS_LABEL, TIER_LABEL, cx, formatDate, formatNumber, formatVND } from '../lib/format'

export function CustomersPage() {
  const toast = useApp((s) => s.toast)
  const [q, setQ] = useState('')
  const [tier, setTier] = useState<'all' | 'bronze' | 'silver' | 'gold' | 'diamond'>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const customers = useSql(() => getCustomers(400), [])

  const filtered = useMemo(() => customers.filter((c) =>
    (tier === 'all' || c.tier === tier) && (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))), [customers, q, tier])

  const stats = useMemo(() => {
    const total = customers.length
    const spent = customers.reduce((s, c) => s + Number(c.total_spent), 0)
    const vip = customers.filter((c) => c.tier === 'gold' || c.tier === 'diamond').length
    return { total, spent, vip, avg: total ? spent / total : 0 }
  }, [customers])

  return (
    <div>
      <PageHeader
        icon={<HeartHandshake size={20} />}
        title="Khách hàng & CRM"
        description={`${formatNumber(stats.total)} khách · ${stats.vip} khách Vàng/Kim cương · chi tiêu TB ${formatVND(stats.avg, { compact: true })}`}
        actions={<Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setCreating(true)}>Thêm khách</Button>}
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        {(['bronze', 'silver', 'gold', 'diamond'] as const).map((t) => {
          const n = customers.filter((c) => c.tier === t).length
          return (
            <Card key={t} className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-500">{TIER_LABEL[t].emoji} Hạng {TIER_LABEL[t].label}</span>
                <span className="text-[15px] font-semibold text-ink-900 dark:text-ink-50">{n}</span>
              </div>
              <p className="mt-1 text-[11px] text-ink-400">
                {t === 'bronze' ? 'dưới 450k' : t === 'silver' ? 'từ 450k' : t === 'gold' ? 'từ 1,2tr' : 'từ 2,2tr'} chi tiêu
              </p>
            </Card>
          )
        })}
      </div>

      <Card className="mb-3 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc số điện thoại…" className="pl-9" />
        </div>
        <Tabs value={tier} onChange={setTier} tabs={[{ value: 'all' as const, label: 'Tất cả' }, ...(['bronze', 'silver', 'gold', 'diamond'] as const).map((t) => ({ value: t, label: TIER_LABEL[t].label }))]} />
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Khách hàng</th><th>Số điện thoại</th><th>Hạng</th><th className="text-right">Điểm</th><th className="text-right">Số đơn</th><th className="text-right">Tổng chi</th><th>Đơn gần nhất</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <td>
                    <p className="font-medium text-ink-900 dark:text-ink-50">{c.name}</p>
                    <p className="text-[11px] text-ink-400">{c.code}{c.birthday ? ` · 🎂 ${c.birthday}` : ''}</p>
                  </td>
                  <td className="tabular-nums text-ink-600 dark:text-ink-300">{c.phone}</td>
                  <td><Badge tone={c.tier === 'diamond' ? 'blue' : c.tier === 'gold' ? 'amber' : c.tier === 'silver' ? 'gray' : 'gray'}>{TIER_LABEL[c.tier].emoji} {TIER_LABEL[c.tier].label}</Badge></td>
                  <td className="text-right tabular-nums">{formatNumber(c.points)}</td>
                  <td className="text-right tabular-nums">{c.order_count}</td>
                  <td className="text-right font-semibold tabular-nums">{formatVND(c.total_spent, { compact: true })}</td>
                  <td className="text-ink-500">{(c as any).last_order ? formatDate((c as any).last_order) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState icon={<HeartHandshake size={20} />} title="Không tìm thấy khách hàng" />}
      </Card>

      {openId && <CustomerDetail id={openId} onClose={() => setOpenId(null)} />}
      {creating && <CreateCustomerModal onClose={() => setCreating(false)} onCreated={(c) => { toast({ title: 'Đã tạo khách hàng', description: c.name, tone: 'success' }); setCreating(false) }} />}
    </div>
  )
}

function CustomerDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const customer = useSql(() => getCustomer(id), [id])
  const orders = useSql(() => getCustomerOrders(id), [id])
  if (!customer) return null
  return (
    <Modal open onClose={onClose} title={customer.name} description={`${customer.code} · ${customer.phone}`} size="lg">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-2">
          <div className="rounded-2xl bg-matcha-900 p-4 text-white">
            <p className="text-[11.5px] text-white/50">Hạng thành viên</p>
            <p className="text-[20px] font-semibold">{TIER_LABEL[customer.tier].emoji} {TIER_LABEL[customer.tier].label}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div><p className="text-white/50">Điểm tích luỹ</p><p className="font-semibold">{formatNumber(customer.points)}</p></div>
              <div><p className="text-white/50">Tổng chi tiêu</p><p className="font-semibold">{formatVND(customer.total_spent, { compact: true })}</p></div>
              <div><p className="text-white/50">Số đơn</p><p className="font-semibold">{customer.order_count}</p></div>
              <div><p className="text-white/50">TB/đơn</p><p className="font-semibold">{formatVND(customer.order_count ? customer.total_spent / customer.order_count : 0, { compact: true })}</p></div>
            </div>
          </div>
          <div className="rounded-xl border border-ink-200 p-3 text-[12px] dark:border-ink-700">
            <p className="flex items-center gap-1.5 text-ink-500"><Phone size={12} /> {customer.phone}</p>
            {customer.email && <p className="mt-1 text-ink-500">{customer.email}</p>}
            {customer.birthday && <p className="mt-1 flex items-center gap-1.5 text-ink-500"><Cake size={12} /> {customer.birthday}</p>}
            <p className="mt-1 text-ink-400">Thành viên từ {formatDate(customer.created_at)}</p>
            {customer.note && <p className="mt-2 rounded-lg bg-cream-200/70 p-2 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{customer.note}</p>}
          </div>
          <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-700 dark:text-ink-200"><Sparkles size={13} className="text-caramel-500" /> Gợi ý chăm sóc</p>
            <p className="text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
              {customer.tier === 'diamond' ? 'Khách VIP: ưu tiên voucher 50k, mời thử món mới trước.' :
                customer.tier === 'gold' ? 'Gửi ưu đãi sinh nhật và combo tiết kiệm để tăng tần suất.' :
                  customer.order_count < 2 ? 'Khách mới: gửi voucher lần mua tiếp theo trong 7 ngày.' : 'Duy trì điểm thưởng và nhắc ưu đãi giờ vàng.'}
            </p>
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Lịch sử mua ({orders.length})</h4>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700">
            <table className="table-base">
              <thead><tr><th>Mã</th><th>Thời gian</th><th>Kênh</th><th className="text-right">Tổng</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="text-[11.5px]">{o.code}</td>
                    <td className="whitespace-nowrap text-[11.5px] text-ink-500">{o.created_at.slice(0, 16)}</td>
                    <td className="text-[11.5px]">{CHANNEL_LABEL[o.channel]}</td>
                    <td className="text-right text-[11.5px] font-medium tabular-nums">{formatVND(o.total)}</td>
                    <td><Badge tone={o.status === 'cancelled' ? 'red' : 'green'}>{STATUS_LABEL[o.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && <p className="py-8 text-center text-[12.5px] text-ink-400">Chưa có đơn nào</p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function CreateCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Customer) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [note, setNote] = useState('')
  return (
    <Modal open onClose={onClose} title="Thêm khách hàng" size="sm"
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" disabled={name.length < 2 || phone.length < 9} onClick={() => onCreated(createCustomer({ name, phone, birthday: birthday || undefined, note: note || undefined }))}>Tạo khách</Button></>}>
      <div className="space-y-3">
        <Field label="Họ tên" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Số điện thoại" required><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
        <Field label="Sinh nhật" hint="Định dạng MM-DD"><Input value={birthday} onChange={(e) => setBirthday(e.target.value)} placeholder="12-25" /></Field>
        <Field label="Ghi chú"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sở thích, dị ứng…" /></Field>
      </div>
    </Modal>
  )
}
