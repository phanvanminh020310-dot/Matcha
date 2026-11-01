import { useState } from 'react'
import { BadgePercent, CalendarClock, Gift, Plus, Sparkles, TicketPercent } from 'lucide-react'
import { createVoucher, getPromotions, getVouchers, updateVoucherActive } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { ManageTableLink } from '../components/ManageTableLink'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, MoneyInput, Select, Switch, Tabs } from '../components/ui'
import { TIER_LABEL, cx, formatDate, formatVND, todayVN } from '../lib/format'

export function PromotionsPage() {
  const [tab, setTab] = useState<'voucher' | 'promo'>('voucher')
  const [creating, setCreating] = useState(false)
  const vouchers = useSql(() => getVouchers(), [])
  const promotions = useSql(() => getPromotions(), [])
  const today = todayVN()

  return (
    <div>
      <PageHeader
        icon={<TicketPercent size={20} />}
        title="Khuyến mãi & voucher"
        description="Voucher theo mã và chương trình khuyến mãi tự động (giờ vàng, hạng thành viên, combo)"
        actions={<>
          <ManageTableLink table={tab === 'voucher' ? 'vouchers' : 'promotions'} />
          {tab === 'voucher' && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>Tạo voucher</Button>}
        </>}
      />
      <Tabs value={tab} onChange={setTab} className="mb-3 w-fit" tabs={[{ value: 'voucher', label: 'Voucher', count: vouchers.length }, { value: 'promo', label: 'Chương trình tự động', count: promotions.length }]} />

      {tab === 'voucher' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {vouchers.map((v) => {
            const expired = v.end_at.slice(0, 10) < today
            const usedRatio = v.usage_limit ? v.used_count / v.usage_limit : 0
            return (
              <Card key={v.id} className={cx('overflow-hidden', expired && 'opacity-70')}>
                <div className="flex items-start justify-between gap-2 border-b border-dashed border-ink-200 bg-gradient-to-br from-matcha-50 to-cream-100 p-3 dark:border-ink-700 dark:from-ink-800 dark:to-ink-800">
                  <div>
                    <p className="font-mono text-[15px] font-bold tracking-wide text-matcha-800 dark:text-matcha-300">{v.code}</p>
                    <p className="text-[11.5px] text-ink-500">{v.name}</p>
                  </div>
                  <Switch checked={!!v.is_active} onChange={(val) => updateVoucherActive(v.id, val ? 1 : 0)} label="Bật voucher" />
                </div>
                <div className="space-y-1.5 p-3 text-[12px]">
                  <div className="flex justify-between"><span className="text-ink-500">Giảm</span><span className="font-semibold text-matcha-700 dark:text-matcha-300">{v.type === 'percent' ? `${v.value}%` : formatVND(v.value)}{v.max_discount ? ` (tối đa ${formatVND(v.max_discount, { compact: true })})` : ''}</span></div>
                  <div className="flex justify-between"><span className="text-ink-500">Đơn tối thiểu</span><span>{formatVND(v.min_order)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-500">Hạn dùng</span><span className={cx(expired && 'text-rose-600')}>{formatDate(v.start_at)} – {formatDate(v.end_at)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-500">Đã dùng</span><span>{v.used_count}/{v.usage_limit ?? '∞'}</span></div>
                  {v.tier_required && <div className="flex justify-between"><span className="text-ink-500">Hạng tối thiểu</span><Badge tone="amber">{TIER_LABEL[v.tier_required as keyof typeof TIER_LABEL]?.label ?? v.tier_required}</Badge></div>}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700"><div className="h-full bg-matcha-500" style={{ width: `${Math.min(100, usedRatio * 100)}%` }} /></div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {promotions.map((p) => {
            const cfg = JSON.parse(p.config || '{}')
            return (
              <Card key={p.id}>
                <CardHeader title={p.name} subtitle={`Loại: ${p.type}`} icon={<Gift size={16} />} right={<Badge tone={p.is_active ? 'green' : 'gray'}>{p.is_active ? 'Đang chạy' : 'Tắt'}</Badge>} />
                <div className="space-y-1.5 p-4 text-[12.5px]">
                  {Object.entries(cfg).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <span className="text-ink-500">{k}</span>
                      <span className="text-right font-medium text-ink-800 dark:text-ink-100">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                    </div>
                  ))}
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-400"><CalendarClock size={12} /> Áp dụng: toàn hệ thống</p>
                </div>
              </Card>
            )
          })}
          <Card className="border-dashed">
            <div className="p-4 text-[12.5px] leading-relaxed text-ink-500 dark:text-ink-400">
              <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-ink-800 dark:text-ink-100"><Sparkles size={14} className="text-matcha-600" /> Cách hệ thống áp dụng</p>
              POS tự tính giảm giá theo <b>giờ vàng</b> (14h–16h, 20% tối đa 30k), <b>giảm theo hạng thành viên</b> (Bạc 3%, Vàng 5%, Kim cương 8%)
              và chọn mức giảm tốt nhất. Voucher nhập tay sẽ cộng thêm. Mọi khoản giảm được lưu riêng trên đơn
              (<code>promotion_discount</code>, <code>voucher_discount</code>) để báo cáo hiệu quả khuyến mãi.
            </div>
          </Card>
        </div>
      )}
      {vouchers.length === 0 && tab === 'voucher' && <Card><EmptyState icon={<BadgePercent size={20} />} title="Chưa có voucher" /></Card>}
      {creating && <CreateVoucherModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function CreateVoucherModal({ onClose }: { onClose: () => void }) {
  const toast = useApp((s) => s.toast)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState(10)
  const [minOrder, setMinOrder] = useState(0)
  const [maxDiscount, setMaxDiscount] = useState(50000)
  const [limit, setLimit] = useState(100)
  const [tier, setTier] = useState('')
  const today = todayVN()

  return (
    <Modal open onClose={onClose} title="Tạo voucher" size="md"
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" disabled={code.length < 3 || name.length < 3} onClick={() => {
        createVoucher({ code, name, campaign: 'Thủ công', type, value, min_order: minOrder, max_discount: type === 'percent' ? maxDiscount : null, usage_limit: limit, tier_required: tier || null, start_at: `${today} 00:00:00`, end_at: '2026-12-31 23:59:59', is_active: 1 })
        toast({ title: `Đã tạo voucher ${code.toUpperCase()}`, tone: 'success' })
        onClose()
      }}>Tạo voucher</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mã voucher" required><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MATCHA20" /></Field>
        <Field label="Tên chương trình" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Giảm 20% toàn menu" /></Field>
        <Field label="Loại giảm"><Select value={type} onChange={(e) => setType(e.target.value as any)}><option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền cố định</option></Select></Field>
        <Field label={type === 'percent' ? 'Giá trị (%)' : 'Số tiền giảm'}>
          {type === 'percent' ? <Input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} /> : <MoneyInput value={value} onChange={setValue} />}
        </Field>
        <Field label="Đơn tối thiểu"><MoneyInput value={minOrder} onChange={setMinOrder} /></Field>
        <Field label="Giảm tối đa"><MoneyInput value={maxDiscount} onChange={setMaxDiscount} /></Field>
        <Field label="Giới hạn lượt dùng"><Input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} /></Field>
        <Field label="Hạng khách tối thiểu">
          <Select value={tier} onChange={(e) => setTier(e.target.value)}><option value="">Mọi hạng</option>{Object.entries(TIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        </Field>
      </div>
    </Modal>
  )
}
