/** Định dạng tiền VND, ngày dd/MM/yyyy, giờ VN — dùng chung toàn app. */
export const TZ = 'Asia/Ho_Chi_Minh'

export function formatVND(n: number | null | undefined, opts: { compact?: boolean; sign?: boolean } = {}) {
  const v = Number(n ?? 0)
  if (opts.compact) {
    const abs = Math.abs(v)
    const sign = v < 0 ? '-' : opts.sign && v > 0 ? '+' : ''
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1).replace('.', ',')} tỷ`
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')} tr`
    if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}k`
  }
  const s = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v)
  return opts.sign && v > 0 ? `+${s} ₫` : `${s} ₫`
}

export function formatNumber(n: number | null | undefined, digits = 0) {
  const v = Number(n ?? 0)
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v)
}

export function formatPercent(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits).replace('.', ',')}%`
}

/** "2026-10-31 14:05:00" → Date hiểu đúng là giờ VN, bất kể TZ trình duyệt */
export function parseVN(s: string | null | undefined): Date | null {
  if (!s) return null
  const iso = s.includes('T') ? s : s.replace(' ', 'T')
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00+07:00` : `${iso}+07:00`)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  return s.slice(0, 10).split('-').reverse().join('/')
}

export function formatDateTime(s: string | null | undefined) {
  if (!s) return '—'
  return `${formatDate(s)} ${s.slice(11, 16)}`
}

export function formatTime(s: string | null | undefined) {
  return s ? s.slice(11, 16) : '—'
}

/** Bây giờ theo giờ VN, dạng "YYYY-MM-DD HH:mm:ss" */
export function nowVN(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}:${g('second')}`
}

export function todayVN() {
  return nowVN().slice(0, 10)
}

/** Cộng/trừ ngày trên chuỗi 'YYYY-MM-DD' (thuần lịch, không phụ thuộc múi giờ). */
export function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string) {
  const d1 = new Date(`${a.slice(0, 10)}T00:00:00Z`).getTime()
  const d2 = new Date(`${b.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((d2 - d1) / 86400000)
}

export function minutesSince(s: string | null | undefined) {
  const d = parseVN(s)
  if (!d) return 0
  const now = parseVN(nowVN())!
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000))
}

export function elapsedLabel(s: string | null | undefined) {
  const m = minutesSince(s)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  return `${h}h${String(m % 60).padStart(2, '0')}`
}

export const CHANNEL_LABEL: Record<string, string> = {
  dine_in: 'Tại quán',
  takeaway: 'Mang đi',
  delivery: 'Giao hàng',
}
export const SOURCE_LABEL: Record<string, string> = {
  pos: 'POS',
  grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood',
  website: 'Website',
  app: 'App',
}
export const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ pha chế',
  preparing: 'Đang pha chế',
  ready: 'Sẵn sàng',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  draft: 'Nháp',
  ordered: 'Đã đặt',
  received: 'Đã nhận',
  open: 'Đang mở',
  closed: 'Đã chốt',
}
export const METHOD_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  qr: 'Chuyển khoản / VietQR',
  card: 'Thẻ ngân hàng',
  momo: 'Ví MoMo',
  zalopay: 'ZaloPay',
  credit: 'Ghi nợ',
}
export const ROLE_LABEL: Record<string, string> = {
  owner: 'Chủ chuỗi',
  manager: 'Quản lý cửa hàng',
  cashier: 'Thu ngân',
  barista: 'Pha chế / Bếp',
  accountant: 'Kế toán / Kho',
}
export const TIER_LABEL: Record<string, { label: string; color: string; emoji: string }> = {
  bronze: { label: 'Đồng', color: 'bg-amber-100 text-amber-800', emoji: '🥉' },
  silver: { label: 'Bạc', color: 'bg-slate-100 text-slate-700', emoji: '🥈' },
  gold: { label: 'Vàng', color: 'bg-yellow-100 text-yellow-800', emoji: '🥇' },
  diamond: { label: 'Kim cương', color: 'bg-sky-100 text-sky-800', emoji: '💎' },
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/** Bỏ dấu tiếng Việt để tìm kiếm không dấu */
export function normalize(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\ufeff' + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCSV(rows: Record<string, unknown>[], headers?: string[]) {
  if (!rows.length) return ''
  const cols = headers ?? Object.keys(rows[0])
  const head = cols.join(',')
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(',')).join('\n')
  return `${head}\n${body}`
}
