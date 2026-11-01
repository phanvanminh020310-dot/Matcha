import { useEffect, useMemo, useRef, useState } from 'react'
import { Bike, CheckCircle2, Clock, Copy, MapPin, Navigation, Package, Phone, Route, Send, Share2, Star, Timer, TriangleAlert, Truck } from 'lucide-react'
import {
  DELIVERY_STATUS, assignShipper, createDelivery, deliveryStats, getDeliveries, getDeliveryEvents,
  getShippers, rateDelivery, updateDeliveryStatus, type DeliveryRow,
} from '../lib/api'
import { BRANCH_GEO, DEMO_PLACES, deliveryFeeFor, haversine, pointAlong, route, searchAddress, type RouteResult } from '../lib/geo'
import { all } from '../lib/db'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Select, Stat, Tabs, Textarea } from '../components/ui'
import { FleetMap3D, type FleetShipment } from '../components/FleetMap3D'
import { MapView } from '../components/MapView'
import { cx, formatDateTime, formatNumber, formatVND, minutesSince, nowVN } from '../lib/format'
import { GPS_FRESH_MINUTES, fetchRemotePositions, gpsAgeMinutes, latestLocalPositions, type GpsPoint } from '../lib/gps'

type TabKey = 'board' | 'map' | 'create'

