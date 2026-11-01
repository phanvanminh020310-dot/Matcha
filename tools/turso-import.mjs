#!/usr/bin/env node
/**
 * Nạp Matcha POS lên Turso (libSQL) + kiểm tra kết nối/CORS.
 *
 * Cách dùng (sau khi anh tạo database trên turso.tech):
 *   1. Ghi file /home/user/turso-keys.txt:
 *        URL=libsql://matcha-<org>.turso.io
 *        TOKEN=eyJ...              (token full-access)
 *        TOKEN_RO=eyJ...           (token read-only, tuỳ chọn)
 *   2. node tools/turso-import.mjs --check      → kiểm tra kết nối, quyền, CORS
 *      node tools/turso-import.mjs --all        → tạo schema + trigger + nạp 62.401 dòng
 *      node tools/turso-import.mjs --verify     → đối chiếu số dòng từng bảng
 *      node tools/turso-import.mjs --reset-changes → dọn change-log, seq về 1
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

/* ------------------------------- cấu hình -------------------------------- */
function loadKeys() {
  const p = '/home/user/turso-keys.txt'
  const out = {}
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*[=:]\s*(.+?)\s*$/)
      if (m) out[m[1]] = m[2]
    }
  }
  return {
    url: process.env.TURSO_URL ?? out.URL ?? '',
    token: process.env.TURSO_TOKEN ?? out.TOKEN ?? '',
    tokenRo: process.env.TURSO_TOKEN_RO ?? out.TOKEN_RO ?? '',
  }
}

const toHttps = (u) =>
  (u || '').trim().replace(/\/+$/, '').replace(/^(libsql|turso):\/\//i, 'https://').replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://')

const enc = (v) => {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' }
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v }
  return { type: 'text', value: String(v) }
}

async function pipeline(base, token, stmts) {
  const res = await fetch(`${base}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [...stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: (s.args ?? []).map(enc) } })), { type: 'close' }],
    }),
    signal: AbortSignal.timeout(60000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`)
  const json = JSON.parse(text)
  const out = []
  for (const r of json.results ?? []) {
    if (r.type !== 'ok') {
      const m = r.error?.message ?? r.response?.error?.message ?? JSON.stringify(r).slice(0, 200)
      throw new Error(m)
    }
    out.push(r.response?.result ?? { cols: [], rows: [], affected_row_count: 0 })
  }
  return out
}

const CHUNK = 25

async function runAll(base, token, stmts, label = '') {
  for (let i = 0; i < stmts.length; i += CHUNK) {
    const part = stmts.slice(i, i + CHUNK)
    let tries = 0
    for (;;) {
      try {
        await pipeline(base, token, part)
        break
      } catch (e) {
        if (++tries > 3) {
          console.error('\n✗ Câu lệnh lỗi:', part[0].sql.slice(0, 300).replace(/\s+/g, ' '))
          throw e
        }
        await new Promise((r) => setTimeout(r, 500 * tries))
      }
    }
    if (label) process.stdout.write(`\r${label} ${Math.min(i + CHUNK, stmts.length)}/${stmts.length}  `)
  }
  // giữ thứ tự cuối file
  if (label) process.stdout.write('\n')
}

