import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, DatabaseZap, Download, Filter, Pencil, Plus, RefreshCw, Search, ShieldAlert, Trash2, X } from 'lucide-react'
import { MODULES, TABLES, type ColumnMeta } from '../lib/schema'
import {
  childrenOf, clearFkCache, columnsOf, countRows, deleteRow, duplicateRow, fkOptions, insertRow, listRows,
  pkOf, updateRow, usageOf, type Row,
} from '../lib/admin'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { can } from '../lib/rbac'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Switch, Textarea } from '../components/ui'
import { cx, formatNumber } from '../lib/format'

const LONG_TEXT = new Set(['layout', 'payload', 'before_value', 'after_value', 'note', 'description', 'config'])
const BOOLISH = /^(is_|has_)/

export function AdminDataPage() {
  const { user, toast, branchId } = useApp()
  const allowed = can(user?.role, 'admin.master')
  const [table, setTable] = useState('products')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<string | undefined>()
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [onlyBranch, setOnlyBranch] = useState(false)
  const [showAllCols, setShowAllCols] = useState(false)
  const [picker, setPicker] = useState('')
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; row?: Row } | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)

  const cols = useMemo(() => columnsOf(table), [table])
  const meta = TABLES.find((t) => t.name === table)
  const hasBranch = cols.some((c) => c.name === 'branch_id')

  const data = useSql(() => listRows(table, {
    q: search, sort, dir, page, pageSize,
    branchId: onlyBranch && hasBranch ? branchId : null,
  }), [table, search, sort, dir, page, pageSize, onlyBranch, branchId])

  const counts = useSql(() => Object.fromEntries(TABLES.map((t) => [t.name, countRows(t.name)])), [])

  useEffect(() => { setPage(1) }, [table, search, onlyBranch])

  const visibleCols: ColumnMeta[] = showAllCols ? cols : cols.slice(0, Math.min(7, cols.length))
  const groups = Object.entries(MODULES).map(([key, m]) => ({
    key, label: m.label, color: m.color,
    tables: TABLES.filter((t) => t.module === key && (t.name.includes(picker.toLowerCase()) || t.label.toLowerCase().includes(picker.toLowerCase()))),
  })).filter((g) => g.tables.length)

  const refresh = () => { clearFkCache(); setEditing(null); setDeleting(null); toast({ title: 'Đã làm mới dữ liệu', tone: 'success' }) }

  const exportCsv = () => {
    const rows = listRows(table, { q: search, page: 1, pageSize: 100000 }).rows
    const header = cols.map((c) => c.name).join(',')
    const body = rows.map((r) => cols.map((c) => JSON.stringify(r[c.name] ?? '')).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `matcha-${table}.csv`
    a.click()
    toast({ title: 'Đã xuất CSV', description: `${formatNumber(rows.length)} dòng · ${table}`, tone: 'success' })
  }

  if (!allowed) {
    return (
      <div>
        <PageHeader icon={<DatabaseZap size={20} />} title="Quản trị dữ liệu" description="Thêm / sửa / xoá mọi danh mục trong hệ thống" />
        <Card className="p-6">
          <div className="flex items-center gap-2 text-[13px] text-rose-600"><ShieldAlert size={16} /> Vai trò của bạn không có quyền “Quản trị dữ liệu”. Liên hệ chủ chuỗi để cấp quyền.</div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        icon={<DatabaseZap size={20} />}
        title="Quản trị dữ liệu"
        description="Thêm / sửa / nhân bản / xoá mọi danh mục — mọi thay đổi ghi vào audit_logs và đẩy lên cloud như dữ liệu thật"
        actions={<Badge tone="green" dot>{TABLES.length} bảng quản trị được</Badge>}
      />

      <div className="grid gap-3 lg:grid-cols-[236px_1fr]">
        {/* danh sách bảng */}
        <Card className="h-fit overflow-hidden">
          <div className="border-b border-ink-100 p-2 dark:border-ink-800">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input value={picker} onChange={(e) => setPicker(e.target.value)} placeholder="Tìm bảng…" className="h-8 pl-8 text-[12px]" />
            </div>
          </div>
          <div className="max-h-[620px] overflow-y-auto p-1.5">
            {groups.map((g) => (
              <div key={g.key} className="mb-1.5">
                <p className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: g.color }}>{g.label}</p>
                {g.tables.map((t) => (
                  <button key={t.name} onClick={() => { setTable(t.name); setSort(undefined) }}
                    className={cx('flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[11.5px] transition',
                      table === t.name ? 'bg-matcha-50 font-semibold text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-200' : 'text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800')}>
                    <span>{t.icon}</span>
                    <span className="flex-1 truncate">{t.label}</span>
                    <span className="tabular-nums text-[10px] text-ink-400">{formatNumber(counts[t.name] ?? 0)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Card>

        {/* bảng dữ liệu */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-2.5 dark:border-ink-800">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-900 dark:text-ink-50">
                {meta?.icon} {meta?.label ?? table}
                <span className="rounded-full bg-ink-100 px-1.5 text-[10px] font-medium text-ink-500 dark:bg-ink-800">{formatNumber(data.total)} dòng</span>
              </p>
              <p className="truncate text-[11px] text-ink-400">{meta?.description}</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setSearch(q) }}
                  placeholder="Tìm trong bảng… (Enter)" className="h-8 w-[210px] pl-8 text-[12px]" />
              </div>
              {hasBranch && (
                <Button size="sm" variant={onlyBranch ? 'primary' : 'secondary'} icon={<Filter size={13} />} onClick={() => setOnlyBranch((v) => !v)}>
                  {onlyBranch ? 'Đang lọc chi nhánh' : 'Lọc chi nhánh'}
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={exportCsv}>CSV</Button>
              <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setEditing({ mode: 'create' })}>Thêm mới</Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  {visibleCols.map((c) => (
                    <th key={c.name} className="cursor-pointer whitespace-nowrap select-none" onClick={() => {
                      setSort(c.name); setDir(sort === c.name && dir === 'asc' ? 'desc' : 'asc')
                    }}>
                      <span className="flex items-center gap-1">
                        {c.description || c.name}
                        {sort === c.name && <span className="text-[9px]">{dir === 'asc' ? '▲' : '▼'}</span>}
                        {c.pk && <span className="rounded bg-matcha-100 px-1 text-[9px] text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300">PK</span>}
                        {c.fk && <span className="rounded bg-sky-100 px-1 text-[9px] text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">FK</span>}
                      </span>
                    </th>
                  ))}
                  <th className="w-[120px] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i}>
                    {visibleCols.map((c) => (
                      <td key={c.name} className="max-w-[240px] truncate align-middle">
                        <CellValue col={c} value={row[c.name]} />
                      </td>
                    ))}
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button title="Sửa" onClick={() => setEditing({ mode: 'edit', row })} className="rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800">
                          <Pencil size={13} />
                        </button>
                        <button title="Nhân bản" onClick={() => {
                          try { duplicateRow(table, pickKeys(row, table), user?.id); toast({ title: 'Đã nhân bản bản ghi', tone: 'success' }); setPage(1) }
                          catch (e) { toast({ title: 'Không nhân bản được', description: (e as Error).message, tone: 'error' }) }
                        }} className="rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800">
                          <Copy size={13} />
                        </button>
                        <button title="Xoá" onClick={() => setDeleting(row)} className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-900/20">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr><td colSpan={visibleCols.length + 1}><EmptyState title="Không có dòng nào" description="Thử xoá bộ lọc hoặc thêm bản ghi mới" /></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 p-2 dark:border-ink-800">
            <button onClick={() => setShowAllCols((v) => !v)} className="text-[11.5px] font-medium text-matcha-700 underline dark:text-matcha-300">
              {showAllCols ? 'Thu gọn cột' : `Hiện tất cả ${cols.length} cột`}
            </button>
            <span className="text-[11px] text-ink-400">trang {page}/{data.pages}</span>
            <div className="ml-auto flex items-center gap-1">
              <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="h-7 w-[74px] text-[11px]">
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/trang</option>)}
              </Select>
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft size={13} />}>Trước</Button>
              <Button size="sm" variant="ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} icon={<ChevronRight size={13} />}>Sau</Button>
              <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={refresh}>Làm mới</Button>
            </div>
          </div>
        </Card>
      </div>

      {editing && (
        <RowForm
          table={table}
          row={editing.row}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); clearFkCache() }}
        />
      )}

      {deleting && (
        <DeleteConfirm table={table} row={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  )
}

function pickKeys(row: Row, table: string): Row {
  return Object.fromEntries(pkOf(table).map((k) => [k, row[k]]))
}

function CellValue({ col, value }: { col: ColumnMeta; value: unknown }) {
  if (value == null || value === '') return <span className="text-ink-300">—</span>
  if (col.name.startsWith('is_') && (value === 1 || value === 0 || value === true || value === false)) {
    const on = value === 1 || value === true
    return <Badge tone={on ? 'green' : 'gray'}>{on ? 'Bật' : 'Tắt'}</Badge>
  }
  if (typeof value === 'number') return <span className="tabular-nums">{formatNumber(value)}</span>
  const text = String(value)
  if (/^https?:\/\//.test(text)) return <a href={text} target="_blank" rel="noreferrer" className="text-sky-600 underline dark:text-sky-400">{text.slice(0, 28)}…</a>
  return <span title={text}>{text.length > 60 ? `${text.slice(0, 60)}…` : text}</span>
}

/* ------------------------------ form tạo/sửa ------------------------------ */

function RowForm({ table, row, mode, onClose, onSaved }: {
  table: string
  row?: Row
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved: () => void
}) {
  const { toast, user } = useApp()
  const cols = columnsOf(table)
  const meta = TABLES.find((t) => t.name === table)
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(cols.map((c) => [
    c.name, row?.[c.name] == null ? (c.name === 'is_active' || c.name === 'is_default' ? '1' : '') : String(row[c.name]),
  ])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    setSaving(true)
    try {
      if (mode === 'create') insertRow(table, form, user?.id)
      else updateRow(table, pickKeys(row!, table), form, user?.id)
      toast({ title: mode === 'create' ? 'Đã thêm bản ghi' : 'Đã lưu thay đổi', description: meta?.label, tone: 'success' })
      onSaved()
    } catch (e) {
      const msg = (e as Error).message
      setErrors({ _: msg })
      toast({ title: 'Không lưu được', description: msg, tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="lg"
      title={`${mode === 'create' ? 'Thêm mới' : 'Sửa'} · ${meta?.label ?? table}`}
      description={meta?.description}
      footer={<>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="primary" disabled={saving} onClick={submit}>{saving ? 'Đang lưu…' : 'Lưu'}</Button>
      </>}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {cols.map((c) => {
          const disabled = (mode === 'edit' && c.pk) || (mode === 'create' && c.pk && /INT/i.test(c.type))
          const value = form[c.name] ?? ''
          const isBool = BOOLISH.test(c.name) && /INT/i.test(c.type)
          const isLong = LONG_TEXT.has(c.name) || /JSON/i.test(c.type)
          return (
            <Field key={c.name} label={`${c.description || c.name}${c.nullable ? '' : ' *'}`}
              hint={[c.pk ? 'khoá chính' : '', c.fk ? `→ ${c.fk.table}` : '', c.unique ? 'duy nhất' : ''].filter(Boolean).join(' · ') || undefined}
              className={isLong ? 'sm:col-span-2' : ''}>
              {c.fk ? (
                <Select value={value} disabled={disabled} onChange={(e) => set(c.name, e.target.value)}>
                  <option value="">— chọn {c.fk.table} —</option>
                  {fkOptions(table, c).map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </Select>
              ) : isBool ? (
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={value === '1' || value === 'true'} onChange={(v) => set(c.name, v ? '1' : '0')} label={c.name} />
                  <span className="text-[11.5px] text-ink-500">{value === '1' ? 'Bật' : 'Tắt'}</span>
                </div>
              ) : isLong ? (
                <Textarea value={value} disabled={disabled} rows={3} onChange={(e) => set(c.name, e.target.value)} />
              ) : (
                <Input value={value} disabled={disabled}
                  type={/INT|REAL|DOUBLE/i.test(c.type) ? 'number' : c.name.endsWith('_at') ? 'datetime-local' : 'text'}
                  onChange={(e) => set(c.name, e.target.value)} placeholder={c.nullable ? 'có thể để trống' : ''} />
              )}
              {errors[c.name] && <p className="mt-0.5 text-[10.5px] text-rose-600">{errors[c.name]}</p>}
            </Field>
          )
        })}
      </div>
      {errors._ && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-[11.5px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{errors._}</p>}
      <p className="mt-2 text-[10.5px] text-ink-400">Bản ghi {mode === 'create' ? 'sẽ được thêm' : 'thay đổi'} ghi vào <b>audit_logs</b> (ai sửa, trước–sau). Nhấn “Đẩy dữ liệu lên” ở Cài đặt để đồng bộ cloud.</p>
    </Modal>
  )
}

function DeleteConfirm({ table, row, onClose }: { table: string; row: Row; onClose: () => void }) {
  const { toast, user } = useApp()
  const meta = TABLES.find((t) => t.name === table)
  const keys = pickKeys(row, table)
  const used = usageOf(table, keys)
  const childTables = childrenOf(table)

  return (
    <Modal open onClose={onClose} size="sm" title={`Xoá ${meta?.label ?? table}?`}
      description={pkOf(table).map((k) => `${k}=${row[k]}`).join(' · ')}
      footer={<>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="primary" icon={<Trash2 size={14} />} onClick={() => {
          try {
            deleteRow(table, keys, { force: used.length > 0, userId: user?.id })
            toast({ title: 'Đã xoá bản ghi', description: used.length ? `Kèm ${used.reduce((s, u) => s + u.count, 0)} dòng con` : undefined, tone: 'success' })
            onClose()
          } catch (e) {
            toast({ title: 'Không xoá được', description: (e as Error).message, tone: 'error' })
          }
        }}>{used.length ? 'Xoá cả dữ liệu liên quan' : 'Xoá'}</Button>
      </>}>
      {used.length > 0 ? (
        <div className="space-y-1.5 text-[12px]">
          <p className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            Bản ghi này đang được tham chiếu — xoá sẽ xoá luôn dữ liệu con:
          </p>
          <ul className="space-y-1">
            {used.map((u) => (
              <li key={`${u.table}.${u.column}`} className="flex items-center justify-between rounded-lg bg-ink-50 px-2 py-1 dark:bg-ink-800">
                <span>{TABLES.find((t) => t.name === u.table)?.label ?? u.table} <span className="text-ink-400">({u.column})</span></span>
                <span className="font-semibold tabular-nums">{formatNumber(u.count)} dòng</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[12px] text-ink-600 dark:text-ink-300">
          Không có dòng nào tham chiếu tới bản ghi này ({childTables.length} bảng con đã kiểm tra). Xoá là an toàn.
        </p>
      )}
    </Modal>
  )
}
