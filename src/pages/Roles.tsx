import { useMemo, useState } from 'react'
import { Check, Plus, Save, ShieldCheck, ShieldOff, Trash2, UserCog, Users } from 'lucide-react'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { can, refreshRbac } from '../lib/rbac'
import { PERM_GROUPS, getRoles, permsOf, type RoleRow } from '../lib/permissions'
import { getUsers } from '../lib/api'
import { dbEvents, run } from '../lib/db'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Select, Textarea } from '../components/ui'
import { cx, formatNumber } from '../lib/format'

const COLORS = ['#8b5cf6', '#0ea5e9', '#16a34a', '#fb7f14', '#e11d48', '#0891b2', '#64748b', '#f59e0b']

export function RolesPage() {
  const { user, toast } = useApp()
  const allowed = can(user?.role, 'admin.roles')
  const roles = useSql(() => getRoles(), [])
  const users = useSql(() => getUsers(), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<string[] | null>(null)
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null)

  const selected = roles.find((r) => r.id === (selectedId ?? roles[0]?.id)) ?? null
  const perms = draft ?? (selected ? permsOf(selected) : [])
  const dirty = draft != null

  const toggle = (code: string) => {
    const current = draft ?? (selected ? permsOf(selected) : [])
    setDraft(current.includes(code) ? current.filter((p) => p !== code) : [...current, code])
  }

  const save = () => {
    if (!selected) return
    try {
      run('UPDATE roles SET perms = ? WHERE id = ?', [perms.join(','), selected.id])
      setDraft(null)
      refreshRbac()
      toast({ title: 'Đã lưu phân quyền', description: `${selected.name} · ${perms.length} quyền`, tone: 'success' })
    } catch (e) {
      toast({ title: 'Không lưu được', description: (e as Error).message, tone: 'error' })
    }
  }

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id
  const usedBy = useMemo(() => {
    const map: Record<string, number> = {}
    users.forEach((u) => { map[u.role] = (map[u.role] ?? 0) + 1 })
    return map
  }, [users])

  if (!allowed) {
    return (
      <div>
        <PageHeader icon={<ShieldCheck size={20} />} title="Vai trò & phân quyền" description="Quản lý vai trò, quyền theo module và người dùng" />
        <Card className="p-6"><p className="text-[13px] text-rose-600">Vai trò của bạn không có quyền “Vai trò & phân quyền”.</p></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        icon={<ShieldCheck size={20} />}
        title="Vai trò & phân quyền"
        description="RBAC động: thêm vai trò, tick quyền theo từng module, gán cho nhân viên — hiệu lực ngay, không cần build lại app"
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing('new')}>Thêm vai trò</Button>}
      />

      <div className="grid gap-3 lg:grid-cols-[290px_1fr]">
        <Card className="h-fit overflow-hidden">
          <CardHeader title="Vai trò" subtitle={`${roles.length} vai trò · ${users.length} nhân viên`} icon={<ShieldCheck size={16} />} />
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {roles.map((r) => (
              <div key={r.id} className={cx('group px-2.5 py-2 transition',
                selected?.id === r.id ? 'bg-matcha-50 dark:bg-matcha-900/20' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
                <button className="flex w-full items-start gap-2 text-left" onClick={() => { setSelectedId(r.id); setDraft(null) }}>
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color ?? '#64748b' }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-semibold text-ink-900 dark:text-ink-50">{r.name}</span>
                      {r.is_system ? <Badge tone="gray">hệ thống</Badge> : <Badge tone="blue">tuỳ chỉnh</Badge>}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[10.5px] text-ink-400">{r.description}</span>
                    <span className="mt-0.5 block text-[10px] text-ink-500">{permsOf(r).length} quyền · {usedBy[r.id] ?? 0} nhân viên</span>
                  </span>
                </button>
                <div className="mt-1 flex gap-1">
                  <button onClick={() => setEditing(r)} className="rounded px-1.5 py-0.5 text-[10.5px] text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700">Sửa</button>
                  {!r.is_system && (
                    <button onClick={() => {
                      if ((usedBy[r.id] ?? 0) > 0) { toast({ title: 'Không xoá được', description: `Còn ${usedBy[r.id]} nhân viên đang dùng vai trò này`, tone: 'error' }); return }
                      if (!confirm(`Xoá vai trò "${r.name}"?`)) return
                      run('DELETE FROM roles WHERE id = ?', [r.id]); refreshRbac(); setSelectedId(null)
                      toast({ title: 'Đã xoá vai trò', tone: 'success' })
                    }} className="rounded px-1.5 py-0.5 text-[10.5px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">Xoá</button>
                  )}
                </div>
              </div>
            ))}
            {roles.length === 0 && <EmptyState title="Chưa có vai trò" description="Bấm “Thêm vai trò” để tạo" />}
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-2.5 dark:border-ink-800">
              <p className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">
                Ma trận quyền {selected && <span className="text-ink-400">· {selected.name}</span>}
              </p>
              <span className="rounded-full bg-ink-100 px-1.5 text-[10px] text-ink-500 dark:bg-ink-800">{perms.length}/{PERM_GROUPS.reduce((s, g) => s + g.perms.length, 0)}</span>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setDraft(PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.code)))}>Chọn tất cả</Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft([])}>Bỏ chọn</Button>
                <Button size="sm" variant="primary" icon={<Save size={13} />} disabled={!dirty || !selected} onClick={save}>Lưu phân quyền</Button>
              </div>
            </div>
            <div className="grid gap-2 p-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {PERM_GROUPS.map((g) => {
                const on = g.perms.filter((p) => perms.includes(p.code)).length
                return (
                  <div key={g.module} className="rounded-xl border border-ink-200 p-2 dark:border-ink-700">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span>{g.icon}</span>
                      <p className="text-[11.5px] font-semibold text-ink-800 dark:text-ink-100">{g.label}</p>
                      <span className="ml-auto text-[10px] text-ink-400">{on}/{g.perms.length}</span>
                    </div>
                    <div className="space-y-1">
                      {g.perms.map((p) => {
                        const checked = perms.includes(p.code)
                        return (
                          <button key={p.code} onClick={() => toggle(p.code)} title={p.hint}
                            className={cx('flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[11px] transition',
                              checked ? 'bg-matcha-50 text-matcha-800 dark:bg-matcha-900/25 dark:text-matcha-200' : 'text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800')}>
                            <span className={cx('grid h-3.5 w-3.5 shrink-0 place-items-center rounded border',
                              checked ? 'border-matcha-600 bg-matcha-600 text-white' : 'border-ink-300 dark:border-ink-600')}>
                              {checked && <Check size={10} />}
                            </span>
                            <span className="flex-1 truncate">{p.label}</span>
                            <code className="text-[9px] text-ink-300">{p.code}</code>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            {selected?.is_system && (
              <p className="px-3 pb-2 text-[10.5px] text-ink-400">
                Vai trò hệ thống: sửa quyền được, không xoá được (tránh khoá quyền chủ chuỗi).
              </p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Gán vai trò cho nhân viên" subtitle="Đổi vai trò là hiệu lực ngay ở lần đăng nhập kế tiếp" icon={<Users size={16} />} />
            <div className="max-h-[360px] overflow-y-auto">
              <table className="table-base">
                <thead><tr><th>Nhân viên</th><th>Chi nhánh</th><th>Vai trò hiện tại</th><th className="w-[210px]">Đổi vai trò</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-cream-200 dark:bg-ink-800">{u.avatar_emoji ?? '👤'}</span>
                          <div>
                            <p className="font-medium text-ink-900 dark:text-ink-50">{u.name}</p>
                            <p className="text-[10.5px] text-ink-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-[11.5px] text-ink-500">{(u as { branch_name?: string }).branch_name?.replace('Matcha House ', '') ?? '—'}</td>
                      <td><Badge tone={u.role === 'owner' ? 'purple' : 'blue'}>{roleName(u.role)}</Badge></td>
                      <td>
                        <Select value={u.role} className="h-7 text-[11.5px]"
                          onChange={(e) => {
                            run('UPDATE users SET role = ? WHERE id = ?', [e.target.value, u.id])
                            refreshRbac()
                            toast({ title: 'Đã đổi vai trò', description: `${u.name} → ${roleName(e.target.value)}`, tone: 'success' })
                          }}>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-3">
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-700 dark:text-ink-200"><UserCog size={14} /> Cách hoạt động</p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-ink-500 dark:text-ink-400">
              <li>• Quyền nằm trong bảng <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">roles.perms</code> (SQLite + Postgres) — đổi là hiệu lực ngay, menu và nút bấm tự ẩn/hiện.</li>
              <li>• Menu chỉ hiện mục mà vai trò được tick; trang bị chặn sẽ báo “không có quyền”.</li>
              <li>• Thêm vai trò mới (vd “Quản lý kho”, “Cộng tác viên”) → tick quyền → gán cho nhân viên.</li>
              <li>• Mọi thay đổi vai trò/quyền ghi <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">audit_logs</code> khi đẩy dữ liệu lên cloud.</li>
            </ul>
          </Card>
        </div>
      </div>

      {editing && (
        <RoleForm
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setSelectedId(id); setDraft(null) }}
        />
      )}
    </div>
  )
}

function RoleForm({ role, onClose, onSaved }: { role: RoleRow | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { toast } = useApp()
  const [id, setId] = useState(role?.id ?? '')
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [color, setColor] = useState(role?.color ?? COLORS[0])

  const submit = () => {
    const code = (role?.id ?? id).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!code || !name.trim()) { toast({ title: 'Thiếu thông tin', description: 'Cần mã vai trò và tên', tone: 'error' }); return }
    try {
      if (role) {
        run('UPDATE roles SET name = ?, description = ?, color = ? WHERE id = ?', [name.trim(), description.trim(), color, role.id])
      } else {
        const exists = getRoles().some((r) => r.id === code)
        if (exists) { toast({ title: 'Mã vai trò đã tồn tại', description: code, tone: 'error' }); return }
        run('INSERT INTO roles (id, name, description, perms, is_system, color, created_at) VALUES (?,?,?,?,?,?,?)',
          [code, name.trim(), description.trim(), '', 0, color, new Date().toISOString()])
        dbEvents.emit()
      }
      refreshRbac()
      toast({ title: role ? 'Đã cập nhật vai trò' : 'Đã tạo vai trò', description: name.trim(), tone: 'success' })
      onSaved(code)
    } catch (e) {
      toast({ title: 'Không lưu được', description: (e as Error).message, tone: 'error' })
    }
  }

  return (
    <Modal open onClose={onClose} size="sm" title={role ? `Sửa vai trò · ${role.name}` : 'Thêm vai trò mới'}
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" icon={<Save size={14} />} onClick={submit}>Lưu</Button></>}>
      <div className="space-y-2.5">
        {!role && (
          <Field label="Mã vai trò *" hint="chữ thường, không dấu — dùng trong CSDL">
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="warehouse_manager" />
          </Field>
        )}
        <Field label="Tên hiển thị *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Quản lý kho" /></Field>
        <Field label="Mô tả"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn quyền hạn" /></Field>
        <Field label="Màu nhận diện">
          <div className="flex gap-1.5 pt-1">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cx('h-6 w-6 rounded-full border-2 transition', color === c ? 'border-ink-900 dark:border-white' : 'border-transparent')} style={{ background: c }} />
            ))}
          </div>
        </Field>
        <p className="text-[10.5px] text-ink-400">Sau khi tạo, tick quyền ở ma trận bên phải rồi bấm “Lưu phân quyền”.</p>
      </div>
    </Modal>
  )
}
