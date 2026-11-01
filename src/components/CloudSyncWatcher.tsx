import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CloudLightning, RefreshCw, X } from 'lucide-react'
import { clearCloudError, loadCloud, pullAll, readCloudError } from '../lib/cloud'
import { ensureRoles } from '../lib/permissions'
import { refreshRbac } from '../lib/rbac'
import { connectRealtime, type RealtimeEvent, type RealtimeHandle } from '../lib/realtime'
import { Badge, Button } from './ui'

const TABLE_LABEL: Record<string, string> = {
  orders: 'đơn hàng', order_items: 'dòng đơn', payments: 'thanh toán', order_events: 'tiến trình đơn',
  deliveries: 'vận đơn', delivery_events: 'hành trình giao', inventory_stock: 'tồn kho',
  inventory_txns: 'thẻ kho', customers: 'khách hàng', shifts: 'ca làm việc', print_jobs: 'lệnh in',
}

/**
 * Lắng nghe Supabase Realtime: khi máy khác ghi dữ liệu lên Postgres,
 * hiện banner mời đồng bộ (không tự reload để không làm gián đoạn thu ngân).
 */
export function CloudSyncWatcher() {
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [status, setStatus] = useState<RealtimeHandle['status']>('closed')
  const [detail, setDetail] = useState<string | undefined>()
  const [syncing, setSyncing] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const eventsRef = useRef<RealtimeEvent[]>([])

  useEffect(() => {
    const cfg = loadCloud()
    if (!cfg.url || !cfg.key || cfg.realtime === false) return
    const handle = connectRealtime(
      cfg,
      (e) => {
        // bỏ qua thay đổi do chính tab này vừa đẩy lên (trong 15 giây gần nhất)
        const lastPush = cfg.lastSync ? new Date(cfg.lastSync).getTime() : 0
        if (Date.now() - lastPush < 15000) return
        eventsRef.current = [...eventsRef.current.slice(-30), e]
        setEvents(eventsRef.current)
        setHidden(false)
      },
      (s, d) => { setStatus(s); setDetail(d) },
    )
    return () => handle.close()
  }, [])

  // Lỗi tự đồng bộ (ví dụ: cloud bật RLS mà chưa nhập Mã đồng bộ) → banner cảnh báo
  useEffect(() => {
    const saved = readCloudError()
    if (saved) setCloudError(saved.message)
    const onErr = (ev: Event) => setCloudError(String((ev as CustomEvent<string>).detail ?? 'Lỗi đồng bộ cloud'))
    window.addEventListener('matcha:cloud-error', onErr)
    return () => window.removeEventListener('matcha:cloud-error', onErr)
  }, [])

  const errorBanner = cloudError ? (
    <div className="fixed bottom-4 right-4 z-[91] w-[min(92vw,360px)] rounded-2xl border border-amber-300 bg-amber-50 p-3 shadow-lift dark:border-amber-800 dark:bg-amber-900/30">
      <div className="flex items-start gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
          <AlertTriangle size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-amber-900 dark:text-amber-100">Không tự đồng bộ được với cloud</p>
          <p className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-amber-800 dark:text-amber-200">{cloudError}</p>
          <div className="mt-1.5 flex gap-1.5">
            <Button size="sm" variant="primary" onClick={() => { location.hash = '#/settings' }}>Mở Cài đặt</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCloudError(null); clearCloudError() }}>Bỏ qua</Button>
          </div>
        </div>
        <button onClick={() => { setCloudError(null); clearCloudError() }} className="text-amber-500 hover:text-amber-700" aria-label="Đóng"><X size={13} /></button>
      </div>
    </div>
  ) : null

  if (!events.length || hidden) return <>{errorBanner}</>

  const byTable = events.reduce<Record<string, number>>((acc, e) => { acc[e.table] = (acc[e.table] ?? 0) + 1; return acc }, {})
  const summary = Object.entries(byTable).slice(0, 3).map(([t, n]) => `${TABLE_LABEL[t] ?? t} ×${n}`).join(' · ')

  return (
    <>
      {errorBanner}
    <div className="fixed bottom-4 right-4 z-[90] w-[min(92vw,360px)] rounded-2xl border border-sky-200 bg-white p-3 shadow-lift dark:border-sky-800 dark:bg-ink-900">
      <div className="flex items-start gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">
          <CloudLightning size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-ink-900 dark:text-ink-50">Có thay đổi mới từ cloud</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500 dark:text-ink-400">
            {summary} · dữ liệu trên Postgres vừa được máy khác cập nhật ({events.length} sự kiện realtime).
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button size="sm" variant="primary" icon={<RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />} disabled={syncing}
              onClick={async () => {
                setSyncing(true)
                try {
                  await pullAll(loadCloud())
                  ensureRoles()
                  refreshRbac()
                  location.reload()
                } catch {
                  setSyncing(false)
                }
              }}>{syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setHidden(true); eventsRef.current = []; setEvents([]) }}>Để sau</Button>
            <Badge tone={status === 'live' ? 'green' : status === 'error' ? 'red' : 'gray'} dot className="ml-auto">
              {status === 'live' ? 'realtime' : status === 'connecting' ? 'đang nối' : status === 'error' ? 'lỗi kết nối' : 'tắt'}
            </Badge>
          </div>
          {detail && <p className="mt-1 text-[10.5px] text-ink-400">{detail}</p>}
        </div>
        <button onClick={() => setHidden(true)} className="text-ink-300 hover:text-ink-600" aria-label="Đóng"><X size={13} /></button>
      </div>
    </div>
    </>
  )
}
