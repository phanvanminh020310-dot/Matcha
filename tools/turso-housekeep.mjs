#!/usr/bin/env node
/**
 * Dọn dẹp định kỳ cho Turso — chạy 1 lần/tuần (hoặc tay) để giữ mức dùng ở mức thấp.
 *
 *   node tools/turso-housekeep.mjs            → xem tình trạng
 *   node tools/turso-housekeep.mjs --prune 7  → xoá change-log cũ hơn 7 ngày
 *
 * Vì sao cần: mỗi lần máy khác hỏi "có gì mới từ seq X", Turso phải quét bảng sync_changes.
 * Bảng này càng ngắn thì mỗi lần hỏi càng rẻ.
 */
import fs from 'node:fs'

const keys = Object.fromEntries(
  fs.readFileSync('/home/user/turso-keys.txt', 'utf8').split('\n').filter(Boolean).map((l) => l.split('=').map((s) => s.trim())),
)
const base = keys.URL.replace(/^(libsql|turso):\/\//i, 'https://')

const enc = (v) => (v === null || v === undefined ? { type: 'null' } : typeof v === 'number' ? (Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v }) : { type: 'text', value: String(v) })

async function pipe(stmts) {
  const r = await fetch(`${base}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${keys.TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [...stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: (s.args ?? []).map(enc) } })), { type: 'close' }] }),
    signal: AbortSignal.timeout(60000),
  })
  const j = await r.json()
  return j.results.map((x) => (x.type === 'ok' ? x.response.result : { error: x.error?.message }))
}
const n = (row, i = 0) => (row?.[i]?.type === 'null' ? null : Number(row?.[i]?.value ?? row?.[i] ?? -1))

const [st] = await pipe([
  { sql: 'SELECT count(*) AS dang_cho FROM sync_changes' },
  { sql: "SELECT coalesce(max(seq), 0) AS seq_cao_nhat FROM sync_changes" },
  { sql: "SELECT min(at) FROM sync_changes" },
])
console.log('• Change-log đang giữ :', n(st.rows?.[0]), 'dòng')
console.log('• seq cao nhất        :', n(st.rows?.[1]))
console.log('• Bản ghi cũ nhất     :', st.rows?.[2]?.[0]?.value ?? '(trống)')

const i = process.argv.indexOf('--prune')
if (i > -1) {
  const days = Number(process.argv[i + 1] ?? 7)
  const [r] = await pipe([{ sql: `DELETE FROM sync_changes WHERE at < datetime('now', '-${days} days')` }])
  console.log(`• Đã xoá change-log cũ hơn ${days} ngày:`, r.affected_row_count ?? 0, 'dòng')
  const [after] = await pipe([{ sql: 'SELECT count(*) FROM sync_changes' }])
  console.log('• Còn lại             :', n(after.rows?.[0]), 'dòng')
}
