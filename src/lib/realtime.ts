/**
 * Realtime qua Supabase Realtime (WebSocket, giao thức Phoenix) — không cần thư viện ngoài.
 * App lắng nghe thay đổi trên các bảng nghiệp vụ ở Postgres để biết "máy khác vừa sửa dữ liệu"
 * và mời người dùng đồng bộ. Yêu cầu: bảng đã được thêm vào publication `supabase_realtime`
 * (chạy docs/sql/realtime.sql một lần).
 */
import type { CloudConfig } from './cloud'

export interface RealtimeEvent {
  table: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  at: string
}

const REALTIME_TABLES = [
  'orders', 'order_items', 'payments', 'order_events',
  'deliveries', 'delivery_events',
  'inventory_stock', 'inventory_txns',
  'customers', 'shifts', 'print_jobs',
]

const wsUrl = (url: string, key: string) => {
  const ref = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split('.')[0]
  return `wss://${ref}.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`
}

export interface RealtimeHandle {
  close: () => void
  status: 'connecting' | 'live' | 'error' | 'closed'
}

/** Kết nối realtime và gọi onEvent mỗi khi có thay đổi từ Postgres. */
export function connectRealtime(
  cfg: CloudConfig,
  onEvent: (e: RealtimeEvent) => void,
  onStatus?: (s: RealtimeHandle['status'], detail?: string) => void,
): RealtimeHandle {
  let ws: WebSocket | null = null
  let closedByUser = false
  let retry = 0
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let ref = 0

  const send = (msg: Record<string, unknown>) => {
    try { ws?.send(JSON.stringify(msg)) } catch { /* socket đã đóng */ }
  }

  const join = () => {
    ref += 1
    send({
      topic: 'realtime:public',
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
          postgres_changes: REALTIME_TABLES.map((table) => ({ event: '*', schema: 'public', table })),
        },
        access_token: cfg.key,
      },
      ref: String(ref),
    })
  }

  const open = () => {
    onStatus?.('connecting')
    try {
      ws = new WebSocket(wsUrl(cfg.url, cfg.key))
    } catch (e) {
      onStatus?.('error', (e as Error).message)
      return
    }
    ws.onopen = () => {
      retry = 0
      join()
      heartbeat = setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), 25000)
    }
    ws.onmessage = (ev) => {
      let msg: { event?: string; payload?: { data?: { table?: string; type?: string; commit_timestamp?: string }; status?: string; response?: { postgres_changes?: unknown[] } } }
      try { msg = JSON.parse(String(ev.data)) } catch { return }
      if (msg.event === 'phx_reply' && msg.payload?.status === 'ok' && msg.payload?.response?.postgres_changes) {
        onStatus?.('live')
        return
      }
      if (msg.event === 'postgres_changes' || msg.event === 'INSERT' || msg.event === 'UPDATE' || msg.event === 'DELETE') {
        const d = msg.payload?.data
        const table = d?.table ?? msg.payload?.data?.table ?? ''
        const type = (d?.type ?? msg.event) as RealtimeEvent['eventType']
        if (table) onEvent({ table, eventType: type, at: d?.commit_timestamp ?? new Date().toISOString() })
      }
    }
    ws.onerror = () => onStatus?.('error')
    ws.onclose = () => {
      if (heartbeat) clearInterval(heartbeat)
      if (closedByUser) { onStatus?.('closed'); return }
      retry = Math.min(retry + 1, 6)
      const wait = 1000 * 2 ** (retry - 1)
      onStatus?.('connecting', `thử lại sau ${Math.round(wait / 1000)}s`)
      setTimeout(() => { if (!closedByUser) open() }, wait)
    }
  }

  open()
  return {
    close: () => {
      closedByUser = true
      if (heartbeat) clearInterval(heartbeat)
      ws?.close()
      onStatus?.('closed')
    },
    get status() { return ws?.readyState === WebSocket.OPEN ? 'live' : 'connecting' },
  }
}

/** SQL bật realtime (chạy 1 lần trong SQL Editor). */
export const REALTIME_SQL = `-- Matcha POS · bật Supabase Realtime cho các bảng nghiệp vụ
do $$
declare t text;
begin
  foreach t in array array[
    'orders','order_items','payments','order_events',
    'deliveries','delivery_events',
    'inventory_stock','inventory_txns','customers','shifts','print_jobs'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- kiểm tra
select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
`