/* ------------------------------- các bước -------------------------------- */
async function check(cfg) {
  const base = toHttps(cfg.url)
  console.log('• URL           :', base)
  const t0 = Date.now()
  const [r] = await pipeline(base, cfg.token, [{ sql: 'SELECT 1 AS ok' }])
  console.log('• Kết nối       : OK (%d ms), trả về %s', Date.now() - t0, JSON.stringify(r.rows[0]))

  // quyền ghi
  let canWrite = false
  try {
    await pipeline(base, cfg.token, [
      { sql: 'CREATE TABLE IF NOT EXISTS _probe (id INTEGER PRIMARY KEY, at TEXT)' },
      { sql: "INSERT INTO _probe (at) VALUES (datetime('now'))" },
      { sql: 'DROP TABLE _probe' },
    ])
    canWrite = true
  } catch (e) {
    console.log('• Quyền ghi     : KHÔNG (%s)', String(e.message).slice(0, 80))
  }
  if (canWrite) console.log('• Quyền ghi     : OK (token full-access)')

  if (cfg.tokenRo) {
    try {
      await pipeline(base, cfg.tokenRo, [{ sql: 'SELECT 1' }])
      let roWrite = true
      try {
        await pipeline(base, cfg.tokenRo, [{ sql: 'CREATE TABLE _probe2 (id INTEGER)' }])
      } catch { roWrite = false }
      console.log('• Token chỉ xem : đọc OK, ghi %s', roWrite ? 'ĐƯỢC (⚠ không phải read-only!)' : 'bị chặn ✔')
    } catch (e) {
      console.log('• Token chỉ xem : LỖI', String(e.message).slice(0, 80))
    }
  }

  // CORS: trình duyệt ở github.io gọi thẳng được không?
  const origin = 'https://phanvanminh020310-dot.github.io'
  const pre = await fetch(`${base}/v2/pipeline`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
  }).catch((e) => ({ status: 0, headers: new Map() }))
  const acao = pre.headers?.get?.('access-control-allow-origin')
  console.log('• CORS preflight: HTTP %s | allow-origin = %s', pre.status, acao ?? '(không có)')
  const post = await fetch(`${base}/v2/pipeline`, {
    method: 'POST',
    headers: { Origin: origin, Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT 1' } }, { type: 'close' }] }),
  }).catch(() => null)
  console.log('• CORS POST     : HTTP %s | allow-origin = %s', post?.status ?? 0, post?.headers?.get?.('access-control-allow-origin') ?? '(không có)')
  const corsOk = !!(acao || post?.headers?.get?.('access-control-allow-origin'))
  console.log(corsOk ? '→ Trình duyệt gọi thẳng Turso ĐƯỢC ✅' : '→ Trình duyệt bị CORS chặn ❌ (cần Cloudflare Worker làm cổng)')
  return { canWrite, corsOk }
}

async function schema(cfg) {
  const base = toHttps(cfg.url)
  const sql = fs.readFileSync(path.join(ROOT, 'docs/sql/turso-schema.sql'), 'utf8')
  const stmts = splitSql(sql).map((s) => ({ sql: s }))
  console.log('• Tạo schema:', stmts.length, 'câu lệnh')
  await runAll(base, cfg.token, stmts, '  schema')
  const trig = fs.readFileSync(path.join(ROOT, 'docs/sql/turso-changes.sql'), 'utf8')
  const tStmts = splitSql(trig).map((s) => ({ sql: s }))
  console.log('• Tạo change-log triggers:', tStmts.length, 'câu lệnh')
  await runAll(base, cfg.token, tStmts, '  triggers')
}

/**
 * Tách file .sql thành từng câu lệnh.
 * - Bỏ qua dấu ; bên trong chuỗi '...' / "..." / [..] / `...`
 * - Giữ nguyên khối CREATE TRIGGER ... BEGIN ... END; (dấu ; bên trong KHÔNG cắt)
 * - Bỏ dòng chú thích -- và PRAGMA
 */
function splitSql(text) {
  const out = []
  let cur = ''
  let quote = null
  let inBody = false // đang ở trong BEGIN ... END của trigger
  const push = () => {
    const s = cur.trim()
    cur = ''
    if (!s) return
    if (/^(PRAGMA|BEGIN TRANSACTION|COMMIT)/i.test(s)) return
    out.push(s)
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; cur += ch; continue }
    if (ch === ';') {
      cur += ch
      if (inBody) continue // còn trong thân trigger → chưa kết thúc câu
      push()
      continue
    }
    cur += ch
    // phát hiện "BEGIN" ngay sau CREATE TRIGGER, và "END" đóng thân
    if (!inBody && /\bBEGIN\s*$/i.test(cur) && /^\s*CREATE\s+TRIGGER/i.test(cur)) inBody = true
    else if (inBody && /\bEND\s*$/i.test(cur)) inBody = false
  }
  push()
  // bỏ dòng chú thích ở đầu mỗi câu
  return out
    .map((s) => s.replace(/^(?:[ \t]*--[^\n]*\n)+/, '').trim())
    .filter((s) => s && !/^--/.test(s))
}

