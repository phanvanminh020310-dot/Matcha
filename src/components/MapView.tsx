import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '../lib/geo'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  label?: string
  kind?: 'branch' | 'customer' | 'shipper'
  popup?: string
}

const SVG = {
  store: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4" fill="#fff" stroke="none"/></svg>',
  bike: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17" r="3.2"/><circle cx="18.5" cy="17" r="3.2"/><path d="M8.5 17h5l2.5-6h-4"/><path d="M12 11l3-4h3"/></svg>',
}

const ICONS: Record<string, string> = {
  branch: `<div style="width:36px;height:36px;border-radius:13px;background:#16a34a;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(22,163,74,.45);border:2px solid #fff">${SVG.store}</div>`,
  customer: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 5px;transform:rotate(45deg);background:#fb7f14;box-shadow:0 4px 12px rgba(251,127,20,.45);display:flex;align-items:center;justify-content:center;border:2px solid #fff"><span style="transform:rotate(-45deg);display:flex">${SVG.pin}</span></div>`,
  shipper: `<div style="width:36px;height:36px;border-radius:50%;background:#0ea5e9;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(14,165,233,.25),0 4px 12px rgba(14,165,233,.4);border:2px solid #fff">${SVG.bike}</div>`,
}

const icon = (kind: string) =>
  L.divIcon({ html: ICONS[kind] ?? ICONS.customer, className: '', iconSize: [34, 34], iconAnchor: [17, 17] })

/** Bản đồ OpenStreetMap thật (không cần API key), có tuyến đường + marker + fit bounds. */
export function MapView({
  center, markers = [], route, height = 320, zoom = 14, className = '',
}: {
  center?: LatLng
  markers?: MapMarker[]
  route?: [number, number][]
  height?: number
  zoom?: number
  className?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const routeRef = useRef<L.Polyline | null>(null)

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return
    const map = L.map(boxRef.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    const start = center ?? { lat: 10.77564, lng: 106.70207 }
    map.setView([start.lat, start.lng], zoom)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 150)
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markers.forEach((m) => {
      const mk = L.marker([m.lat, m.lng], { icon: icon(m.kind ?? 'customer'), title: m.label })
      if (m.popup ?? m.label) mk.bindPopup(m.popup ?? m.label ?? '')
      mk.addTo(layer)
    })
    if (markers.length > 1) {
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [38, 38], maxZoom: 15 })
    } else if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15)
    } else if (center) {
      map.setView([center.lat, center.lng], zoom)
    }
  }, [markers, center, zoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (routeRef.current) { routeRef.current.remove(); routeRef.current = null }
    if (route && route.length > 1) {
      routeRef.current = L.polyline(route, { color: '#16a34a', weight: 5, opacity: 0.85, lineCap: 'round' }).addTo(map)
    }
  }, [route])

  return <div ref={boxRef} className={`z-0 rounded-2xl border border-ink-200 dark:border-ink-700 ${className}`} style={{ height }} />
}
