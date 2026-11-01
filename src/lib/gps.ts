/**
 * GPS THẬT cho tài xế.
 *  • Máy tài xế lấy toạ độ từ `navigator.geolocation` (watchPosition, high accuracy)
 *  • Ghi vào bảng `driver_positions` — cả trên máy (SQLite) và trên Postgres (Supabase)
 *    để máy điều phối ở chi nhánh thấy vị trí ngay, không phải chờ đồng bộ cả gói.
 *  • Máy điều phối đọc lại vị trí mới nhất (poll 5 giây) → bản đồ 3D hiển thị xe thật.
 */
import { all, persist, run } from './db'
import { loadCloud, normCloudUrl } from './cloud'

export interface GpsPoint {
  id: number
  driverId: number
  deliveryId: number | null
  lat: number
  lng: number
  heading: number | null
  speedKmh: number | null
  accuracy: number | null
  source: 'gps' | 'manual' | 'sim'
  recordedAt: string
}

const pad = (n: number) => String(n).padStart(2, '0')
export const vnNow = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

/** Quãng đường (m) giữa 2 toạ độ — dùng để lọc điểm trùng. */
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Ghi 1 điểm GPS vào CSDL trên máy. */
export function saveLocalPoint(p: Omit<GpsPoint, 'id' | 'recordedAt'> & { recordedAt?: string }) {
  const at = p.recordedAt ?? vnNow()
  const id = Date.now()
  run(
    `INSERT INTO driver_positions (id, driver_id, delivery_id, lat, lng, heading, speed_kmh, accuracy, source, recorded_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, p.driverId, p.deliveryId ?? null, p.lat, p.lng, p.heading ?? null, p.speedKmh ?? null, p.accuracy ?? null, p.source, at],
  )
  persist()
  return id
}

/** Đẩy thẳng điểm GPS lên Postgres để máy khác thấy ngay (không cần push cả gói 60k dòng). */
export async function pushPointToCloud(p: Omit<GpsPoint, 'id' | 'recordedAt'> & { recordedAt?: string; id?: number }) {
  const cfg = loadCloud()
  const url = normCloudUrl(cfg.url)
  if (!url || !cfg.key) return { ok: false, skipped: true, message: 'Chưa cấu hình cloud' }
  const id = p.id ?? Date.now()
  const row = {
    id, driver_id: p.driverId, delivery_id: p.deliveryId ?? null,
    lat: p.lat, lng: p.lng, heading: p.heading ?? null, speed_kmh: p.speedKmh ?? null,
    accuracy: p.accuracy ?? null, source: p.source, recorded_at: p.recordedAt ?? vnNow(),
  }
  try {
    const res = await fetch(`${url}/rest/v1/driver_positions`, {
      method: 'POST',
      headers: {
        apikey: cfg.key.trim(),
        ...(cfg.key.trim().startsWith('eyJ') ? { Authorization: `Bearer ${cfg.key.trim()}` } : {}),
        ...(cfg.token ? { 'x-sync-token': cfg.token.trim() } : {}),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { ok: false, message: `HTTP ${res.status} ${(await res.text()).slice(0, 120)}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

/** Vị trí mới nhất của từng tài xế (trong vòng `maxAgeMin` phút) — đọc từ máy. */
export function latestLocalPositions(maxAgeMin = 30): Record<number, GpsPoint> {
  const rows = all<Record<string, unknown>>(
    `SELECT * FROM driver_positions WHERE recorded_at >= datetime('now', ?) ORDER BY recorded_at DESC LIMIT 500`,
    [`-${Math.round(maxAgeMin * 60)} seconds`],
  )
  const out: Record<number, GpsPoint> = {}
  for (const r of rows) {
    const driverId = Number(r.driver_id)
    if (out[driverId]) continue
    out[driverId] = {
      id: Number(r.id), driverId, deliveryId: r.delivery_id === null ? null : Number(r.delivery_id),
      lat: Number(r.lat), lng: Number(r.lng),
      heading: r.heading === null ? null : Number(r.heading), speedKmh: r.speed_kmh === null ? null : Number(r.speed_kmh),
      accuracy: r.accuracy === null ? null : Number(r.accuracy),
      source: (r.source as GpsPoint['source']) ?? 'gps', recordedAt: String(r.recorded_at),
    }
  }
  return out
}

/**
 * Đọc vị trí mới nhất từ Postgres (dùng cho máy điều phối ở chi nhánh khác).
 * Trả về null nếu chưa cấu hình cloud.
 */
export async function fetchRemotePositions(sinceMinutes = 30): Promise<Record<number, GpsPoint> | null> {
  const cfg = loadCloud()
  const url = normCloudUrl(cfg.url)
  if (!url || !cfg.key) return null
  const since = new Date(Date.now() + 7 * 3600 * 1000 - sinceMinutes * 60000).toISOString().slice(0, 19).replace('T', ' ')
  try {
    const res = await fetch(`${url}/rest/v1/driver_positions?select=*&recorded_at=gte.${encodeURIComponent(since)}&order=recorded_at.desc&limit=300`, {
      headers: {
        apikey: cfg.key.trim(),
        ...(cfg.key.trim().startsWith('eyJ') ? { Authorization: `Bearer ${cfg.key.trim()}` } : {}),
        ...(cfg.token ? { 'x-sync-token': cfg.token.trim() } : {}),
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Record<string, unknown>[]
    const out: Record<number, GpsPoint> = {}
    for (const r of rows) {
      const driverId = Number(r.driver_id)
      if (out[driverId]) continue
      out[driverId] = {
        id: Number(r.id), driverId, deliveryId: r.delivery_id === null ? null : Number(r.delivery_id),
        lat: Number(r.lat), lng: Number(r.lng),
        heading: r.heading === null ? null : Number(r.heading), speedKmh: r.speed_kmh === null ? null : Number(r.speed_kmh),
        accuracy: r.accuracy === null ? null : Number(r.accuracy),
        source: (r.source as GpsPoint['source']) ?? 'gps', recordedAt: String(r.recorded_at),
      }
    }
    return out
  } catch { return null }
}

/** Vị trí cũ hơn bao nhiêu phút thì coi như tài xế offline. */
export const GPS_FRESH_MINUTES = 5

export function gpsAgeMinutes(p: GpsPoint): number {
  // recorded_at lưu theo giờ VN (UTC+7) → quy về UTC để so với đồng hồ máy
  const t = new Date(`${p.recordedAt.replace(' ', 'T')}Z`).getTime() - 7 * 3600 * 1000
  return Math.max(0, Math.round((Date.now() - t) / 60000))
}
