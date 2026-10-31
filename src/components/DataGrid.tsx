import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Columns3, Download, Search } from 'lucide-react'
import { Badge, Button, IconButton, Input, Pagination } from './ui'
import { cx, downloadFile, formatNumber, toCSV } from '../lib/format'

export interface GridColumn { name: string; type: string; pk: boolean }

export function DataGrid({
  columns, rows, total, page, pageSize, onPage, onSort, sort, dir, search, onSearch, hidden, onToggleColumn, onRowClick, onCellClick, tableName,
}: {
  columns: GridColumn[]
  rows: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  onPage: (p: number) => void
  onSort: (col: string) => void
  sort?: string
  dir: 'asc' | 'desc'
  search: string
  onSearch: (s: string) => void
  hidden: string[]
  onToggleColumn: (col: string) => void
  onRowClick?: (row: Record<string, unknown>) => void
  onCellClick?: (col: string, row: Record<string, unknown>) => void
  tableName: string
}) {
  const [colMenu, setColMenu] = useState(false)
  const visible = columns.filter((c) => !hidden.includes(c.name))

  useEffect(() => { setColMenu(false) }, [tableName])

  const exportCsv = () => {
    downloadFile(`${tableName}-page${page}.csv`, toCSV(rows as Record<string, unknown>[], columns.map((c) => c.name)))
  }
  const exportJson = () => {
    downloadFile(`${tableName}-page${page}.json`, JSON.stringify(rows, null, 2), 'application/json')
  }

  const renderCell = (v: unknown) => {
    if (v === null || v === undefined) return <span className="text-ink-300">NULL</span>
    if (typeof v === 'number') return formatNumber(v, Number.isInteger(v) ? 0 : 2)
    const s = String(v)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.replace('T', ' ').slice(0, 19)
    if (s.length > 64) return s.slice(0, 62) + '…'
    return s || <span className="text-ink-300">—</span>
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-2.5 dark:border-ink-800">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={`Tìm trong ${tableName}…`} className="h-9 pl-9 text-[12.5px]" />
        </div>
        <Badge tone="gray">{formatNumber(total)} dòng</Badge>
        <div className="relative">
          <Button size="sm" variant="secondary" icon={<Columns3 size={14} />} onClick={() => setColMenu((v) => !v)}>Cột</Button>
          {colMenu && (
            <div className="absolute right-0 top-10 z-30 max-h-72 w-56 overflow-y-auto rounded-xl border border-ink-200 bg-white p-2 shadow-lift dark:border-ink-700 dark:bg-ink-900">
              {columns.map((c) => (
                <label key={c.name} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] hover:bg-ink-50 dark:hover:bg-ink-800">
                  <input type="checkbox" checked={!hidden.includes(c.name)} onChange={() => onToggleColumn(c.name)} className="accent-matcha-600" />
                  <span className="truncate">{c.name}</span>
                  {c.pk && <span className="ml-auto text-[9px] text-caramel-600">PK</span>}
                </label>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={exportCsv}>CSV</Button>
        <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={exportJson}>JSON</Button>
      </div>

      <div className="max-h-[calc(100dvh-380px)] overflow-auto">
        <table className="table-base">
          <thead>
            <tr>
              {visible.map((c) => (
                <th key={c.name} className="cursor-pointer select-none whitespace-nowrap" onClick={() => onSort(c.name)}>
                  <span className="inline-flex items-center gap-1">
                    {c.name}
                    {c.pk && <span className="rounded bg-caramel-100 px-1 text-[9px] text-caramel-700 dark:bg-caramel-900/40 dark:text-caramel-300">PK</span>}
                    {sort === c.name && (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="cursor-pointer" onClick={() => onRowClick?.(r)}>
                {visible.map((c) => (
                  <td key={c.name} className="max-w-[280px] truncate whitespace-nowrap tabular-nums">
                    <button
                      className="text-left hover:underline"
                      onClick={(e) => { e.stopPropagation(); onCellClick?.(c.name, r) }}
                    >
                      {renderCell(r[c.name])}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-[13px] text-ink-400">Không có dòng nào</p>}
      </div>
      <div className="px-2.5">
        <Pagination page={page} pageSize={pageSize} total={total} onPage={onPage} />
      </div>
    </div>
  )
}
