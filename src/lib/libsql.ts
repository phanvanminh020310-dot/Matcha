/**
 * Client libSQL HTTP (Turso) — chạy được cả trong Node và trong trình duyệt, KHÔNG cần thư viện ngoài.
 *
 * Dùng giao thức pipeline v2 của libSQL: POST {db}/v2/pipeline
 *   { requests: [ { type: 'execute', stmt: { sql, args: [{type,value}...] } }, …, { type: 'close' } ] }
 *
 * Vì sao tự viết thay vì dùng @libsql/client: gói chính thức kéo theo WASM/native vài MB,
 * app này cần bản nhẹ, chạy thẳng trên GitHub Pages.
 *
 * LƯU Ý BẢO MẬT: token nằm trong trình duyệt → chỉ dùng token CHỈ-ĐỌC cho link xem,
 * token ghi chỉ đặt trên máy của chủ chuỗi (giống hệt mã đồng bộ hiện nay).
 */

export type Arg = null | string | number | boolean

export interface LibsqlConfig {
  /** libsql://matcha-xxx.turso.io hoặc https://... */
  url: string
  /** JWT của Turso */
  token: string
}

export interface RowResult {
  columns: string[]
  rows: Arg[][]
  affected: number
}

const MAX_STMTS_PER_REQUEST = 40

/** libsql:// · turso:// → https:// , ws:// → wss:// (trình duyệt không mở được ws trần) */
export function toHttps(url: string): string {
  const u = (url ?? '').trim().replace(/\/+$/, '')
  if (/^(libsql|turso):\/\//i.test(u)) return u.replace(/^(libsql|turso):\/\//i, 'https://')
  if (/^wss?:\/\//i.test(u)) return u.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://')
  return u
}

function encodeArg(v: Arg): unknown {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v }
  }
  return { type: 'text', value: String(v) }
}

interface RawCell { type: string; value?: unknown; base64?: string }

function decodeCell(c: RawCell): Arg {
  switch (c?.type) {
    case 'null': return null
    case 'integer': return Number(c.value)
    case 'float': return Number(c.value)
    case 'text': return String(c.value ?? '')
    case 'blob': return c.base64 ?? ''
    default: return c?.value == null ? null : (c.value as Arg)
  }
}

export class Libsql {
  private cfg: LibsqlConfig
  constructor(cfg: LibsqlConfig) {
    this.cfg = { url: toHttps(cfg.url), token: (cfg.token ?? '').trim() }
  }

  private async pipeline(stmts: { sql: string; args?: Arg[] }[]): Promise<RowResult[]> {
    if (!stmts.length) return []
    const body = {
      requests: [
        ...stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: (s.args ?? []).map(encodeArg) } })),
        { type: 'close' },
      ],
    }
    const res = await fetch(`${this.cfg.url}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      const text = (await res.text()).slice(0, 200)
      throw new Error(`Turso HTTP ${res.status}: ${text}`)
    }
    const json = (await res.json()) as {
      results?: {
        type: string
        error?: { message?: string }
        response?: { result?: { cols: { name: string }[]; rows: RawCell[][]; affected_row_count?: number }; error?: { message?: string } }
      }[]
    }
    const out: RowResult[] = []
    for (const r of json.results ?? []) {
      if (r.type !== 'ok') {
        const msg = r.error?.message ?? r.response?.error?.message ?? 'Turso trả về lỗi'
        // Thông báo dễ hiểu cho người dùng cuối khi máy chỉ có token đọc
        throw new Error(/write operations are forbidden|read-only|readonly/i.test(msg)
          ? 'Máy này chỉ có quyền ĐỌC (token read-only) — Turso chặn thao tác ghi. Dùng link “Làm việc” để sửa dữ liệu.'
          : msg)
      }
      const result = r.response?.result
      if (!result) { out.push({ columns: [], rows: [], affected: 0 }); continue }
      out.push({
        columns: (result.cols ?? []).map((c) => c.name),
        rows: (result.rows ?? []).map((row) => row.map(decodeCell)),
        affected: result.affected_row_count ?? 0,
      })
    }
    return out
  }

  /** Chạy nhiều câu lệnh, tự chia lô để không vượt giới hạn 1 request. */
  async run(stmts: { sql: string; args?: Arg[] }[]): Promise<RowResult[]> {
    const out: RowResult[] = []
    for (let i = 0; i < stmts.length; i += MAX_STMTS_PER_REQUEST) {
      out.push(...(await this.pipeline(stmts.slice(i, i + MAX_STMTS_PER_REQUEST))))
    }
    return out
  }

  /** 1 câu lệnh, trả về các dòng. */
  async all(sql: string, args: Arg[] = []): Promise<RowResult> {
    const [r] = await this.pipeline([{ sql, args }])
    return r ?? { columns: [], rows: [], affected: 0 }
  }

  /** 1 giá trị đầu tiên. */
  async scalar(sql: string, args: Arg[] = []): Promise<Arg> {
    const r = await this.all(sql, args)
    return r.rows[0]?.[0] ?? null
  }

  /** Kiểm tra kết nối + quyền: đọc được không, ghi được không. */
  async check(): Promise<{ ok: boolean; canRead: boolean; canWrite: boolean; message?: string }> {
    try {
      await this.scalar('SELECT 1')
    } catch (e) {
      return { ok: false, canRead: false, canWrite: false, message: (e as Error).message }
    }
    let canWrite = false
    try {
      await this.run([
        { sql: 'CREATE TABLE IF NOT EXISTS _write_probe (id INTEGER PRIMARY KEY, at TEXT)' },
        { sql: "INSERT INTO _write_probe (at) VALUES (datetime('now'))" },
        { sql: "DELETE FROM _write_probe WHERE at = (SELECT max(at) FROM _write_probe)" },
      ])
      canWrite = true
    } catch { canWrite = false }
    return { ok: true, canRead: true, canWrite }
  }
}
