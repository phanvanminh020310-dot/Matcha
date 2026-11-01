/**
 * Bộ máy CRUD tổng quát cho MỌI bảng nghiệp vụ.
 * Dùng metadata trong schema.ts (tên cột, kiểu, nhãn tiếng Việt, FK, PK, nullable)
 * để tự sinh bảng + form: thêm / sửa / nhân bản / xoá, kiểm tra khoá ngoại trước khi xoá,
 * ghi audit_logs cho mọi thay đổi.
 */
import { all, one, run, scalar, type SqlValue } from './db'
import { COLUMN_META, FK_EDGES, TABLES, type ColumnMeta, type TableMeta } from './schema'

export type Row = Record<string, SqlValue>

export function tableMeta(name: string): TableMeta | undefined {
  return TABLES.find((t) => t.name === name)
}

export function columnsOf(table: string): ColumnMeta[] {
  const meta = COLUMN_META[table]
  if (meta?.length) return meta
  // bảng chưa khai báo metadata → đọc trực tiếp từ SQLite
  try {
    return all<{ name: string; type: string; pk: number; notnull: number }>(`PRAGMA table_info(${table})`).map((c) => ({
      name: c.name, type: c.type || 'TEXT', pk: Number(c.pk) > 0, nullable: !Number(c.notnull) && Number(c.pk) === 0,
      description: c.name,
    }))
  } catch {
    return []
  }
}

export const pkOf = (table: string) => columnsOf(table).filter((c) => c.pk).map((c) => c.name)

export const rowKey = (row: Row, table: string) => pkOf(table).map((k) => String(row[k] ?? '')).join('|')

/** Bảng con (đang tham chiếu tới bảng này) — dùng để chặn xoá dây chuyền ngoài ý muốn. */
export function childrenOf(table: string) {
  return FK_EDGES.filter((e) => e.to === table).map((e) => ({ table: e.from, column: e.fromCol }))
}

export interface ListOptions {
  q?: string
  sort?: string
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  branchId?: number | null
  filters?: Record<string, string | number>
}

