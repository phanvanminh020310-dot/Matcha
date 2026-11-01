/**
 * Định vị & chỉ đường THẬT — không cần API key:
 *  • Geocode / gợi ý địa chỉ: Nominatim (OpenStreetMap)
 *  • Chỉ đường + khoảng cách + thời gian: OSRM (router.project-osrm.org)
 *  • Bản đồ nền: tile OpenStreetMap (xem components/MapView.tsx)
 * Có cache + fallback nội bộ để app vẫn tính được phí ship khi offline.
 */

export const BRANCH_GEO: Record<number, { lat: number; lng: number; label: string }> = {
  1: { lat: 10.77564, lng: 106.70207, label: 'Matcha House Quận 1 — 42 Nguyễn Huệ' },
  2: { lat: 10.78001, lng: 106.69191, label: 'Matcha House Quận 3 — 189 Võ Văn Tần' },
  3: { lat: 21.01667, lng: 105.79891, label: 'Matcha House Cầu Giấy — 68 Trần Duy Hưng' },
}

/** Điểm giao mẫu quanh TP.HCM / Hà Nội (dùng khi offline hoặc để seed) */
export const DEMO_PLACES = [
  { address: 'Vincom Center Đồng Khởi, 72 Lê Thánh Tôn, Quận 1', district: 'Quận 1', lat: 10.77793, lng: 106.70183 },
  { address: 'Bitexco Financial Tower, 2 Hải Triều, Quận 1', district: 'Quận 1', lat: 10.77186, lng: 106.70435 },
  { address: 'Chợ Bến Thành, Lê Lợi, Quận 1', district: 'Quận 1', lat: 10.77238, lng: 106.69803 },
  { address: 'Dinh Độc Lập, 135 Nam Kỳ Khởi Nghĩa, Quận 1', district: 'Quận 1', lat: 10.77722, lng: 106.69583 },
  { address: 'Nhà thờ Đức Bà, 01 Công xã Paris, Quận 1', district: 'Quận 1', lat: 10.77972, lng: 106.69919 },
  { address: 'Landmark 81, 720A Điện Biên Phủ, Bình Thạnh', district: 'Bình Thạnh', lat: 10.79514, lng: 106.72176 },
  { address: 'Saigon Centre, 65 Lê Lợi, Quận 1', district: 'Quận 1', lat: 10.77311, lng: 106.70113 },
  { address: 'Nowzone, 235 Nguyễn Văn Cừ, Quận 1', district: 'Quận 1', lat: 10.76173, lng: 106.68283 },
  { address: 'Vạn Hạnh Mall, 11 Sư Vạn Hạnh, Quận 10', district: 'Quận 10', lat: 10.77033, lng: 106.66956 },
  { address: 'Aeon Mall Tân Phú, 30 Bờ Bao Tân Thắng, Tân Phú', district: 'Tân Phú', lat: 10.80123, lng: 106.61741 },
  { address: 'Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội', district: 'Nam Từ Liêm', lat: 21.01754, lng: 105.78383 },
  { address: 'Lotte Center, 54 Liễu Giai, Ba Đình, Hà Nội', district: 'Ba Đình', lat: 21.03135, lng: 105.81319 },
]

export type LatLng = { lat: number; lng: number }

/** Khoảng cách đường chim bay (km) */
export function haversine(a: LatLng, b: LatLng) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface RouteResult {
  distanceKm: number
  durationMin: number
  geometry: [number, number][] // [lat, lng]
  source: 'osrm' | 'estimate'
}

const routeCache = new Map<string, RouteResult>()

/** Tuyến đường thật qua OSRM; tự fallback sang ước lượng nếu offline. */
export async function route(from: LatLng, to: LatLng): Promise<RouteResult> {
  const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}`
  const hit = routeCache.get(key)
  if (hit) return hit
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json()
    const r = data.routes?.[0]
    if (!r) throw new Error('Không có tuyến')
    const result: RouteResult = {
      distanceKm: Math.round((r.distance / 1000) * 10) / 10,
      durationMin: Math.max(1, Math.round(r.duration / 60)),
      geometry: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]),
      source: 'osrm',
    }
    routeCache.set(key, result)
    return result
  } catch {
    const d = haversine(from, to) * 1.35 // hệ số đường vòng đô thị
    const result: RouteResult = {
      distanceKm: Math.round(d * 10) / 10,
      durationMin: Math.max(3, Math.round((d / 22) * 60 + 6)),
      geometry: [[from.lat, from.lng], [to.lat, to.lng]],
      source: 'estimate',
    }
    routeCache.set(key, result)
    return result
  }
}

/** Bảng phí giao hàng theo khoảng cách (cấu hình được, mặc định giống các app F&B VN). */
export const DELIVERY_FEE_TIERS = [
  { maxKm: 2, fee: 12000 },
  { maxKm: 4, fee: 18000 },
  { maxKm: 6, fee: 25000 },
  { maxKm: 9, fee: 32000 },
  { maxKm: 99, fee: 45000 },
]

export function deliveryFeeFor(distanceKm: number) {
  const tier = DELIVERY_FEE_TIERS.find((t) => distanceKm <= t.maxKm)
  return tier ? tier.fee : 45000
}

export interface GeoPlace { display: string; lat: number; lng: number; district?: string }

const geoCache = new Map<string, GeoPlace[]>()

/** Gợi ý địa chỉ thật bằng Nominatim (kèm fallback điểm mẫu). */
export async function searchAddress(q: string): Promise<GeoPlace[]> {
  const query = q.trim()
  if (query.length < 3) return []
  const hit = geoCache.get(query.toLowerCase())
  if (hit) return hit
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=vi&q=${encodeURIComponent(`${query}, Việt Nam`)}`
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    const data = (await res.json()) as { display_name: string; lat: string; lon: string; address?: Record<string, string> }[]
    const places: GeoPlace[] = data.map((d) => ({
      display: d.display_name,
      lat: Number(d.lat),
      lng: Number(d.lon),
      district: d.address?.city_district ?? d.address?.suburb ?? d.address?.county,
    }))
    geoCache.set(query.toLowerCase(), places)
    return places
  } catch {
    const low = query.toLowerCase()
    const local = DEMO_PLACES.filter((p) => p.address.toLowerCase().includes(low) || (p.district ?? '').toLowerCase().includes(low))
      .map((p) => ({ display: p.address, lat: p.lat, lng: p.lng, district: p.district }))
    geoCache.set(query.toLowerCase(), local)
    return local
  }
}

/** Điểm trên tuyến theo % tiến trình (dùng cho mô phỏng shipper chạy thật trên tuyến OSRM). */
export function pointAlong(geometry: [number, number][], progress: number): LatLng {
  if (geometry.length === 0) return { lat: 0, lng: 0 }
  if (geometry.length === 1) return { lat: geometry[0][0], lng: geometry[0][1] }
  const clamped = Math.min(1, Math.max(0, progress))
  const target = clamped * (geometry.length - 1)
  const i = Math.floor(target)
  const frac = target - i
  const a = geometry[i]
  const b = geometry[Math.min(geometry.length - 1, i + 1)]
  return { lat: a[0] + (b[0] - a[0]) * frac, lng: a[1] + (b[1] - a[1]) * frac }
}

/** Bearing (hướng di chuyển) để xoay icon shipper. */
export function bearing(a: LatLng, b: LatLng) {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180) / Math.PI
}
