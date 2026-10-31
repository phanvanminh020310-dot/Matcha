import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellOff, Check, ChefHat, Clock, Coffee, Expand, Filter, Play, Timer, Utensils, Volume2 } from 'lucide-react'
import { getActiveOrders, getOrderDetail, updateOrderStatus, type Order } from '../lib/api'
import { useSql, useTick } from '../hooks/useDb'
import { useApp } from '../store/app'
import { Badge, Button, Card, EmptyState, IconButton, Tabs } from '../components/ui'
import { CHANNEL_LABEL, cx, elapsedLabel, minutesSince, nowVN, STATUS_LABEL } from '../lib/format'

const COLUMNS = [
  { key: 'pending', label: 'Đơn mới', tone: 'amber', next: 'preparing', action: 'Bắt đầu pha chế' },
  { key: 'preparing', label: 'Đang pha chế', tone: 'blue', next: 'ready', action: 'Pha chế xong' },
  { key: 'ready', label: 'Sẵn sàng', tone: 'green', next: 'completed', action: 'Đã giao khách' },
] as const

export function KDSPage() {
  const { user, branchId, toast } = useApp()
  const tick = useTick(1000)
  const [channelFilter, setChannelFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all')
  const [sound, setSound] = useState(true)
  const orders = useSql(() => getActiveOrders(branchId), [branchId, tick > 0])
  const prevCount = useRef(orders.length)
  const [flash, setFlash] = useState(false)

  const filtered = useMemo(
    () => orders.filter((o) => channelFilter === 'all' || o.channel === channelFilter),
    [orders, channelFilter],
  )

  useEffect(() => {
    if (orders.length > prevCount.current && sound) {
      setFlash(true)
      beep()
      setTimeout(() => setFlash(false), 2600)
    }
    prevCount.current = orders.length
  }, [orders.length, sound])

  const move = (order: Order, next: string) => {
    if (!user) return
    updateOrderStatus(order.id, next, user.id)
    toast({
      title: `${order.code} → ${STATUS_LABEL[next]}`,
      description: next === 'completed' ? 'Đơn đã hoàn tất, doanh thu đã ghi nhận.' : undefined,
      tone: 'success',
    })
  }

  const columnsData = COLUMNS.map((c) => ({ ...c, items: filtered.filter((o) => o.status === c.key) }))

  return (
    <div className={cx('space-y-3 transition-colors', flash && 'rounded-3xl ring-4 ring-caramel-400/60')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            <ChefHat size={22} className="text-matcha-600" /> Màn hình bếp (KDS)
          </h1>
          <p className="text-[13px] text-ink-500 dark:text-ink-400">
            {orders.length} đơn đang xử lý · cập nhật realtime giữa POS và bếp · {nowVN()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={channelFilter}
            onChange={setChannelFilter}
            tabs={[
              { value: 'all', label: 'Tất cả', count: orders.length },
              { value: 'dine_in', label: 'Tại quán', count: orders.filter((o) => o.channel === 'dine_in').length },
              { value: 'takeaway', label: 'Mang đi', count: orders.filter((o) => o.channel === 'takeaway').length },
              { value: 'delivery', label: 'Giao hàng', count: orders.filter((o) => o.channel === 'delivery').length },
            ]}
          />
          <IconButton label={sound ? 'Tắt âm thanh' : 'Bật âm thanh'} onClick={() => setSound((s) => !s)} active={sound}>
            {sound ? <Volume2 size={18} /> : <BellOff size={18} />}
          </IconButton>
          <IconButton label="Toàn màn hình" onClick={() => document.documentElement.requestFullscreen?.()}><Expand size={18} /></IconButton>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {columnsData.map((col) => (
          <div key={col.key} className="min-w-0">
            <div className="mb-2 flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 shadow-soft dark:bg-ink-900/70">
              <div className="flex items-center gap-2">
                <span className={cx('h-2 w-2 rounded-full',
                  col.tone === 'amber' ? 'bg-caramel-500' : col.tone === 'blue' ? 'bg-sky-500' : 'bg-matcha-500')} />
                <h2 className="text-[13.5px] font-semibold text-ink-900 dark:text-ink-50">{col.label}</h2>
              </div>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">{col.items.length}</span>
            </div>

            <div className="max-h-[calc(100dvh-190px)] space-y-2.5 overflow-y-auto pr-0.5">
              {col.items.length === 0 && (
                <Card className="border-dashed"><EmptyState icon={<Coffee size={18} />} title="Trống" description="Chưa có đơn ở cột này." /></Card>
              )}
              {col.items.map((o) => (
                <Ticket key={o.id} order={o} action={col.action} onAction={() => move(o, col.next)} tone={col.tone} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Ticket({ order, action, onAction, tone }: { order: Order; action: string; onAction: () => void; tone: string }) {
  const detail = useSql(() => getOrderDetail(order.id), [order.id])
  const mins = minutesSince(order.status === 'ready' ? order.ready_at ?? order.created_at : order.preparing_at ?? order.created_at)
  const target = order.channel === 'delivery' ? 12 : 6
  const late = mins > target
  const warn = mins > target * 0.66 && !late

  return (
    <Card className={cx('overflow-hidden border-l-4 animate-pop',
      late ? 'border-l-rose-500' : warn ? 'border-l-caramel-400' : tone === 'green' ? 'border-l-matcha-500' : 'border-l-sky-400')}>
      <div className="flex items-start justify-between gap-2 bg-ink-50/60 px-3 py-2 dark:bg-ink-800/40">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold text-ink-900 dark:text-ink-50">
              {order.queue_no ? `#${order.queue_no}` : order.table_name ?? order.code.slice(-4)}
            </span>
            <Badge tone={order.channel === 'delivery' ? 'purple' : order.channel === 'takeaway' ? 'amber' : 'green'}>
              {CHANNEL_LABEL[order.channel]}
            </Badge>
            {order.source !== 'pos' && <Badge tone="gray">{order.source}</Badge>}
          </div>
          <p className="mt-0.5 text-[10.5px] text-ink-400">{order.code}</p>
        </div>
        <div className={cx('flex items-center gap-1rounded-lg px-1.5 py-1 text-[12px] font-bold tabular-nums',
          late ? 'text-rose-600' : warn ? 'text-caramel-600' : 'text-ink-500')}>
          <Timer size={13} /> {elapsedLabel(order.status === 'ready' ? order.ready_at ?? order.created_at : order.preparing_at ?? order.created_at)}
        </div>
      </div>

      <ul className="space-y-1.5 px-3 py-2">
        {detail?.items.map((it) => (
          <li key={it.id} className="flex gap-2 text-[12.5px]">
            <span className="w-5 shrink-0 rounded bg-matcha-600 text-center text-[11px] font-bold leading-5 text-white">{it.qty}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-tight text-ink-900 dark:text-ink-50">{it.product_name}</p>
              <p className="text-[10.5px] leading-tight text-ink-500">
                {it.size_code} · Đ{it.sugar_level}% · Đá{it.ice_level}%
                {it.toppings?.length ? ` · ${it.toppings.map((t) => t.topping_name).join(', ')}` : ''}
              </p>
              {it.note && <p className="text-[10.5px] font-medium italic text-caramel-600">* {it.note}</p>}
            </div>
          </li>
        ))}
      </ul>

      {order.note && <p className="mx-3 mb-2 rounded-lg bg-caramel-50 px-2 py-1 text-[11px] text-caramel-800 dark:bg-caramel-900/20 dark:text-caramel-200">{order.note}</p>}

      <div className="flex items-center gap-1.5 border-t border-ink-100 px-3 py-2 dark:border-ink-800">
        <Button size="sm" variant={tone === 'green' ? 'primary' : 'secondary'} block onClick={onAction} icon={<Check size={14} />}>{action}</Button>
      </div>
    </Card>
  )
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.06
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    setTimeout(() => { osc.stop(); ctx.close() }, 190)
  } catch { /* trình duyệt chặn autoplay */ }
}