async function data(cfg) {
  const base = toHttps(cfg.url)
  const dataPath = ['/home/user/turso-data.jsonl', path.join(ROOT, 'docs/sql/turso-data.jsonl')].find((f) => fs.existsSync(f))
  if (!dataPath) throw new Error('Thiếu turso-data.jsonl')
  const lines = fs.readFileSync(dataPath, 'utf8').split('\n').filter(Boolean)
  console.log('• Nạp dữ liệu:', lines.length, 'lô')
  let done = 0, rows = 0
  for (const line of lines) {
    const { table, columns, rows: rws } = JSON.parse(line)
    const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`
    await runAll(base, cfg.token, rws.map((r) => ({ sql, args: r })))
    done++; rows += rws.length
    if (done % 20 === 0) process.stdout.write(`\r  ${done}/${lines.length} lô · ${rows} dòng   `)
  }
  process.stdout.write(`\r  xong: ${rows} dòng trong ${done} lô            \n`)
  await resetChanges(cfg)
}

/** Nạp dữ liệu ban đầu cũng làm trigger ghi 62.401 dòng rác → dọn sạch, đưa seq về 1. */
async function resetChanges(cfg) {
  const base = toHttps(cfg.url)
  const [before] = await pipeline(base, cfg.token, [{ sql: 'SELECT count(*) FROM sync_changes' }])
  const n = Number(before.rows[0]?.[0]?.value ?? -1)
  await runAll(base, cfg.token, [
    { sql: 'DELETE FROM sync_changes' },
    { sql: "DELETE FROM sqlite_sequence WHERE name = 'sync_changes'" },
  ])
  console.log('• Dọn change-log sau nạp: bỏ %s dòng (seq về 1)', n)
}

async function verify(cfg) {
  const base = toHttps(cfg.url)
  const expPath = ['/home/user/turso-expected.json', path.join(ROOT, 'docs/sql/turso-expected.json')].find((f) => fs.existsSync(f))
  if (!expPath) throw new Error('Thiếu turso-expected.json')
  const expected = JSON.parse(fs.readFileSync(expPath, 'utf8'))
  let bad = 0
  for (const [table, n] of Object.entries(expected)) {
    const [r] = await pipeline(base, cfg.token, [{ sql: `SELECT count(*) FROM "${table}"` }])
    const got = Number(r.rows[0]?.[0]?.value ?? r.rows[0]?.[0] ?? -1)
    if (got !== n) { console.log(`  ✗ ${table}: Turso ${got} ≠ Supabase ${n}`); bad++ }
  }
  console.log(bad ? `✗ ${bad} bảng lệch` : `✔ toàn bộ ${Object.keys(expected).length} bảng khớp số dòng`)
}

/* --------------------------------- main ---------------------------------- */
const cfg = loadKeys()
const args = process.argv.slice(2)
if (!cfg.url || !cfg.token) {
  console.error('Thiếu URL/TOKEN. Ghi vào /home/user/turso-keys.txt:\nURL=libsql://...\nTOKEN=eyJ...\nTOKEN_RO=eyJ...')
  process.exit(1)
}
try {
  if (args.includes('--check') || args.length === 0) await check(cfg)
  if (args.includes('--schema')) await schema(cfg)
  if (args.includes('--data')) await data(cfg)
  if (args.includes('--verify')) await verify(cfg)
  if (args.includes('--reset-changes')) await resetChanges(cfg)
  if (args.includes('--all')) { await schema(cfg); await data(cfg); await verify(cfg) }
} catch (e) {
  console.error('LỖI:', e.message)
  process.exit(1)
}