export function listRows(table: string, opts: ListOptions = {}) {
  const cols = columnsOf(table)
  const { q = '', sort, dir = 'asc', page = 1, pageSize = 25, branchId = null, filters = {} } = opts
  const where: string[] = []
  const params: SqlValue[] = []

  const textCols = cols.filter((c) => /TEXT/i.test(c.type) && !c.pk).map((c) => c.name)
  if (q.trim()) {
    const like = `%${q.trim()}%`
    if (textCols.length) {
      where.push(`(${textCols.map((c) => `COALESCE(CAST(${c} AS TEXT),'') LIKE ?`).join(' OR ')})`)
      textCols.forEach(() => params.push(like))
    }
  }
  if (branchId && cols.some((c) => c.name === 'branch_id')) {
    where.push('branch_id = ?')
    params.push(branchId)
  }
  Object.entries(filters).forEach(([k, v]) => {
    if (!cols.some((c) => c.name === k)) return
    where.push(`${k} = ?`)
    params.push(v)
  })

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const sortCol = cols.find((c) => c.name === sort)?.name
  const orderBy = sortCol ? `ORDER BY ${sortCol} ${dir === 'desc' ? 'DESC' : 'ASC'}` : (() => {
    const pk = pkOf(table)[0]
    const hasCreated = cols.some((c) => c.name === 'created_at')
    if (hasCreated) return `ORDER BY created_at DESC`
    return pk ? `ORDER BY ${pk} DESC` : ''
  })()

  const total = scalar<number>(`SELECT COUNT(*) FROM ${table} ${whereSql}`, params) ?? 0
  const rows = all<Row>(`SELECT * FROM ${table} ${whereSql} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, pageSize, Math.max(0, (page - 1) * pageSize)])
  return { rows, total, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

/** Nhãn hiển thị của bản ghi cha trong dropdown khoá ngoại. */
export function displayLabel(table: string, row: Row): string {
  const cols = columnsOf(table).map((c) => c.name)
  const preferred = ['name', 'label', 'code', 'key', 'title', 'email']
  const key = preferred.find((k) => cols.includes(k) && row[k] != null)
  if (key) return String(row[key])
  const id = pkOf(table).map((k) => row[k]).join('/')
  return `${table}#${id}`
}

const fkCache = new Map<string, { value: SqlValue; label: string }[]>()

export function fkOptions(table: string, column: ColumnMeta) {
  if (!column.fk) return []
  const key = `${column.fk.table}`
  const hit = fkCache.get(key)
  if (hit) return hit
  try {
    const rows = all<Row>(`SELECT * FROM ${column.fk.table} LIMIT 2000`)
    const opts = rows.map((r) => ({ value: r[column.fk!.column] as SqlValue, label: displayLabel(column.fk!.table, r) }))
    fkCache.set(key, opts)
    return opts
  } catch {
    return []
  }
}

export function clearFkCache() { fkCache.clear() }

/* ------------------------------- validate -------------------------------- */

export interface ValidationResult {
  values: Record<string, SqlValue>
  errors: Record<string, string>
}

export function validate(table: string, input: Record<string, string>, mode: 'insert' | 'update'): ValidationResult {
  const cols = columnsOf(table)
  const values: Record<string, SqlValue> = {}
  const errors: Record<string, string> = {}

  cols.forEach((c) => {
    if (!(c.name in input)) return
    const raw = input[c.name]
    if (c.pk && mode === 'update') return
    const isNum = /INT|REAL|DOUBLE|NUMERIC/i.test(c.type)
    if (raw === '' || raw == null) {
      if (!c.nullable && !c.pk) errors[c.name] = 'Bắt buộc nhập'
      else values[c.name] = null
      return
    }
    if (isNum) {
      const n = Number(raw)
      if (!Number.isFinite(n)) { errors[c.name] = 'Phải là số'; return }
      values[c.name] = n
    } else {
      values[c.name] = raw
    }
  })
  return { values, errors }
}

/* --------------------------------- CRUD ---------------------------------- */

function audit(action: string, table: string, key: string, before: Row | null, after: Row | null, userId?: number) {
  try {
    run(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, before_value, after_value, created_at) VALUES (?,?,?,?,?,?,?)`,
      [userId ?? null, action, table, key, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null,
        new Date().toISOString()],
      { silent: true },
    )
  } catch { /* audit không được làm hỏng thao tác chính */ }
}

export function insertRow(table: string, input: Record<string, string>, userId?: number): Row {
  const cols = columnsOf(table)
  const { values, errors } = validate(table, input, 'insert')
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])

  // PK số nguyên: tự tăng
  const pk = cols.find((c) => c.pk && /INT/i.test(c.type))
  if (pk && (values[pk.name] == null || values[pk.name] === '')) {
    values[pk.name] = (scalar<number>(`SELECT COALESCE(MAX(${pk.name}),0) FROM ${table}`) ?? 0) + 1
  }
  // thời điểm tạo
  if (cols.some((c) => c.name === 'created_at') && !values.created_at) values.created_at = new Date().toISOString()

  const keys = Object.keys(values)
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
  run(sql, keys.map((k) => values[k]))
  const inserted = one<Row>(`SELECT * FROM ${table} WHERE ${pk ? `${pk.name} = ?` : keys.map((k) => `${k} = ?`).join(' AND ')}`,
    pk ? [values[pk.name]] : keys.map((k) => values[k]))
  audit('create', table, pk && inserted ? String(inserted[pk.name]) : rowKey(inserted ?? {}, table), null, inserted ?? null, userId)
  return inserted ?? {}
}

const IMMUTABLE = new Set(['id', 'created_at'])

export function updateRow(table: string, pkValues: Row, input: Record<string, string>, userId?: number): Row {
  const cols = columnsOf(table)
  const before = one<Row>(
    `SELECT * FROM ${table} WHERE ${Object.keys(pkValues).map((k) => `${k} = ?`).join(' AND ')}`,
    Object.values(pkValues),
  )
  if (!before) throw new Error('Không tìm thấy bản ghi để sửa')

  const { values, errors } = validate(table, input, 'update')
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const keys = Object.keys(values).filter((k) => !IMMUTABLE.has(k))
  if (!keys.length) throw new Error('Không có thay đổi nào')

  run(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${Object.keys(pkValues).map((k) => `${k} = ?`).join(' AND ')}`,
    [...keys.map((k) => values[k]), ...Object.values(pkValues)])
  const after = one<Row>(`SELECT * FROM ${table} WHERE ${Object.keys(pkValues).map((k) => `${k} = ?`).join(' AND ')}`, Object.values(pkValues))
  audit('update', table, rowKey(before, table), before, after ?? null, userId)
  return after ?? {}
}

export function usageOf(table: string, pkValues: Row): { table: string; column: string; count: number }[] {
  const pk = pkOf(table)[0]
  const idValue = pkValues[pk]
  return childrenOf(table)
    .map((c) => {
      try {
        const count = scalar<number>(`SELECT COUNT(*) FROM ${c.table} WHERE ${c.column} = ?`, [idValue as SqlValue]) ?? 0
        return { ...c, count }
      } catch {
        return { ...c, count: 0 }
      }
    })
    .filter((c) => c.count > 0)
}

export function deleteRow(table: string, pkValues: Row, opts: { force?: boolean; userId?: number } = {}) {
  const before = one<Row>(
    `SELECT * FROM ${table} WHERE ${Object.keys(pkValues).map((k) => `${k} = ?`).join(' AND ')}`,
    Object.values(pkValues),
  )
  if (!before) throw new Error('Không tìm thấy bản ghi')
  const used = usageOf(table, pkValues)
  if (used.length && !opts.force) {
    const detail = used.map((u) => `${u.count} dòng ở ${tableMeta(u.table)?.label ?? u.table}`).join(', ')
    throw new Error(`Không thể xoá: bản ghi đang được dùng bởi ${detail}`)
  }
  if (used.length) {
    // xoá dây chuyền: xoá bảng con trước (chỉ khi người dùng xác nhận force)
    used.forEach((u) => {
      run(`DELETE FROM ${u.table} WHERE ${u.column} = ?`, [pkValues[pkOf(table)[0]] as SqlValue], { silent: true })
    })
  }
  run(`DELETE FROM ${table} WHERE ${Object.keys(pkValues).map((k) => `${k} = ?`).join(' AND ')}`, Object.values(pkValues))
  audit('delete', table, rowKey(before, table), before, null, opts.userId)
  clearFkCache()
  return true
}

export function duplicateRow(table: string, pkValues: Row, userId?: number): Row {
  const src = one<Row>(`SELECT * FROM ${table} WHERE ${Object.keys(pkValues).map((k) => `${k} = ?`).join(' AND ')}`, Object.values(pkValues))
  if (!src) throw new Error('Không tìm thấy bản ghi')
  const cols = columnsOf(table)
  const input: Record<string, string> = {}
  cols.forEach((c) => {
    if (c.pk || c.name === 'created_at') return
    const v = src[c.name]
    if (v == null) return
    if (c.unique && /TEXT/i.test(c.type)) input[c.name] = `${String(v)}_copy`
    else if (c.fk) return // bỏ FK để tránh nhân bản sai quan hệ? vẫn giữ nếu có
    else input[c.name] = String(v)
  })
  // giữ FK gốc
  cols.filter((c) => c.fk && !c.pk).forEach((c) => { if (src[c.name] != null) input[c.name] = String(src[c.name]) })
  return insertRow(table, input, userId)
}

export function countRows(table: string) {
  try { return scalar<number>(`SELECT COUNT(*) FROM ${table}`) ?? 0 } catch { return 0 }
}
