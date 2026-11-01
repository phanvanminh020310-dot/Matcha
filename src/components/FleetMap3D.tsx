/**
 * Bản đồ 3D trực tiếp cho điều phối giao hàng (MapLibre GL + vector tiles).
 *  • Nghiêng 60°, xoay, zoom, toà nhà đổ khối 3D, sương chân trời (fog).
 *  • Shipper di chuyển mượt trên tuyến OSRM thật, có hướng lái, vệt đã đi,
 *    vòng pulse tại điểm đến, bám theo xe (follow), play/pause, đổi tốc độ.
 *  • Không cần API key. Nếu mạng chặn vector tiles → tự chuyển nền raster OSM.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite không tự copy worker của MapLibre khi build → nạp tường minh để bản deploy chạy được
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Crosshair, Layers, Locate, Minus, Navigation2, Pause, Play, Plus, RotateCw, Square, TriangleAlert } from 'lucide-react'
import { mapStyle3D, mapStyleRaster } from '../lib/mapStyle'
import { pointAlong, type LatLng, type RouteResult } from '../lib/geo'
import { cx, formatVND } from '../lib/format'

// MapLibre chạy phần dựng tile trong Web Worker; trỏ đúng URL của worker đã bundle.
try { (maplibregl as unknown as { setWorkerUrl?: (u: string) => void }).setWorkerUrl?.(maplibreWorkerUrl) } catch { /* trình duyệt cũ */ }

export interface FleetShipment {
  id: number
  code: string
  status: string
  statusLabel: string
  color: string
  customerName?: string | null
  address?: string | null
  lat: number
  lng: number
  shipperName?: string | null
  phone?: string | null
  amount?: number
  route?: RouteResult | null
}

const svg = {
  store: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2" fill="#fff" stroke="none"/></svg>',
  bike: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17" r="3.2"/><circle cx="18.5" cy="17" r="3.2"/><path d="M8.5 17h5l2.5-6h-4"/><path d="M12 11l3-4h3"/></svg>',
}

const el = (html: string, cls = '') => {
  const d = document.createElement('div')
  d.className = cls
  d.innerHTML = html
  return d
}

function vehicleElement(s: FleetShipment) {
  const wrap = el(`
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%)">
      <div class="m3d-ring" style="position:absolute;top:-6px;width:46px;height:46px;border-radius:50%;border:2px solid ${s.color};opacity:.55;animation:m3dPulse 2.2s ease-out infinite"></div>
      <div class="m3d-body" style="width:38px;height:38px;border-radius:14px;background:linear-gradient(160deg,${s.color},${s.color}cc);display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.92);box-shadow:0 8px 20px rgba(0,0,0,.45)">
        <span class="m3d-arrow" style="display:flex;transform:rotate(0deg)">${svg.bike}</span>
      </div>
      <div style="margin-top:5px;padding:2px 7px;border-radius:999px;background:rgba(6,12,20,.88);color:#e8f2ff;font:600 10.5px/1.4 'Be Vietnam Pro',system-ui;white-space:nowrap;border:1px solid rgba(255,255,255,.16)">${s.shipperName ?? 'Tài xế'} · ${s.code}</div>
    </div>`)
  return wrap
}

function destinationElement(s: FleetShipment) {
  return el(`
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%)">
      <div style="padding:3px 8px;border-radius:999px;background:rgba(6,12,20,.9);color:#fff;font:600 10.5px/1.4 'Be Vietnam Pro',system-ui;border:1px solid ${s.color}66;margin-bottom:5px;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis">${s.customerName ?? 'Khách'}</div>
      <div style="width:30px;height:30px;border-radius:50% 50% 50% 6px;transform:rotate(45deg);background:${s.color};display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,.4)">
        <span style="transform:rotate(-45deg);display:flex">${svg.pin}</span>
      </div>
      <div style="width:2px;height:10px;background:${s.color}"></div>
    </div>`)
}

