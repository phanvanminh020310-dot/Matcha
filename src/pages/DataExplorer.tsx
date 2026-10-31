import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeftRight, Database, FileCode2, KeyRound, Link2, Play, Table2, Terminal, TriangleAlert, Wand2 } from 'lucide-react'
import { COLUMN_META, FK_EDGES, MODULES, SCHEMA_VERSION, TABLES, type ColumnMeta } from '../lib/schema'
import { all, dbSizeBytes, run, runReadOnlyQuery, scalar, tableRowCount, type SqlValue } from '../lib/db'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader, ResetDataButton } from '../components/layout/AppShell'
import { Badge, Button, Card, Field, Input, Modal, Select, Tabs, Textarea, Tooltip } from '../components/ui'
import { DataGrid } from '../components/DataGrid'
import { ERDView } from '../components/ERDView'
import { cx, formatNumber, formatVND } from '../lib/format'

const SAMPLE_QUERIES = [
  { label: 'Doanh thu 7 ngày gần nhất', sql: `SELECT substr(created_at, 1, 10) AS ngay, COUNT(*) AS so_don, SUM(total) AS doanh_thu\nFROM orders\nWHERE status != 'cancelled'\nGROUP BY ngay\nORDER BY ngay DESC\nLIMIT 7` },
  { label: 'Top 10 món bán chạy', sql: `SELECT p.name AS mon, SUM(oi.qty) AS so_ly, SUM(oi.qty * oi.unit_price) AS doanh_thu\nFROM order_items oi\nJOIN orders o ON o.id = oi.order_id\nJOIN products p ON p.id = oi.product_id\nWHERE o.status != 'cancelled'\nGROUP BY p.id\nORDER BY so_ly DESC\nLIMIT 10` },
  { label: 'Tồn kho dưới định mức', sql: `SELECT b.name AS chi_nhanh, i.name AS nguyen_lieu, s.qty_on_hand, i.min_qty\nFROM inventory_stock s\nJOIN ingredients i ON i.id = s.ingredient_id\nJOIN branches b ON b.id = s.branch_id\nWHERE s.qty_on_hand < i.min_qty\nORDER BY (s.qty_on_hand / i.min_qty) ASC\nLIMIT 20` },
  { label: 'Doanh thu theo kênh', sql: `SELECT channel, COUNT(*) AS so_don, SUM(total) AS doanh_thu\nFROM orders\nWHERE status != 'cancelled'\nGROUP BY channel\nORDER BY doanh_thu DESC` },
  { label: 'Khách chi tiêu nhiều nhất', sql: `SELECT name, phone, tier, points, total_spent\nFROM customers\nORDER BY total_spent DESC\nLIMIT 10` },
  { label: 'Nhật ký ghi dữ liệu gần đây', sql: `SELECT a.created_at, u.name AS nguoi_dung, a.action, a.entity, a.entity_id\nFROM audit_logs a\nLEFT JOIN users u ON u.id = a.user_id\nORDER BY a.id DESC\nLIMIT 20` },
  { label: 'Cơ cấu bảng: số dòng', sql: `SELECT 'orders' AS bang, COUNT(*) AS so_dong FROM orders\nUNION ALL SELECT 'order_items', COUNT(*) FROM order_items\nUNION ALL SELECT 'payments', COUNT(*) FROM payments\nUNION ALL SELECT 'inventory_txns', COUNT(*) FROM inventory_txns\nUNION ALL SELECT 'customers', COUNT(*) FROM customers` },
]

type FkFilter = { column: string; value: SqlValue } | null

