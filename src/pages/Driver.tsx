/**
 * App tài xế — phát GPS THẬT từ điện thoại.
 *  • Bật chia sẻ vị trí: watchPosition (high accuracy) gửi điểm lên máy + Postgres.
 *  • Nhận đơn → đã lấy hàng → đang giao → giao xong (thu COD), ghi delivery_events.
 *  • Điều phối ở chi nhánh khác mở trang Giao hàng sẽ thấy xe chạy theo GPS thật này.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bike, CheckCircle2, CircleDot, Navigation, Phone, RefreshCw, Satellite, Square, TriangleAlert } from 'lucide-react'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Select, Stat } from '../components/ui'
import { getDeliveries, updateDeliveryStatus, type DeliveryRow } from '../lib/api'
import { useApp } from '../store/app'
import { useSql } from '../hooks/useDb'
import { GPS_FRESH_MINUTES, gpsAgeMinutes, latestLocalPositions, metersBetween, pushPointToCloud, saveLocalPoint, vnNow, type GpsPoint } from '../lib/gps'
import { loadCloud } from '../lib/cloud'
import { cx, formatVND } from '../lib/format'

type GeoState = 'idle' | 'asking' | 'live' | 'denied' | 'unsupported'

export function DriverPage() {
  const { user, branchId, toast } = useApp()
  const me = user ?? { id: 1, name: 'Tài xế', role: 'cashier' }
  const cfg = loadCloud()
  const [state, setState] = useState<GeoState>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [point, setPoint] = useState<GpsPoint | null>(null)
  const [sent, setSent] = useState(0)
  const [sentCloud, setSentCloud] = useState(0)
  const [lastSend, setLastSend] = useState<string | null>(null)
  const [auto, setAuto] = useState(true)
  const [targetId, setTargetId] = useState<number | null>(null)
  const watchRef = useRef<number | null>(null)
  const lastRef = useRef<{ lat: number; lng: number; at: number } | null>(null)

  const active = useSql(
    () => getDeliveries({ branchId, limit: 80 }).filter((d) => ['waiting', 'assigned', 'picked_up', 'delivering'].includes(d.status)),
    [branchId],
  )
  const mine = useMemo(() => active.filter((d) => d.shipper_id === me.id || d.shipper_id === null), [active, me.id])
  const recent = useSql(() => {
    const all = latestLocalPositions(120)
    return Object.values(all)
  }, [sent])

  /** Gửi 1 điểm: lưu máy + đẩy cloud (nếu đã cấu hình). */
  const sendPoint = async (pos: GeolocationPosition, source: 'gps' | 'manual' = 'gps') => {
    const p = {
      driverId: me.id,
      deliveryId: targetId ?? mine.find((d) => d.status === 'delivering' || d.status === 'picked_up')?.id ?? null,
      lat: Number(pos.coords.latitude.toFixed(7)),
      lng: Number(pos.coords.longitude.toFixed(7)),
      heading: pos.coords.heading ?? null,
      speedKmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
      accuracy: pos.coords.accuracy ?? null,
      source,
      recordedAt: vnNow(),
    }
    const id = saveLocalPoint(p)
    setPoint({ ...p, id, deliveryId: p.deliveryId })
    setSent((n) => n + 1)
    setLastSend(vnNow().slice(11))
    const r = await pushPointToCloud({ ...p, id })
    if (r.ok) setSentCloud((n) => n + 1)
    else if (!r.skipped) setErr(`Không gửi được lên cloud: ${r.message ?? ''}`)
  }

  const start = () => {
    if (!('geolocation' in navigator)) { setState('unsupported'); return }
    setState('asking')
    setErr(null)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState('live')
        const now = Date.now()
        const last = lastRef.current
        const moved = !last || metersBetween(last, { lat: pos.coords.latitude, lng: pos.coords.longitude }) > 15 || now - last.at > 20000
        lastRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: now }
        if (moved) void sendPoint(pos)
      },
      (e) => {
        setState(e.code === e.PERMISSION_DENIED ? 'denied' : 'idle')
        setErr(e.message)
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 },
    )
  }

  const stop = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    setState('idle')
  }

  useEffect(() => () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current) }, [])

  const act = (d: DeliveryRow, to: DeliveryRow['status']) => {
    const note = to === 'picked_up' ? 'Tài xế đã lấy hàng' : to === 'delivering' ? 'Bắt đầu giao (app tài xế)' : 'Giao thành công (app tài xế)'
    updateDeliveryStatus(d.id, to, { note, ...(d.shipper_id ? {} : {}) })
    if (!d.shipper_id) {
      // nhận đơn: gán tài xế là chính mình
      import('../lib/api').then((m) => m.assignShipper(d.id, me.id, 1)).catch(() => { /* offline */ })
    }
    toast({ title: 'Đã cập nhật vận đơn', description: `${d.code ?? `VD${d.id}`} → ${to}`, tone: 'success' })
  }

  const live = state === 'live'
  const accuracy = point?.accuracy ?? null

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={<Satellite size={20} />}
        title="App tài xế · GPS thật"
        description="Mở trên điện thoại của tài xế: bật chia sẻ vị trí, nhận & giao đơn. Máy điều phối sẽ thấy xe chạy theo GPS thật."
        actions={<Badge tone={live ? 'green' : 'gray'} dot>{live ? 'Đang phát GPS' : 'Chưa phát'}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Điểm đã gửi (máy)" value={sent} icon={<CircleDot size={17} />} tone="green" sub={lastSend ? `lần cuối ${lastSend}` : 'chưa gửi'} />
        <Stat label="Điểm đã lên Postgres" value={sentCloud} icon={<RefreshCw size={17} />} tone="blue" sub={cfg.url ? 'máy khác thấy ngay' : 'chưa cấu hình cloud'} />
        <Stat label="Đơn của tôi" value={mine.length} icon={<Bike size={17} />} tone="amber" sub={`${mine.filter((d) => d.status === 'delivering').length} đang giao`} />
      </div>

      <Card className="mt-3">
        <CardHeader title="Chia sẻ vị trí" subtitle="Dùng GPS của điện thoại (độ chính xác cao), tự gửi khi bạn di chuyển > 15 m hoặc 20 giây" icon={<Satellite size={16} />} />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {!live ? (
              <Button variant="primary" icon={<Satellite size={16} />} onClick={start}>
                {state === 'asking' ? 'Đang xin quyền vị trí…' : 'Bật chia sẻ vị trí'}
              </Button>
            ) : (
              <Button variant="secondary" icon={<Square size={15} />} onClick={stop}>Dừng chia sẻ</Button>
            )}
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={() => {
              navigator.geolocation?.getCurrentPosition((p) => void sendPoint(p, 'manual'),
                (e) => setErr(e.message), { enableHighAccuracy: true, timeout: 15000 })
            }}>Gửi 1 điểm ngay</Button>
            <Select className="h-8 w-auto min-w-[210px] text-[12px]" value={targetId ?? ''} onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Gắn GPS vào: đơn đang giao (tự động)</option>
              {mine.map((d) => <option key={d.id} value={d.id}>Gắn GPS vào {d.code ?? `VD${d.id}`}</option>)}
            </Select>
            <label className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-1.5 text-[12px] dark:bg-ink-800">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-matcha-600" />
              Tự gửi khi di chuyển
            </label>
          </div>

          {state === 'denied' && (
            <p className="rounded-xl bg-rose-50 p-2.5 text-[12px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
              <TriangleAlert size={13} className="mr-1 inline" /> Trình duyệt đã chặn quyền vị trí. Trên điện thoại: mở Cài đặt trình duyệt → Quyền → Vị trí → Cho phép, rồi tải lại trang. (Trang phải chạy HTTPS — bản GitHub Pages đã có HTTPS.)
            </p>
          )}
          {state === 'unsupported' && <p className="text-[12px] text-rose-600">Thiết bị/trình duyệt không hỗ trợ Geolocation.</p>}
          {err && state !== 'denied' && <p className="text-[11.5px] text-amber-700 dark:text-amber-300">{err}</p>}

          {point && (
            <div className="grid gap-2 rounded-xl border border-ink-200 bg-cream-100 p-3 text-[12.5px] dark:border-ink-700 dark:bg-ink-900 sm:grid-cols-2">
              <div><span className="text-ink-500">Toạ độ: </span><b className="font-mono">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</b></div>
              <div><span className="text-ink-500">Sai số: </span><b>{accuracy != null ? `${Math.round(accuracy)} m` : '—'}</b></div>
              <div><span className="text-ink-500">Tốc độ: </span><b>{point.speedKmh != null ? `${point.speedKmh} km/h` : '—'}</b></div>
              <div><span className="text-ink-500">Hướng: </span><b>{point.heading != null ? `${Math.round(point.heading)}°` : '—'}</b></div>
              <div className="sm:col-span-2">
                <a className="text-matcha-700 underline dark:text-matcha-300" target="_blank" rel="noreferrer"
                  href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}>Mở trên Google Maps ↗</a>
                <span className="ml-3 text-ink-400">Gửi lúc {point.recordedAt.slice(11)}</span>
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
            Điểm GPS được ghi vào bảng <b>driver_positions</b> (máy + Postgres). Trang <b>Giao hàng → Bản đồ 3D</b> sẽ hiện xe ở vị trí thật và gắn nhãn
            “GPS thật” khi điểm còn mới (&lt; {GPS_FRESH_MINUTES} phút). Không có GPS thì bản đồ tự mô phỏng theo tuyến để vẫn xem được luồng.
          </p>
        </div>
      </Card>

      <Card className="mt-3">
        <CardHeader title="Đơn cần giao" subtitle="Bấm theo đúng thứ tự: nhận đơn → đã lấy hàng → đang giao → giao xong" icon={<Bike size={16} />} />
        <div className="space-y-2 p-3">
          {mine.length === 0 && <EmptyState icon={<CheckCircle2 size={20} />} title="Không có đơn nào" description="Đơn mới sẽ xuất hiện ở đây khi điều phối gán cho bạn." />}
          {mine.map((d) => (
            <div key={d.id} className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">{d.customer_name ?? 'Khách lẻ'} · <span className="font-mono text-[11px] text-ink-500">{d.code ?? `VD${d.id}`}</span></p>
                  <p className="text-[11.5px] text-ink-500">{d.address}</p>
                  <p className="mt-0.5 text-[11px] text-ink-400">{d.distance_km} km · {formatVND(d.fee)} · COD {formatVND(d.cod_amount)}</p>
                </div>
                <Badge tone={d.status === 'waiting' ? 'amber' : d.status === 'delivering' ? 'green' : 'blue'}>{d.status}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.status === 'waiting' && <Button size="sm" variant="primary" onClick={() => act(d, 'assigned')}>Nhận đơn</Button>}
                {d.status === 'assigned' && <Button size="sm" variant="primary" icon={<Bike size={13} />} onClick={() => act(d, 'picked_up')}>Đã lấy hàng</Button>}
                {d.status === 'picked_up' && <Button size="sm" variant="primary" icon={<Navigation size={13} />} onClick={() => act(d, 'delivering')}>Bắt đầu giao</Button>}
                {d.status === 'delivering' && <Button size="sm" variant="primary" icon={<CheckCircle2 size={13} />} onClick={() => act(d, 'delivered')}>Giao xong · thu COD</Button>}
                <a className={cx('inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2 py-1 text-[11.5px] text-ink-600 dark:border-ink-700 dark:text-ink-300')}
                  target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`}>
                  <Navigation size={12} /> Chỉ đường
                </a>
                {d.customer_phone && <a className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2 py-1 text-[11.5px] text-ink-600 dark:border-ink-700 dark:text-ink-300" href={`tel:${d.customer_phone}`}><Phone size={12} /> Gọi khách</a>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-3">
        <CardHeader title="Vị trí gần đây của đội xe" subtitle="Đọc từ driver_positions trên máy này" icon={<CircleDot size={16} />} />
        <div className="overflow-x-auto p-1">
          <table className="w-full text-[12px]">
            <thead className="text-left text-[11px] uppercase tracking-wide text-ink-400">
              <tr><th className="px-2 py-1.5">Tài xế</th><th className="px-2 py-1.5">Toạ độ</th><th className="px-2 py-1.5">Tuổi</th><th className="px-2 py-1.5">Nguồn</th></tr>
            </thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-ink-400">Chưa có điểm GPS nào</td></tr>}
              {recent.map((p) => {
                const age = gpsAgeMinutes(p)
                return (
                  <tr key={p.id} className="border-t border-ink-100 dark:border-ink-800">
                    <td className="px-2 py-1.5">#{p.driverId}</td>
                    <td className="px-2 py-1.5 font-mono">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</td>
                    <td className="px-2 py-1.5">{age < 1 ? 'vừa xong' : `${age} phút`}</td>
                    <td className="px-2 py-1.5">
                      <Badge tone={p.source === 'gps' ? 'green' : 'gray'}>{p.source === 'gps' ? 'GPS thật' : p.source}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