export function FleetMap3D({
  origin, shipments, selectedId, onSelect, height = 560, className = '',
}: {
  origin: LatLng & { label?: string }
  shipments: FleetShipment[]
  selectedId: number | null
  onSelect: (id: number) => void
  height?: number
  className?: string
}) {
  const holder = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const markers = useRef<Map<string, Marker>>(new Map())
  const progress = useRef<Record<number, number>>({})
  const raf = useRef<number>(0)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [pitch3d, setPitch3d] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [follow, setFollow] = useState(true)
  const [speedMul, setSpeedMul] = useState(1)
  const [zoomRatio, setZoomRatio] = useState(1)

  const selected = shipments.find((s) => s.id === selectedId) ?? shipments[0]

  // route GeoJSON: tuyến đầy đủ (mờ) + phần đã đi (sáng) + điểm đến
  const routesGeoJson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: shipments.filter((s) => s.route && s.route.geometry.length > 1).map((s) => ({
      type: 'Feature' as const,
      properties: { id: s.id, color: s.color, selected: s.id === selected?.id ? 1 : 0 },
      geometry: { type: 'LineString' as const, coordinates: s.route!.geometry.map(([lat, lng]) => [lng, lat]) },
    })),
  }), [shipments, selected?.id])

  useEffect(() => {
    if (!holder.current || map.current) return
    const m = new maplibregl.Map({
      container: holder.current,
      style: mapStyle3D(true),
      center: [origin.lng, origin.lat],
      zoom: 14.6,
      pitch: 55,
      bearing: -22,
      maxPitch: 78,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    })
    map.current = m
    ;(window as unknown as { __map3d?: unknown }).__map3d = m // chỉ để kiểm thử tự động
    m.on('load', () => {
      m.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'route-casing', type: 'line', source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#04080e', 'line-width': ['case', ['==', ['get', 'selected'], 1], 11, 7], 'line-opacity': 0.85 },
      })
      m.addLayer({
        id: 'route-line', type: 'line', source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 6, 3.4],
          'line-opacity': ['case', ['==', ['get', 'selected'], 1], 0.95, 0.6],
        },
      })
      m.addSource('traveled', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'traveled-glow', type: 'line', source: 'traveled',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#7dd3fc', 'line-width': 10, 'line-opacity': 0.18, 'line-blur': 4 },
      })
      m.addLayer({
        id: 'traveled', type: 'line', source: 'traveled',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#e2f4ff', 'line-width': 3.2, 'line-opacity': 0.95 },
      })
      // "dòng chảy" trên tuyến đang chọn
      m.addLayer({
        id: 'route-flow', type: 'line', source: 'routes',
        filter: ['==', ['get', 'selected'], 1],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 2.2, 'line-opacity': 0.85, 'line-dasharray': [0, 3, 2] },
      })
      try {
        // sương chân trời giúp khối 3D trông có chiều sâu (MapLibre 5+)
        ;(m as unknown as { setFog?: (f: unknown) => void }).setFog?.({
          color: '#0a1220', 'high-color': '#0d1a2b', 'horizon-blend': 0.2, 'space-color': '#05090f', 'star-intensity': 0.03,
        })
      } catch { /* bản không hỗ trợ fog */ }
      setReady(true)
      m.addSource('pulse', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'pulse', type: 'circle', source: 'pulse',
        paint: {
          'circle-radius': ['get', 'r'], 'circle-color': ['get', 'color'],
          'circle-opacity': ['get', 'o'], 'circle-stroke-width': 1.5, 'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.5,
        },
      })
    })
    m.on('error', (ev: unknown) => {
      const msg = String((ev as { error?: Error })?.error?.message ?? '')
      if (/Failed to fetch|NetworkError|tiles/i.test(msg) && !fallback) {
        setFallback(true)
        m.setStyle(mapStyleRaster())
      }
    })
    return () => { cancelAnimationFrame(raf.current); m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // cập nhật tuyến
  useEffect(() => {
    if (!ready) return
    const src = map.current?.getSource('routes') as GeoJSONSource | undefined
    src?.setData(routesGeoJson as never)
  }, [ready, routesGeoJson])

  // vòng lặp mô phỏng
  useEffect(() => {
    if (!ready || !map.current) return
    let last = performance.now()
    let dash = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const m = map.current
      if (!m) return
      dash += dt * 26
      if (m.getLayer('route-flow')) m.setPaintProperty('route-flow', 'line-dasharray', [0, 3, 2, dash % 60])

      const pulseFeatures: unknown[] = []
      shipments.forEach((s) => {
        if (!s.route || s.route.geometry.length < 2) return
        const key = s.id
        if (progress.current[key] === undefined) {
          // rải pha ban đầu để đội xe trông "đang chạy" chứ không trùng nhau
          progress.current[key] = ((key * 37) % 100) / 100
        }
        const dur = Math.max(20, s.route.durationMin * 60) // giây thật theo OSRM
        const step = (dt / dur) * speedMul * 18 // tua nhanh 18× cho dễ quan sát
        if (playing) progress.current[key] = Math.min(1, progress.current[key] + step)
        const p = progress.current[key]
        const pos = pointAlong(s.route.geometry, p)
        const ahead = pointAlong(s.route.geometry, Math.min(1, p + 0.004))
        const bearing = (Math.atan2(ahead.lng - pos.lng, ahead.lat - pos.lat) * 180) / Math.PI

        const mk = markers.current.get(`v${key}`)
        if (mk) {
          mk.setLngLat([pos.lng, pos.lat])
          const arrow = mk.getElement().querySelector<HTMLElement>('.m3d-arrow')
          if (arrow) arrow.style.transform = `rotate(${bearing}deg)`
        }
        if (s.id === (selected?.id ?? -1)) {
          const traveled = []
          for (let i = 0; i <= 1.0001; i += 0.02) {
            const q = pointAlong(s.route.geometry, Math.min(1, p * i))
            traveled.push([q.lng, q.lat])
          }
          ;(m.getSource('traveled') as GeoJSONSource | undefined)?.setData({
            type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: traveled },
          } as never)
          if (follow) m.easeTo({ center: [pos.lng, pos.lat], duration: 380, essential: true })
        }
        pulseFeatures.push({
          type: 'Feature', properties: { r: 6 + 26 * (p % 1), o: 0.35 * (1 - (p % 1)), color: s.color },
          geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        })
        if (p >= 1 && playing) progress.current[key] = 0
      })
      ;(m.getSource('pulse') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pulseFeatures } as never)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [ready, shipments, playing, speedMul, follow, selected?.id])

  // marker
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const alive = new Set<string>()
    const add = (key: string, lng: number, lat: number, node: HTMLElement, onClick?: () => void) => {
      alive.add(key)
      const existing = markers.current.get(key)
      if (existing) { existing.setLngLat([lng, lat]); return }
      if (onClick) node.style.cursor = 'pointer'
      if (onClick) node.addEventListener('click', onClick)
      markers.current.set(key, new maplibregl.Marker({ element: node, anchor: 'center' }).setLngLat([lng, lat]).addTo(m))
    }
    add('origin', origin.lng, origin.lat, el(`
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%)">
        <div style="width:42px;height:42px;border-radius:15px;background:linear-gradient(160deg,#16a34a,#0f7a37);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 10px 24px rgba(16,163,74,.55)">${svg.store}</div>
        <div style="margin-top:5px;padding:2px 8px;border-radius:999px;background:rgba(6,12,20,.9);color:#d7f7e3;font:600 10.5px/1.4 'Be Vietnam Pro',system-ui;border:1px solid rgba(22,163,74,.5);white-space:nowrap">Kho xuất phát</div>
      </div>`))

    shipments.forEach((s) => {
      add(`d${s.id}`, s.lng, s.lat, destinationElement(s), () => onSelect(s.id))
      add(`v${s.id}`, s.lng, s.lat, vehicleElement(s), () => onSelect(s.id))
    })

    markers.current.forEach((mk, key) => {
      if (!alive.has(key)) { mk.remove(); markers.current.delete(key) }
    })
  }, [ready, shipments, origin.lat, origin.lng, onSelect])

  // fly tới xe đang chọn
  useEffect(() => {
    if (!ready || !selected || !map.current) return
    const p = progress.current[selected.id] ?? 0
    if (!selected.route) { map.current.easeTo({ center: [selected.lng, selected.lat], duration: 700 }); return }
    const pos = pointAlong(selected.route.geometry, p)
    map.current.easeTo({ center: [pos.lng, pos.lat], duration: 700, ...(pitch3d ? { pitch: 55 } : { pitch: 0 }), essential: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, ready])

  const fitted = useRef(false)
  useEffect(() => {
    const m = map.current
    if (!ready || fitted.current) return
    const s = shipments.find((x) => x.route)
    if (!m || !s?.route) return
    const lngs = s.route.geometry.map(([, lng]) => lng)
    const lats = s.route.geometry.map(([lat]) => lat)
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
      padding: { top: 110, bottom: 120, left: 120, right: 260 }, pitch: 58, duration: 1400,
    })
    fitted.current = true
  }, [ready, shipments])

  const zoomBy = (d: number) => {
    const m = map.current
    if (!m) return
    m.easeTo({ zoom: Math.max(10, Math.min(19, m.getZoom() + d)), duration: 300 })
  }
  const rotateBy = (d: number) => map.current?.easeTo({ bearing: (map.current.getBearing() ?? 0) + d, duration: 400 })
  const toggle3d = () => {
    const next = !pitch3d
    setPitch3d(next)
    map.current?.easeTo({ pitch: next ? 55 : 0, duration: 700 })
  }
  const recenter = () => {
    if (!map.current) return
    map.current.easeTo({ center: [origin.lng, origin.lat], zoom: 14.2, pitch: pitch3d ? 55 : 0, bearing: -22, duration: 900 })
    setZoomRatio(1)
  }
  const zoomToRoute = () => {
    const m = map.current
    if (!m || !selected?.route) return
    const lngs = selected.route.geometry.map(([, lng]) => lng)
    const lats = selected.route.geometry.map(([lat]) => lat)
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
      padding: { top: 90, bottom: 90, left: 90, right: 90 }, pitch: pitch3d ? 55 : 0, duration: 900,
    })
    setZoomRatio(1.35)
  }

  const remain = selected?.route
    ? Math.max(0, selected.route.distanceKm * (1 - (progress.current[selected.id] ?? 0)))
    : 0
  const eta = selected?.route
    ? Math.max(1, Math.round(selected.route.durationMin * (1 - (progress.current[selected.id] ?? 0))))
    : 0

  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-ink-700/60 bg-[#070d14]', className)} style={{ height }}>
      <style>{`@keyframes m3dPulse{0%{transform:scale(.6);opacity:.65}70%{transform:scale(1.35);opacity:0}100%{opacity:0}}
      .maplibregl-ctrl-attrib{background:rgba(8,14,22,.72)!important;color:#9fb4cb!important;font-size:10px!important}
      .maplibregl-ctrl-attrib a{color:#cfe3f7!important}`}</style>
      <div ref={holder} className="absolute inset-0" />

      {/* HUD trên */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a1220]/85 px-2.5 py-1.5 backdrop-blur">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> LIVE 3D
          </span>
          <span className="text-[11px] text-slate-400">|</span>
          <span className="text-[11px] text-slate-300">{shipments.length} xe đang chạy</span>
          {fallback && <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">nền 2D dự phòng</span>}
        </div>
        {selected && (
          <div className="pointer-events-auto w-[260px] rounded-xl border border-white/10 bg-[#0a1220]/88 p-2.5 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] text-slate-400">{selected.code}</span>
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${selected.color}22`, color: selected.color }}>{selected.statusLabel}</span>
            </div>
            <p className="mt-1 truncate text-[12.5px] font-semibold text-white">{selected.customerName ?? 'Khách lẻ'}</p>
            <p className="truncate text-[11px] text-slate-400">{selected.address}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg bg-white/5 py-1">
                <p className="text-[9.5px] uppercase tracking-wide text-slate-500">Còn</p>
                <p className="text-[12px] font-semibold text-white">{remain.toFixed(1)} km</p>
              </div>
              <div className="rounded-lg bg-white/5 py-1">
                <p className="text-[9.5px] uppercase tracking-wide text-slate-500">ETA</p>
                <p className="text-[12px] font-semibold text-white">{eta} ph</p>
              </div>
              <div className="rounded-lg bg-white/5 py-1">
                <p className="text-[9.5px] uppercase tracking-wide text-slate-500">Thu hộ</p>
                <p className="text-[12px] font-semibold text-white">{formatVND(selected.amount ?? 0, { compact: true })}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-300">
              <Navigation2 size={12} className="text-sky-400" /> {selected.shipperName ?? 'Chưa gán tài xế'}
              {selected.phone && <span className="text-slate-500">· {selected.phone}</span>}
            </div>
          </div>
        )}
      </div>

      {/* điều khiển */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        {[
          { icon: <Plus size={15} />, label: 'Phóng to', onClick: () => zoomBy(0.8) },
          { icon: <Minus size={15} />, label: 'Thu nhỏ', onClick: () => zoomBy(-0.8) },
          { icon: <RotateCw size={15} />, label: 'Xoay phải', onClick: () => rotateBy(35) },
          { icon: <Crosshair size={15} />, label: 'Về kho', onClick: recenter },
          { icon: <Locate size={15} />, label: 'Xem toàn tuyến', onClick: zoomToRoute },
        ].map((b) => (
          <button key={b.label} title={b.label} onClick={b.onClick}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[#0a1220]/85 text-slate-200 backdrop-blur transition hover:bg-[#12253c]">
            {b.icon}
          </button>
        ))}
      </div>

      {/* thanh dưới */}
      <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0a1220]/88 px-2.5 py-2 backdrop-blur">
        <button onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-emerald-400">
          {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Tạm dừng' : 'Chạy tiếp'}
        </button>
        <button onClick={toggle3d}
          className="flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1.5 text-[11.5px] text-slate-200 transition hover:bg-white/10">
          {pitch3d ? <Square size={13} /> : <Layers size={13} />} {pitch3d ? 'Xem 2D' : 'Xem 3D'}
        </button>
        <button onClick={() => setFollow((f) => !f)}
          className={cx('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition',
            follow ? 'border-sky-400/50 bg-sky-500/20 text-sky-200' : 'border-white/12 text-slate-200 hover:bg-white/10')}>
          <Navigation2 size={13} /> Bám xe
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-white/12 px-1 py-0.5">
          {[0.5, 1, 2, 4].map((s) => (
            <button key={s} onClick={() => setSpeedMul(s)}
              className={cx('rounded px-1.5 py-1 text-[10.5px] transition', speedMul === s ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white')}>
              {s}×
            </button>
          ))}
        </div>
        <span className="ml-auto hidden text-[10px] leading-tight text-slate-500 sm:block">
          MapLibre GL · OpenFreeMap · © OpenMapTiles · dữ liệu © OpenStreetMap · tuyến OSRM
        </span>
        {!ready && <span className="text-[10.5px] text-amber-300"><TriangleAlert size={11} className="inline" /> đang tải bản đồ…</span>}
      </div>
    </div>
  )
}