export function DataExplorerPage() {
  const [table, setTable] = useState('orders')
  const [tab, setTab] = useState<'data' | 'schema' | 'erd' | 'sql'>('data')
  const [search, setSearch] = useState('')
  const [fkFilter, setFkFilter] = useState<FkFilter>(null)
  const counts = useSql(() => TABLES.map((t) => ({ name: t.name, count: tableRowCount(t.name) })), [])
  const [focusRow, setFocusRow] = useState<Record<string, SqlValue> | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, typeof TABLES>()
    TABLES.forEach((t) => map.set(t.module, [...(map.get(t.module) ?? []), t]))
    return [...map.entries()]
  }, [])

  const meta = useMemo(() => COLUMN_META[table], [table])
  const goto = (nextTable: string, filter: FkFilter = null) => {
    setTable(nextTable); setFkFilter(filter); setSearch(''); setFocusRow(null)
  }

  return (
    <div>
      <PageHeader
        icon={<Database size={20} />}
        title="Data Explorer"
        description={`${TABLES.length} bảng · ${FK_EDGES.length} khoá ngoại · SQLite ${(dbSizeBytes() / 1048576).toFixed(2)} MB · schema v${SCHEMA_VERSION}`}
        actions={<><Badge tone="green" dot>chỉ đọc mặc định</Badge><ResetDataButton /></>}
      />

      <div className="grid gap-3 lg:grid-cols-[236px_1fr]">
        <Card className="h-fit overflow-hidden">
          <div className="relative m-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Lọc bảng…" className="h-9 text-[12.5px]" />
          </div>
          <div className="max-h-[calc(100dvh-300px)] space-y-3 overflow-y-auto px-2 pb-3">
            {grouped.map(([mod, tables]) => {
              const list = tables.filter((t) => !search || t.label.toLowerCase().includes(search.toLowerCase()) || t.name.includes(search.toLowerCase()))
              if (!list.length) return null
              return (
                <div key={mod}>
                  <p className="flex items-center gap-1.5 px-1 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                    <i className="h-2 w-2 rounded-full" style={{ background: MODULES[mod as keyof typeof MODULES].color }} />
                    {MODULES[mod as keyof typeof MODULES].label}
                  </p>
                  {list.map((t) => {
                    const count = counts.find((c) => c.name === t.name)?.count ?? 0
                    return (
                      <button key={t.name} onClick={() => goto(t.name)}
                        className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition',
                          table === t.name ? 'bg-matcha-600 text-white' : 'text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800')}>
                        <span className="text-[13px]">{t.icon}</span>
                        <span className="flex-1 truncate">{t.label}</span>
                        <span className={cx('rounded px-1 text-[9.5px] tabular-nums', table === t.name ? 'bg-white/20' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400')}>{formatNumber(count)}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
            <div>
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-900 dark:text-ink-50">
                <span>{TABLES.find((t) => t.name === table)?.icon}</span>
                {TABLES.find((t) => t.name === table)?.label}
                <code className="rounded bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-normal text-ink-500 dark:bg-ink-800 dark:text-ink-300">{table}</code>
              </h3>
              <p className="mt-0.5 text-[11.5px] text-ink-400">{TABLES.find((t) => t.name === table)?.description}</p>
            </div>
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'data', label: 'Dữ liệu' }, { value: 'schema', label: 'Cấu trúc' }, { value: 'erd', label: 'ERD' }, { value: 'sql', label: 'SQL Console' }]} />
          </div>

          {fkFilter && (
            <div className="flex items-center gap-2 border-b border-matcha-200 bg-matcha-50 px-3 py-2 text-[12px] text-matcha-800 dark:border-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-200">
              <Link2 size={13} /> Đang lọc <code className="font-mono">{fkFilter.column} = {String(fkFilter.value)}</code>
              <button className="ml-auto underline" onClick={() => setFkFilter(null)}>Bỏ lọc</button>
            </div>
          )}

          {tab === 'data' && <DataTab table={table} meta={meta} fkFilter={fkFilter} onGoto={goto} onOpenRow={setFocusRow} />}
          {tab === 'schema' && <SchemaTab table={table} meta={meta} onGoto={goto} />}
          {tab === 'erd' && <ERDView onSelect={(t) => { setTable(t); setFkFilter(null) }} />}
          {tab === 'sql' && <SqlConsole />}
        </Card>
      </div>

      {focusRow && <RowDetail table={table} row={focusRow} onClose={() => setFocusRow(null)} onGoto={goto} />}
    </div>
  )
}

function DataTab({ table, meta, fkFilter, onGoto, onOpenRow }: {
  table: string
  meta: ColumnMeta[]
  fkFilter: FkFilter
  onGoto: (t: string, f?: FkFilter) => void
  onOpenRow: (r: Record<string, SqlValue>) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<string | undefined>(meta.find((c) => c.pk)?.name)
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [hidden, setHidden] = useState<string[]>([])
  const pageSize = 25

  const built = useSql(() => {
    const where: string[] = []
    const params: SqlValue[] = []
    if (search) {
      const textCols = meta.map((c) => c.name)
      where.push(`(${textCols.map((c) => `CAST("${c}" AS TEXT) LIKE ?`).join(' OR ')})`)
      textCols.forEach(() => params.push(`%${search}%`))
    }
    if (fkFilter) { where.push(`"${fkFilter.column}" = ?`); params.push(fkFilter.value) }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = scalar<number>(`SELECT COUNT(*) FROM "${table}" ${whereSql}`, params) ?? 0
    const rows = all<Record<string, SqlValue>>(`SELECT * FROM "${table}" ${whereSql} ORDER BY "${sort ?? meta[0].name}" ${dir.toUpperCase()} LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize])
    return { rows, total }
  }, [table, search, page, sort, dir, JSON.stringify(fkFilter)])

  const columns = meta.map((c) => ({ name: c.name, type: c.type, pk: !!c.pk }))

  return (
    <DataGrid
      tableName={table}
      columns={columns}
      rows={built.rows}
      total={built.total}
      page={page}
      pageSize={pageSize}
      onPage={setPage}
      sort={sort}
      dir={dir}
      onSort={(col) => { if (sort === col) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(col); setDir('asc') } }}
      search={search}
      onSearch={(v) => { setSearch(v); setPage(1) }}
      hidden={hidden}
      onToggleColumn={(col) => setHidden((h) => (h.includes(col) ? h.filter((x) => x !== col) : [...h, col]))}
      onRowClick={(r) => onOpenRow(r as Record<string, SqlValue>)}
      onCellClick={(col, row) => {
        const m = meta.find((c) => c.name === col)
        if (m?.fk && row[col] !== null) onGoto(m.fk.table, { column: m.fk.column, value: (row[col] ?? null) as SqlValue })
      }}
    />
  )
}

function SchemaTab({ table, meta, onGoto }: { table: string; meta: ColumnMeta[]; onGoto: (t: string) => void }) {
  const indexes = useSql(() => all<{ name: string; unique: number; origin: string }>(`PRAGMA index_list("${table}")`), [table])
  const fks = useSql(() => all<{ table: string; from: string; to: string }>(`PRAGMA foreign_key_list("${table}")`), [table])
  const colsWithIdx = useSql(() => all<{ name: string }>(`PRAGMA table_info("${table}")`), [table])
  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap gap-2 text-[11.5px]">
        <Badge tone="gray">{meta.length} cột</Badge>
        <Badge tone="gray">{fks.length} khoá ngoại</Badge>
        <Badge tone="gray">{indexes.length} index</Badge>
        <Badge tone="gray">{formatNumber(tableRowCount(table))} dòng</Badge>
      </div>
      <div className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700">
        <table className="table-base">
          <thead><tr><th>Cột</th><th>Kiểu</th><th>Ràng buộc</th><th>Null</th><th>Mặc định</th><th>Mô tả</th></tr></thead>
          <tbody>
            {meta.map((c) => {
              const inIdx = indexes.length > 0
              return (
                <tr key={c.name}>
                  <td className="whitespace-nowrap font-mono text-[11.5px] font-medium text-ink-900 dark:text-ink-50">{c.name}</td>
                  <td className="text-[11.5px] text-ink-500">{c.type}</td>
                  <td className="space-x-1 whitespace-nowrap">
                    {c.pk && <Badge tone="amber">PK</Badge>}
                    {c.fk && <button onClick={() => onGoto(c.fk!.table)}><Badge tone="blue"><Link2 size={9} /> {c.fk.table}</Badge></button>}
                    {c.unique && <Badge tone="green">UNIQUE</Badge>}
                    {c.indexed && inIdx && <Badge tone="gray">INDEX</Badge>}
                  </td>
                  <td className="text-[11px] text-ink-500">{c.nullable ? 'có' : 'không'}</td>
                  <td className="font-mono text-[11px] text-ink-400">—</td>
                  <td className="text-[11.5px] text-ink-600 dark:text-ink-300">{c.description}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Quan hệ cha–con</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-ink-200 p-2.5 dark:border-ink-700">
            <p className="mb-1 text-[11.5px] font-medium text-ink-700 dark:text-ink-200">Trỏ tới (cha)</p>
            {fks.length === 0 && <p className="text-[11.5px] text-ink-400">Không có khoá ngoại</p>}
            {fks.map((f) => (
              <button key={f.from + f.to} onClick={() => onGoto(f.table)} className="flex w-full justify-between rounded px-1 py-0.5 text-[11.5px] hover:bg-ink-50 dark:hover:bg-ink-800">
                <span className="font-mono text-ink-600 dark:text-ink-300">{f.from}</span>
                <span className="text-matcha-700 dark:text-matcha-300">→ {f.table}.{f.to}</span>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-ink-200 p-2.5 dark:border-ink-700">
            <p className="mb-1 text-[11.5px] font-medium text-ink-700 dark:text-ink-200">Được tham chiếu (con)</p>
            {FK_EDGES.filter((e) => e.to === table).length === 0 && <p className="text-[11.5px] text-ink-400">Không có bảng con</p>}
            {FK_EDGES.filter((e) => e.to === table).map((e) => (
              <button key={e.from + e.fromCol} onClick={() => onGoto(e.from)} className="flex w-full justify-between rounded px-1 py-0.5 text-[11.5px] hover:bg-ink-50 dark:hover:bg-ink-800">
                <span className="font-mono text-ink-600 dark:text-ink-300">{e.from}.{e.fromCol}</span>
                <span className="text-caramel-700 dark:text-caramel-300">→ đây</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-ink-400">{colsWithIdx.length} cột đọc trực tiếp từ PRAGMA table_info — luôn khớp với CSDL đang chạy.</p>
    </div>
  )
}

function RowDetail({ table, row, onClose, onGoto }: {
  table: string
  row: Record<string, SqlValue>
  onClose: () => void
  onGoto: (t: string, f?: FkFilter) => void
}) {
  const { user, toast } = useApp()
  const [expert, setExpert] = useState(false)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const meta = COLUMN_META[table] ?? []
  const pkCol = meta.find((c) => c.pk)?.name ?? 'id'
  const pkValue = row[pkCol]
  const children = FK_EDGES.filter((e) => e.to === table)

  const childCounts = useSql(() => children.map((c) => {
    try { return scalar<number>(`SELECT COUNT(*) FROM "${c.from}" WHERE "${c.fromCol}" = ?`, [pkValue]) ?? 0 } catch { return 0 }
  }), [table, String(pkValue)])

  const save = (col: string, raw: string) => {
    const m = meta.find((c) => c.name === col)
    let value: SqlValue = raw
    if (m?.type === 'INTEGER' || m?.type === 'REAL') value = raw === '' ? null : Number(raw)
    const before = row[col]
    try {
      run(`UPDATE "${table}" SET "${col}" = ? WHERE "${pkCol}" = ?`, [value, pkValue])
      run('INSERT INTO audit_logs (user_id, action, entity, entity_id, before_value, after_value, created_at) VALUES (?,?,?,?,?,?,?)',
        [user?.id ?? null, 'expert_update', table, String(pkValue), `${col}=${String(before)}`, `${col}=${String(value)}`, new Date().toISOString().slice(0, 19).replace('T', ' ')])
      toast({ title: 'Đã cập nhật dữ liệu', description: `${table}.${col} = ${String(value)}`, tone: 'success' })
      setEditKey(null)
    } catch (e) {
      toast({ title: 'Không lưu được', description: (e as Error).message, tone: 'error' })
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={`${table} #${String(pkValue)}`} description={`${meta.length} cột · bấm giá trị khoá ngoại để nhảy sang bản ghi liên quan`}
      footer={<>
        <label className="mr-auto flex items-center gap-2 text-[11.5px] text-ink-500">
          <input type="checkbox" checked={expert} onChange={(e) => setExpert(e.target.checked)} className="accent-caramel-500" />
          <span className={cx('inline-flex items-center gap-1', expert && 'text-caramel-600')}><Wand2 size={12} /> Chế độ chuyên gia (cho sửa, ghi audit log)</span>
        </label>
        <Button onClick={onClose}>Đóng</Button>
      </>}>
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700">
          <table className="table-base">
            <tbody>
              {meta.map((c) => (
                <tr key={c.name}>
                  <td className="w-[38%] align-top">
                    <span className="font-mono text-[11.5px] font-medium text-ink-800 dark:text-ink-100">{c.name}</span>
                    {c.pk && <span className="ml-1 text-[9px] text-caramel-600">PK</span>}
                    {c.fk && <span className="ml-1 text-[9px] text-sky-600">FK</span>}
                  </td>
                  <td className="text-[11.5px]">
                    {editKey === c.name ? (
                      <div className="flex gap-1">
                        <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-8 text-[12px]" onKeyDown={(e) => { if (e.key === 'Enter') save(c.name, editValue) }} />
                        <Button size="sm" variant="primary" onClick={() => save(c.name, editValue)}>Lưu</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {c.fk && row[c.name] !== null ? (
                          <button className="text-matcha-700 underline decoration-dotted dark:text-matcha-300" onClick={() => onGoto(c.fk!.table, { column: c.fk!.column, value: row[c.name] })}>
                            {String(row[c.name])} ↗
                          </button>
                        ) : (
                          <span className="break-all text-ink-700 dark:text-ink-200">{row[c.name] === null ? <i className="text-ink-300">NULL</i> : String(row[c.name])}</span>
                        )}
                        {expert && !c.pk && (
                          <Tooltip label="Sửa giá trị"><button className="ml-auto text-ink-300 hover:text-caramel-500" onClick={() => { setEditKey(c.name); setEditValue(String(row[c.name] ?? '')) }}><Wand2 size={11} /></button></Tooltip>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2">
          <div className="rounded-xl border border-ink-200 p-2.5 dark:border-ink-700">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-700 dark:text-ink-200"><KeyRound size={12} /> Bản ghi liên quan</p>
            {children.length === 0 && <p className="text-[11.5px] text-ink-400">Không có bảng con</p>}
            {children.map((c, i) => (
              <button key={c.from} onClick={() => onGoto(c.from, { column: c.fromCol, value: pkValue })}
                className="flex w-full items-center justify-between rounded px-1 py-1 text-[11.5px] hover:bg-ink-50 dark:hover:bg-ink-800">
                <span className="text-ink-600 dark:text-ink-300">{TABLES.find((t) => t.name === c.from)?.icon} {c.from}</span>
                <span className="rounded bg-ink-100 px-1 tabular-nums text-ink-500 dark:bg-ink-800">{formatNumber(childCounts[i] ?? 0)}</span>
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-cream-200/70 p-2.5 text-[11px] leading-relaxed text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            <p className="mb-1 inline-flex items-center gap-1 font-semibold"><TriangleAlert size={11} className="text-caramel-500" /> Ghi chú</p>
            <p>Chế độ chuyên gia cho phép sửa trực tiếp một ô dữ liệu. Mọi thay đổi được ghi vào bảng <code>audit_logs</code> kèm giá trị trước/sau.</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function SqlConsole() {
  const [sql, setSql] = useState(SAMPLE_QUERIES[0].sql)
  const [result, setResult] = useState<{ columns: string[]; rows: SqlValue[][]; ms: number; rowCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chartX, setChartX] = useState('')
  const [chartY, setChartY] = useState('')

  const execute = (text = sql) => {
    try {
      const r = runReadOnlyQuery(text)
      setResult(r); setError(null)
      setChartX(r.columns[0] ?? '')
      setChartY(r.columns.find((c, i) => i > 0 && r.rows.some((row) => typeof row[i] === 'number')) ?? '')
    } catch (e) {
      setError((e as Error).message); setResult(null)
    }
  }

  const chartData = useMemo(() => {
    if (!result || !chartX || !chartY) return []
    const xi = result.columns.indexOf(chartX); const yi = result.columns.indexOf(chartY)
    if (xi < 0 || yi < 0) return []
    return result.rows.slice(0, 20).map((r) => ({ label: String(r[xi]), value: Number(r[yi]) || 0 }))
  }, [result, chartX, chartY])

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_QUERIES.map((q) => (
          <button key={q.label} onClick={() => { setSql(q.sql); execute(q.sql) }}
            className="rounded-full border border-ink-200 px-2.5 py-1 text-[11px] text-ink-600 transition hover:border-matcha-400 hover:text-matcha-700 dark:border-ink-700 dark:text-ink-300">
            {q.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <Textarea value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false}
          className="min-h-[150px] font-mono text-[11.5px] leading-relaxed"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') execute() }} />
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <span className="text-[10px] text-ink-400">Ctrl/⌘ + Enter</span>
          <Button size="sm" variant="primary" icon={<Play size={13} />} onClick={() => execute()}>Chạy</Button>
        </div>
      </div>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {result && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-500">
            <Badge tone="green">{formatNumber(result.rowCount)} dòng</Badge>
            <Badge tone="gray">{result.ms} ms</Badge>
            <Badge tone="gray">chỉ đọc</Badge>
            <div className="ml-auto flex items-center gap-1.5">
              <FileCode2 size={12} />
              <Select value={chartX} onChange={(e) => setChartX(e.target.value)} className="h-8 w-[150px] text-[11.5px]"><option value="">Trục X…</option>{result.columns.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
              <Select value={chartY} onChange={(e) => setChartY(e.target.value)} className="h-8 w-[150px] text-[11.5px]"><option value="">Trục Y (số)…</option>{result.columns.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
            </div>
          </div>
          {chartData.length > 1 && (
            <div className="h-[200px] rounded-xl border border-ink-200 p-2 dark:border-ink-700">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e9e6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: '#7f8d84' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={44} />
                  <YAxis tick={{ fontSize: 9.5, fill: '#7f8d84' }} axisLine={false} tickLine={false} tickFormatter={(v) => Number(v) >= 1e6 ? `${Math.round(Number(v) / 1e6)}tr` : Number(v) >= 1e3 ? `${Math.round(Number(v) / 1e3)}k` : String(v)} />
                  <ReTooltip formatter={(v: any) => formatNumber(Number(v), 0)} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                  <Bar dataKey="value" fill="#16a34a" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="max-h-[38vh] overflow-auto rounded-xl border border-ink-200 dark:border-ink-700">
            <table className="table-base">
              <thead><tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i}>{r.map((v, j) => (
                    <td key={j} className={cx('whitespace-nowrap', typeof v === 'number' && 'text-right tabular-nums')}>
                      {v === null ? <i className="text-ink-300">NULL</i> : typeof v === 'number' && Math.abs(v) >= 1000 ? formatVND(v) : String(v)}
                    </td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!result && !error && (
        <p className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-[11.5px] text-ink-500 dark:bg-ink-800/60">
          <Terminal size={13} /> SQL Console chạy trên chính CSDL đang dùng cho POS — chỉ cho SELECT/WITH/PRAGMA/EXPLAIN.
        </p>
      )}
    </div>
  )
}
