/**
 * Link dùng chung: gửi 1 đường link là máy khác mở lên **dùng được ngay**
 * (không phải dán URL / anon key / mã đồng bộ bằng tay).
 *
 * Cách làm: nén cấu hình cloud vào chính link (sau dấu #, không gửi lên server).
 *  • Link "Chỉ xem"      → kèm mã CHỈ ĐỌC (RLS chặn mọi thao tác ghi) — an toàn để gửi cho khách/đối tác.
 *  • Link "Làm việc"     → kèm mã GHI được — gửi cho nhân viên/chi nhánh.
 */
import { clearCloudError, loadCloud, normCloudUrl, saveCloud, type CloudConfig } from './cloud'
import { isTursoUrl, loadTurso, saveTurso } from './turso'

export type ShareMode = 'ro' | 'rw'

export interface SharePayload {
  url: string
  key: string
  token: string
  mode: ShareMode
  /** Tên gợi nhớ: chuỗi/chi nhánh nào */
  label?: string
}

const enc = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const dec = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b + '==='.slice((b.length + 3) % 4)
  const bytes = Uint8Array.from(atob(pad), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeShare(p: SharePayload): string {
  return enc(JSON.stringify({ u: p.url, k: p.key, t: p.token, m: p.mode, l: p.label ?? '' }))
}

export function decodeShare(code: string): SharePayload | null {
  try {
    const raw = JSON.parse(dec(code)) as { u?: string; k?: string; t?: string; m?: string; l?: string }
    // Link Turso chỉ cần địa chỉ + token (cột t để trống)
    if (!raw.u || !raw.k) return null
    return { url: raw.u, key: raw.k, token: raw.t ?? '', mode: raw.m === 'rw' ? 'rw' : 'ro', label: raw.l }
  } catch { return null }
}

/** Link đầy đủ để copy/gửi (dạng https://…/Matcha/#/join?c=…). */
export function buildShareLink(p: SharePayload): string {
  const base = `${location.origin}${location.pathname}`
  return `${base}#/join?c=${encodeShare(p)}`
}

/** Tạo mã mới trên Postgres qua RPC create_share_token (cần máy đang có mã GHI). */
export async function mintShareToken(cfg: CloudConfig, label: string, canWrite: boolean): Promise<{ ok: boolean; token?: string; message?: string; url?: string; key?: string }> {
  // --- TURSO: link mang thẳng token Turso (ghi = token ghi, chỉ xem = token chỉ đọc) ---
  const t = loadTurso()
  if (t.enabled && t.url) {
    void label
    const token = canWrite ? t.tokenRw : t.tokenRo
    if (!token) {
      return {
        ok: false,
        message: canWrite
          ? 'Máy này không giữ token GHI nên không cấp được link làm việc. Dán token ghi ở khối “Đồng bộ Turso”.'
          : 'Chưa có token CHỈ ĐỌC trên máy. Tạo token read-only trong Turso rồi dán vào khối “Đồng bộ Turso”.',
      }
    }
    return { ok: true, token, url: t.url, key: token }
  }
  return mintSupabaseShareToken(cfg, label, canWrite)
}

/** Cấp mã chia sẻ qua Postgres (Supabase) — mỗi link 1 mã riêng, thu hồi được từng người. */
export async function mintSupabaseShareToken(cfg: CloudConfig, label: string, canWrite: boolean): Promise<{ ok: boolean; token?: string; message?: string }> {
  const url = normCloudUrl(cfg.url)
  if (!url || !cfg.key) return { ok: false, message: 'Chưa cấu hình cloud' }
  try {
    const res = await fetch(`${url}/rest/v1/rpc/create_share_token`, {
      method: 'POST',
      headers: {
        apikey: cfg.key.trim(),
        ...(cfg.key.trim().startsWith('eyJ') ? { Authorization: `Bearer ${cfg.key.trim()}` } : {}),
        'x-sync-token': (cfg.token ?? '').trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_label: label, p_can_write: canWrite }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const body = (await res.text()).slice(0, 160)
      if (res.status === 404) return { ok: false, message: 'Cloud chưa cập nhật rls.sql mới (thiếu hàm create_share_token) — chạy lại docs/sql/rls.sql.' }
      return { ok: false, message: `HTTP ${res.status} ${body}` }
    }
    const token = String(await res.json()).replace(/^"|"$/g, '')
    if (!/^mk_/.test(token)) return { ok: false, message: 'Cloud trả về mã không hợp lệ' }
    return { ok: true, token }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

/** Áp cấu hình từ link vào máy này (lưu localStorage, bật tự đồng bộ). */
export function applySharePayload(p: SharePayload) {
  if (isTursoUrl(p.url)) {
    // Link Turso: token nằm ở p.key; "làm việc" → token ghi, "chỉ xem" → token chỉ đọc
    saveTurso({
      url: p.url.trim(),
      tokenRw: p.mode === 'rw' ? p.key.trim() : '',
      tokenRo: p.mode === 'rw' ? (loadTurso().tokenRo ?? '') : p.key.trim(),
      enabled: true,
      lastSeq: 0,
      lastSync: null,
      lastRows: 0,
    })
    clearCloudError()
    return
  }
  const cfg = loadCloud()
  saveCloud({ ...cfg, url: p.url.trim(), key: p.key.trim(), token: p.token.trim(), autoSync: true, realtime: true })
  clearCloudError()
}

/** Lấy mã cấu hình từ URL hiện tại (nếu có). */
export function readShareFromLocation(): SharePayload | null {
  const hash = location.hash
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : location.search.replace(/^\?/, '')
  const c = new URLSearchParams(q).get('c')
  return c ? decodeShare(c) : null
}