export function DeliveryPage() {
  const { branchId, user, toast } = useApp()
  const [tab, setTab] = useState<TabKey>('board')
  const [detailId, setDetailId] = useState<number | null>(null)
  const deliveries = useSql(() => getDeliveries({ branchId, limit: 150 }), [branchId])
  const stats = useSql(() => deliveryStats(branchId), [branchId])
  const shippers = useSql(() => getShippers(), [])

  const active = deliveries.filter((d) => ['waiting', 'assigned', 'picked_up', 'delivering'].includes(d.status))
  const columns: { key: DeliveryRow['status']; items: DeliveryRow[] }[] = [
    { key: 'waiting', items: deliveries.filter((d) => d.status === 'waiting') },
    { key: 'assigned', items: deliveries.filter((d) => d.status === 'assigned') },
    { key: 'picked_up', items: deliveries.filter((d) => d.status === 'picked_up') },
    { key: 'delivering', items: deliveries.filter((d) => d.status === 'delivering') },
    { key: 'delivered', items: deliveries.filter((d) => d.status === 'delivered').slice(0, 12) },
  ]

  return (
    <div>
      <PageHeader
        icon={<Bike size={20} />}
        title="Giao hàng & điều phối"
        description="Vận đơn thật: geocode địa chỉ, tuyến đường OSRM, phí theo km, theo dõi shipper trực tuyến"
        actions={<Button variant="primary" icon={<Send size={15} />} onClick={() => setTab('create')}>Tạo vận đơn</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Chờ điều phối" value={stats.waiting} icon={<Clock size={17} />} tone="amber" sub={`${shippers.length} tài xế sẵn sàng`} />
        <Stat label="Đang giao" value={stats.delivering + stats.picked_up + stats.assigned} icon={<Truck size={17} />} tone="blue" sub={`${stats.assigned} đã gán · ${stats.picked_up} đã lấy hàng`} />
        <Stat label="Đã giao (tổng)" value={formatNumber(stats.delivered)} icon={<CheckCircle2 size={17} />} sub={`${stats.failed} thất bại`} />
        <Stat label="Doanh thu giao hôm nay" value={formatVND(stats.revenueToday, { compact: true })} icon={<Route size={17} />} tone="violet" sub="Đơn kênh Giao hàng" />
      </div>

      <Tabs value={tab} onChange={setTab} className="my-3"
        tabs={[{ value: 'board' as TabKey, label: 'Bảng điều phối', count: active.length }, { value: 'map' as TabKey, label: 'Bản đồ 3D trực tiếp' }, { value: 'create' as TabKey, label: 'Tạo vận đơn' }]} />

      {tab === 'board' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {columns.map((col) => (
            <div key={col.key} className="rounded-2xl bg-cream-200/50 p-2 dark:bg-ink-900/40">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[12px] font-semibold text-ink-700 dark:text-ink-200">{DELIVERY_STATUS[col.key].icon} {DELIVERY_STATUS[col.key].label}</p>
                <span className="rounded-full bg-white px-1.5 text-[10.5px] text-ink-500 dark:bg-ink-800">{col.items.length}</span>
              </div>
              <div className="space-y-2">
                {col.items.map((d) => <DeliveryCard key={d.id} d={d} shippers={shippers} onOpen={() => setDetailId(d.id)} />)}
                {col.items.length === 0 && <p className="py-6 text-center text-[11.5px] text-ink-400">Trống</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'map' && <LiveMap deliveries={active} branchId={branchId} onOpen={setDetailId} />}
      {tab === 'create' && <CreateDelivery branchId={branchId} userId={user?.id ?? 1} onDone={() => setTab('board')} />}
      {detailId && <DeliveryDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

function DeliveryCard({ d, shippers, onOpen }: { d: DeliveryRow; shippers: ReturnType<typeof getShippers>; onOpen: () => void }) {
  const { toast } = useApp()
  const [assigning, setAssigning] = useState(false)
  const late = d.eta_at && ['assigned', 'picked_up', 'delivering'].includes(d.status) && d.eta_at < nowVN()

  return (
    <div className={cx('rounded-xl border bg-white p-2.5 shadow-soft transition hover:shadow-lift dark:bg-ink-900',
      late ? 'border-rose-300 dark:border-rose-700' : 'border-ink-200 dark:border-ink-700')}>
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-ink-500">{d.code}</span>
          {d.cod_amount > 0 && <Badge tone="amber">COD {formatVND(d.cod_amount, { compact: true })}</Badge>}
        </div>
        <p className="mt-0.5 text-[12.5px] font-semibold text-ink-900 dark:text-ink-50">{d.customer_name ?? 'Khách lẻ'}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-500 dark:text-ink-400">{d.address}</p>
        <div className="mt-1 flex items-center gap-2 text-[10.5px] text-ink-400">
          <span>{d.distance_km} km</span><span>·</span><span>{formatVND(d.fee, { compact: true })}</span>
          <span>·</span><span>{d.item_count} món</span>
        </div>
        {d.eta_at && d.status !== 'delivered' && (
          <p className={cx('mt-1 flex items-center gap-1 text-[10.5px]', late ? 'text-rose-600' : 'text-ink-500')}>
            <Timer size={11} /> ETA {d.eta_at.slice(11, 16)} {late && '· trễ'}
          </p>
        )}
        {d.shipper_name && <p className="mt-1 text-[10.5px] text-matcha-700 dark:text-matcha-300">🛵 {d.shipper_name}</p>}
      </button>

      <div className="mt-2 flex flex-wrap gap-1">
        {d.status === 'waiting' && (
          assigning ? (
            <Select autoFocus className="h-8 w-full text-[11px]" defaultValue="" onChange={(e) => {
              if (!e.target.value) return
              assignShipper(d.id, Number(e.target.value), 1)
              toast({ title: 'Đã gán tài xế', description: d.code, tone: 'success' })
              setAssigning(false)
            }}>
              <option value="">Chọn tài xế…</option>
              {shippers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          ) : <Button size="sm" variant="primary" className="w-full" icon={<Bike size={13} />} onClick={() => setAssigning(true)}>Gán tài xế</Button>
        )}
        {d.status === 'assigned' && <Button size="sm" variant="primary" className="w-full" icon={<Package size={13} />} onClick={() => { updateDeliveryStatus(d.id, 'picked_up', { note: 'Tài xế đã lấy hàng' }); toast({ title: 'Đã lấy hàng', tone: 'success' }) }}>Đã lấy hàng</Button>}
        {d.status === 'picked_up' && <Button size="sm" variant="primary" className="w-full" icon={<Navigation size={13} />} onClick={() => { updateDeliveryStatus(d.id, 'delivering', { note: 'Bắt đầu giao' }); toast({ title: 'Đang giao', tone: 'success' }) }}>Bắt đầu giao</Button>}
        {d.status === 'delivering' && <Button size="sm" variant="primary" className="w-full" icon={<CheckCircle2 size={13} />} onClick={() => { updateDeliveryStatus(d.id, 'delivered', { note: 'Giao thành công' }); toast({ title: 'Giao thành công', description: d.code, tone: 'success' }) }}>Giao thành công</Button>}
        {['assigned', 'picked_up', 'delivering'].includes(d.status) && (
          <Button size="sm" variant="ghost" className="w-full text-rose-600" icon={<TriangleAlert size={13} />} onClick={() => {
            updateDeliveryStatus(d.id, 'failed', { note: 'Khách không nghe máy', failReason: 'Không liên hệ được khách' })
            toast({ title: 'Đã ghi nhận giao thất bại', tone: 'error' })
          }}>Thất bại</Button>
        )}
      </div>
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  waiting: '#f59e0b', assigned: '#0ea5e9', picked_up: '#38bdf8', delivering: '#22c55e', delivered: '#16a34a',
}

function LiveMap({ deliveries, branchId, onOpen }: { deliveries: DeliveryRow[]; branchId: number; onOpen: (id: number) => void }) {
  const [selected, setSelected] = useState<number | null>(deliveries[0]?.id ?? null)
  const [routes, setRoutes] = useState<Record<number, RouteResult>>({})
  const origin = BRANCH_GEO[branchId] ?? BRANCH_GEO[1]

  // ---- GPS THẬT: đọc vị trí mới nhất (máy này + Postgres) mỗi 5 giây ----
  const [gps, setGps] = useState<Record<number, GpsPoint>>({})
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const local = latestLocalPositions(120)
      const remote = await fetchRemotePositions(60)
      if (cancelled) return
      const merged: Record<number, GpsPoint> = { ...local }
      Object.entries(remote ?? {}).forEach(([k, v]) => {
        const id = Number(k)
        const cur = merged[id]
        if (!cur || v.recordedAt > cur.recordedAt) merged[id] = v
      })
      setGps(merged)
    }
    void tick()
    const timer = setInterval(tick, 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  // lấy tuyến OSRM thật cho từng vận đơn (song song, có cache trong lib/geo)
  useEffect(() => {
    let cancelled = false
    const targets = deliveries.filter((d) => d.lat && d.lng).slice(0, 12)
    Promise.all(targets.map(async (d) => {
      const r = await route({ lat: origin.lat, lng: origin.lng }, { lat: Number(d.lat), lng: Number(d.lng) })
      return [d.id, r] as const
    })).then((pairs) => {
      if (cancelled) return
      setRoutes(Object.fromEntries(pairs))
    }).catch(() => { /* offline: vẫn hiện điểm, không có tuyến */ })
    return () => { cancelled = true }
  }, [deliveries.map((d) => `${d.id}:${d.lat}:${d.lng}`).join(','), origin.lat, origin.lng])

  const shipments: FleetShipment[] = deliveries.map((d) => ({
    id: d.id,
    code: `VD${String(d.id).padStart(6, '0')}`,
    status: d.status,
    statusLabel: DELIVERY_STATUS[d.status].label,
    color: STATUS_COLOR[d.status] ?? '#38bdf8',
    customerName: d.customer_name,
    address: d.address,
    lat: Number(d.lat),
    lng: Number(d.lng),
    shipperName: d.shipper_name,
    phone: d.shipper_phone,
    amount: Number(d.total ?? 0),
    route: routes[d.id] ?? null,
    live: (() => {
      // ưu tiên điểm GPS gắn trực tiếp vào vận đơn, sau đó mới tới tài xế được gán
      const byDelivery = Object.values(gps).find((x) => x.deliveryId === d.id)
      const p = byDelivery ?? (d.shipper_id ? gps[d.shipper_id] : null)
      if (!p) return null
      const age = gpsAgeMinutes(p)
      return age <= GPS_FRESH_MINUTES ? { lat: p.lat, lng: p.lng, heading: p.heading, ageMin: age } : null
    })(),
  }))

  const withRoute = shipments.filter((s) => s.route)
  const totalKm = withRoute.reduce((sum, s) => sum + (s.route?.distanceKm ?? 0), 0)
  const urgent = shipments.filter((s) => s.status === 'waiting').length
  const online = new Set(shipments.map((s) => s.shipperName).filter(Boolean)).size

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
      <div className="space-y-2">
        <FleetMap3D
          origin={{ lat: origin.lat, lng: origin.lng, label: origin.label }}
          shipments={shipments}
          selectedId={selected}
          onSelect={setSelected}
          height={560}
        />
        <div className="flex flex-wrap items-center gap-2 px-1 text-[11.5px] text-ink-500">
          <Badge tone="green" dot>tuyến OSRM thật</Badge>
          {shipments.filter((s) => s.live).length > 0
            ? <Badge tone="purple">{shipments.filter((s) => s.live).length} xe đang phát GPS thật</Badge>
            : <Badge tone="gray">chưa có GPS thật — đang mô phỏng theo tuyến</Badge>}
          <span>{online} tài xế trực tuyến · {shipments.length} vận đơn · tổng {totalKm.toFixed(1)} km</span>
          {urgent > 0 && <Badge tone="amber">{urgent} đơn chờ tài xế</Badge>}
          <span className="ml-auto hidden sm:block">Kéo chuột để xoay · chuột phải để nghiêng · lăn chuột để zoom</span>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Đội xe đang chạy" subtitle={`${shipments.length} vận đơn · ${online} tài xế`} icon={<Bike size={16} />} />
        <div className="max-h-[560px] overflow-y-auto">
          {shipments.map((s) => {
            const rt = routes[s.id]
            return (
              <button key={s.id} onClick={() => setSelected(s.id)} className={cx('w-full border-b border-ink-100 px-3 py-2 text-left last:border-0 dark:border-ink-800',
                selected === s.id ? 'bg-matcha-50 dark:bg-matcha-900/20' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-ink-500">{s.code}</span>
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${s.color}22`, color: s.color }}>{s.statusLabel}</span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-ink-900 dark:text-ink-50">{s.customerName ?? 'Khách lẻ'}</p>
                <p className="truncate text-[11px] text-ink-400">{s.address}</p>
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-ink-400">
                  <span>🛵 {s.shipperName ?? 'chưa gán'}</span>
                  {rt && <span>· {rt.distanceKm} km · {rt.durationMin} phút</span>}
                </div>
              </button>
            )
          })}
          {shipments.length === 0 && <EmptyState title="Không có vận đơn đang chạy" />}
        </div>
      </Card>
    </div>
  )
}

function CreateDelivery({ branchId, userId, onDone }: { branchId: number; userId: number; onDone: () => void }) {
  const { toast } = useApp()
  const origin = BRANCH_GEO[branchId] ?? BRANCH_GEO[1]
  const candidates = useSql(() => all<{ id: number; code: string; total: number; note: string | null }>(
    `SELECT o.id, o.code, o.total, o.note FROM orders o LEFT JOIN deliveries d ON d.order_id = o.id
     WHERE o.channel = 'delivery' AND o.status != 'cancelled' AND d.id IS NULL AND o.branch_id = ? ORDER BY o.id DESC LIMIT 40`, [branchId]), [branchId])
  const [orderId, setOrderId] = useState<number | null>(candidates[0]?.id ?? null)
  const [q, setQ] = useState('')
  const [places, setPlaces] = useState<{ display: string; lat: number; lng: number; district?: string }[]>([])
  const [selected, setSelected] = useState<{ display: string; lat: number; lng: number; district?: string } | null>(null)
  const [rt, setRt] = useState<RouteResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (!orderId && candidates.length) setOrderId(candidates[0].id) }, [candidates, orderId])

  const doSearch = async () => {
    setLoading(true)
    const res = await searchAddress(q)
    setPlaces(res.length ? res : DEMO_PLACES.map((p) => ({ display: p.address, lat: p.lat, lng: p.lng, district: p.district })))
    setLoading(false)
  }

  const pick = async (p: { display: string; lat: number; lng: number; district?: string }) => {
    setSelected(p)
    const r = await route({ lat: origin.lat, lng: origin.lng }, { lat: p.lat, lng: p.lng })
    setRt(r)
  }

  const fee = rt ? deliveryFeeFor(rt.distanceKm) : 0
  const order = candidates.find((c) => c.id === orderId)

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="1. Chọn đơn cần giao" subtitle={`${candidates.length} đơn giao hàng chưa có vận đơn`} icon={<Package size={16} />} />
        <div className="max-h-[260px] overflow-y-auto">
          {candidates.map((o) => (
            <button key={o.id} onClick={() => setOrderId(o.id)} className={cx('flex w-full items-center justify-between border-b border-ink-100 px-3 py-2 text-left dark:border-ink-800',
              orderId === o.id ? 'bg-matcha-50 dark:bg-matcha-900/20' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
              <div>
                <p className="font-mono text-[12px] text-ink-800 dark:text-ink-100">{o.code}</p>
                <p className="text-[11px] text-ink-400">{o.note ?? 'Không có ghi chú'}</p>
              </div>
              <span className="text-[12px] font-semibold">{formatVND(o.total, { compact: true })}</span>
            </button>
          ))}
          {candidates.length === 0 && <EmptyState title="Mọi đơn giao hàng đã có vận đơn" />}
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Địa chỉ & tuyến đường" subtitle="Tìm địa chỉ thật qua OpenStreetMap Nominatim" icon={<MapPin size={16} />} />
        <div className="space-y-2 p-3">
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nhập địa chỉ: 72 Lê Thánh Tôn, Quận 1…" onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} />
            <Button variant="primary" onClick={doSearch} disabled={loading || q.length < 3}>{loading ? 'Đang tìm…' : 'Tìm'}</Button>
          </div>
          {places.length > 0 && (
            <div className="max-h-[150px] space-y-1 overflow-y-auto rounded-xl border border-ink-200 p-1.5 dark:border-ink-700">
              {places.map((p, i) => (
                <button key={i} onClick={() => pick(p)} className="w-full rounded-lg px-2 py-1.5 text-left text-[11.5px] hover:bg-ink-50 dark:hover:bg-ink-800">
                  <p className="line-clamp-2 text-ink-700 dark:text-ink-200">{p.display}</p>
                  {p.district && <p className="text-[10px] text-ink-400">{p.district}</p>}
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="rounded-xl bg-matcha-50 p-2.5 text-[12px] dark:bg-matcha-900/20">
              <p className="font-medium text-matcha-800 dark:text-matcha-200">{selected.display}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-[11.5px] text-ink-600 dark:text-ink-300">
                <span>{rt?.distanceKm ?? '—'} km</span>
                <span>{rt?.durationMin ?? '—'} phút</span>
                <span>Phí ship {formatVND(fee)}</span>
                <span className="text-ink-400">nguồn: {rt?.source === 'osrm' ? 'OSRM' : 'ước lượng'}</span>
              </div>
            </div>
          )}
          {selected && <MapView markers={[{ id: 'o', lat: origin.lat, lng: origin.lng, kind: 'branch', label: 'Chi nhánh' }, { id: 'c', lat: selected.lat, lng: selected.lng, kind: 'customer', label: 'Điểm giao' }]} route={rt?.geometry} height={220} />}
          <Button variant="primary" block disabled={!order || !selected || !rt} icon={<Send size={15} />} onClick={() => {
            if (!order || !selected || !rt) return
            createDelivery({
              orderId: order.id, branchId, address: selected.display, district: selected.district ?? null,
              lat: selected.lat, lng: selected.lng, distanceKm: rt.distanceKm, fee,
              codAmount: order.total, etaMinutes: rt.durationMin, userId,
            })
            toast({ title: 'Đã tạo vận đơn', description: `${order.code} · ${rt.distanceKm} km · ${formatVND(fee)}`, tone: 'success' })
            onDone()
          }}>Tạo vận đơn & đưa vào điều phối</Button>
        </div>
      </Card>
    </div>
  )
}

function DeliveryDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { toast } = useApp()
  const d = useSql(() => getDeliveries({ limit: 200 }).find((x) => x.id === id) ?? null, [id])
  const events = useSql(() => getDeliveryEvents(id), [id])
  const [rt, setRt] = useState<RouteResult | null>(null)
  const origin = d ? (BRANCH_GEO[d.branch_id] ?? BRANCH_GEO[1]) : BRANCH_GEO[1]

  useEffect(() => {
    if (!d?.lat || !d?.lng) return
    route({ lat: origin.lat, lng: origin.lng }, { lat: d.lat, lng: d.lng }).then(setRt).catch(() => {})
  }, [d?.id, d?.lat, d?.lng, origin.lat, origin.lng])

  if (!d) return null
  const trackUrl = `${location.origin}${location.pathname}#/track/${d.code}`

  return (
    <Modal open onClose={onClose} size="lg" title={`${d.code} · ${DELIVERY_STATUS[d.status].label}`}
      description={`${d.order_code} · ${d.customer_name ?? 'Khách lẻ'} · ${d.customer_phone ?? '—'}`}
      footer={<>
        <Button icon={<Copy size={14} />} onClick={() => { navigator.clipboard?.writeText(trackUrl); toast({ title: 'Đã copy link theo dõi', description: trackUrl, tone: 'success' }) }}>Link theo dõi</Button>
        <Button icon={<Share2 size={14} />} onClick={() => window.open(trackUrl, '_blank')}>Mở trang khách</Button>
        <Button variant="primary" onClick={onClose}>Đóng</Button>
      </>}>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-2">
          {d.lat && d.lng ? (
            <FleetMap3D
              height={250}
              origin={{ lat: origin.lat, lng: origin.lng }}
              selectedId={d.id}
              onSelect={() => {}}
              shipments={[{
                id: d.id, code: d.code ?? `VD${String(d.id).padStart(6, '0')}`, status: d.status, statusLabel: DELIVERY_STATUS[d.status].label,
                color: STATUS_COLOR[d.status] ?? '#38bdf8', customerName: d.customer_name, address: d.address ?? '',
                lat: Number(d.lat), lng: Number(d.lng), shipperName: d.shipper_name, phone: d.customer_phone ?? null,
                amount: Number(d.total ?? 0), route: rt,
              }]}
            />
          ) : (
            <MapView markers={[{ id: 'o', lat: origin.lat, lng: origin.lng, kind: 'branch', label: 'Chi nhánh' }]} height={230} />
          )}
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <Info label="Địa chỉ" value={d.address} wide />
            <Info label="Khoảng cách" value={`${d.distance_km} km`} />
            <Info label="Phí giao" value={formatVND(d.fee)} />
            <Info label="COD" value={d.cod_amount ? formatVND(d.cod_amount) : 'Không thu hộ'} />
            <Info label="Tài xế" value={d.shipper_name ?? 'Chưa gán'} />
            <Info label="ETA" value={d.eta_at ? formatDateTime(d.eta_at) : '—'} />
            <Info label="Tạo lúc" value={formatDateTime(d.created_at)} />
            <Info label="Đánh giá" value={d.rating ? `${'★'.repeat(d.rating)}${'☆'.repeat(5 - d.rating)}` : '—'} />
          </div>
          {d.status === 'delivered' && !d.rating && (
            <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 p-2 dark:bg-amber-900/20">
              <span className="text-[11.5px] text-ink-600 dark:text-ink-300">Khách chấm điểm:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => { rateDelivery(d.id, n); toast({ title: `Đã lưu ${n} sao`, tone: 'success' }) }} className="text-amber-500 hover:scale-110">
                  <Star size={15} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Hành trình</p>
          <ol className="space-y-1.5">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="rounded-xl border border-ink-200 p-2 dark:border-ink-700">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-ink-900 dark:text-ink-50">{DELIVERY_STATUS[e.status]?.label ?? e.status}</span>
                  <span className="text-[10.5px] text-ink-400">{formatDateTime(e.created_at)}</span>
                </div>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">{e.note}</p>
                {e.lat && <p className="font-mono text-[9.5px] text-ink-300">{e.lat.toFixed(5)}, {e.lng?.toFixed(5)} · {e.actor}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  )
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-[10.5px] uppercase tracking-wide text-ink-400">{label}</p>
      <p className="text-[12px] text-ink-800 dark:text-ink-100">{value}</p>
    </div>
  )
}

/* ------------------------------- trang theo dõi cho khách ------------------------------- */
export function TrackingPage({ code }: { code: string }) {
  const id = Number(code.replace(/^VD0*/, '')) || 0
  const [tick, setTick] = useState(0)
  const delivery = useSql(() => (id ? getDeliveries({ limit: 500 }).find((d) => d.id === id) ?? null : null), [id])
  const events = useSql(() => (id ? getDeliveryEvents(id) : []), [id])
  const [rt, setRt] = useState<RouteResult | null>(null)
  const [progress, setProgress] = useState(0.15)
  const origin = delivery ? (BRANCH_GEO[delivery.branch_id] ?? BRANCH_GEO[1]) : BRANCH_GEO[1]

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!delivery?.lat || !delivery?.lng) return
    route({ lat: origin.lat, lng: origin.lng }, { lat: delivery.lat, lng: delivery.lng }).then(setRt).catch(() => {})
  }, [delivery?.id, delivery?.lat, delivery?.lng, origin.lat, origin.lng])

  // vị trí shipper suy ra từ tiến trình thời gian thật: lấy hàng → ETA
  useEffect(() => {
    if (!delivery) return
    if (delivery.status === 'delivered') { setProgress(1); return }
    if (!delivery.picked_at || !delivery.eta_at) { setProgress(0.05); return }
    const start = new Date(delivery.picked_at.replace(' ', 'T') + '+07:00').getTime()
    const end = new Date(delivery.eta_at.replace(' ', 'T') + '+07:00').getTime()
    const now = Date.now()
    setProgress(Math.max(0.05, Math.min(0.98, (now - start) / Math.max(1, end - start))))
  }, [delivery?.id, delivery?.status, delivery?.picked_at, delivery?.eta_at, tick])

  if (!delivery) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream-100 p-6 dark:bg-ink-950">
        <Card className="max-w-sm p-6 text-center">
          <p className="text-[36px]">🔍</p>
          <p className="mt-2 text-[15px] font-semibold">Không tìm thấy vận đơn {code}</p>
          <p className="mt-1 text-[12.5px] text-ink-500">Vận đơn chỉ tồn tại trên thiết bị đã tạo đơn (dữ liệu lưu trong trình duyệt).</p>
        </Card>
      </div>
    )
  }

  const pos = rt ? pointAlong(rt.geometry, progress) : null
  const remaining = delivery.eta_at ? Math.max(0, Math.round((new Date(delivery.eta_at.replace(' ', 'T') + '+07:00').getTime() - Date.now()) / 60000)) : null

  return (
    <div className="min-h-dvh bg-cream-100 pb-8 dark:bg-ink-950">
      <header className="bg-matcha-800 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M7 4c.6.8.6 1.7 0 2.5M10.5 4c.6.8.6 1.7 0 2.5" /></svg>
          </span>
          <div>
            <p className="text-[15px] font-semibold">Theo dõi đơn giao hàng</p>
            <p className="text-[11.5px] text-white/70">{delivery.code} · {delivery.branch_name}</p>
          </div>
          <Badge tone="gray" className="ml-auto !bg-white/15 !text-white">{DELIVERY_STATUS[delivery.status].label}</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-3 p-3">
        <Card className="p-2">
          <MapView
            markers={[
              { id: 'o', lat: origin.lat, lng: origin.lng, kind: 'branch', label: 'Quán', popup: delivery.branch_name ?? '' },
              ...(delivery.lat && delivery.lng ? [{ id: 'c', lat: delivery.lat, lng: delivery.lng, kind: 'customer' as const, label: 'Điểm giao', popup: delivery.address }] : []),
              ...(pos ? [{ id: 's', lat: pos.lat, lng: pos.lng, kind: 'shipper' as const, label: 'Tài xế', popup: `${delivery.shipper_name ?? 'Tài xế'} đang di chuyển` }] : []),
            ]}
            route={rt?.geometry}
            height={300}
          />
          <div className="flex flex-wrap items-center gap-3 px-2 py-2 text-[12px]">
            <span className="font-medium text-ink-800 dark:text-ink-100">{remaining != null && delivery.status !== 'delivered' ? `Dự kiến giao sau ${remaining} phút` : DELIVERY_STATUS[delivery.status].label}</span>
            <span className="text-ink-400">{delivery.distance_km} km · {delivery.shipper_name ?? 'chưa gán tài xế'}</span>
            {delivery.shipper_phone && <a href={`tel:${delivery.shipper_phone}`} className="ml-auto flex items-center gap-1 text-matcha-700 dark:text-matcha-300"><Phone size={13} /> Gọi tài xế</a>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Hành trình đơn hàng" subtitle={`Cập nhật lúc ${nowVN().slice(11, 16)}`} icon={<Timer size={16} />} />
          <ol className="space-y-0 p-3">
            {[...events].reverse().map((e, i) => (
              <li key={e.id} className="flex gap-2.5 pb-3 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className={cx('mt-0.5 h-2.5 w-2.5 rounded-full', i === 0 ? 'bg-matcha-600 ring-4 ring-matcha-100 dark:ring-matcha-900' : 'bg-ink-300')} />
                  {i < events.length - 1 && <span className="mt-0.5 w-px flex-1 bg-ink-200 dark:bg-ink-700" />}
                </div>
                <div className="flex-1">
                  <p className="text-[12.5px] font-medium text-ink-900 dark:text-ink-50">{DELIVERY_STATUS[e.status]?.label ?? e.status}</p>
                  <p className="text-[11.5px] text-ink-500 dark:text-ink-400">{e.note}</p>
                  <p className="text-[10.5px] text-ink-400">{formatDateTime(e.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-3 text-[12px]">
          <p className="text-[10.5px] uppercase tracking-wide text-ink-400">Giao tới</p>
          <p className="text-ink-800 dark:text-ink-100">{delivery.address}</p>
          <p className="mt-1 text-ink-500">{delivery.customer_name} · {delivery.customer_phone ?? '—'}</p>
          <div className="mt-2 flex justify-between border-t border-ink-100 pt-2 dark:border-ink-800">
            <span className="text-ink-500">Phí giao hàng</span><span>{formatVND(delivery.fee)}</span>
          </div>
          {delivery.cod_amount > 0 && <div className="flex justify-between"><span className="text-ink-500">Thu hộ (COD)</span><span className="font-semibold">{formatVND(delivery.cod_amount)}</span></div>}
        </Card>
      </div>
    </div>
  )
}
