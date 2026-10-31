import { useState } from 'react'
import { CheckCircle2, PackageCheck, Plus, Receipt, Search, Trash2, Truck, Users } from 'lucide-react'
import {
  createPO, getIngredients, getPurchaseOrders, getPurchaseOrderItems, getSuppliers, markPOOrdered, receivePO, type PurchaseOrder,
} from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, Select, Tabs, Textarea } from '../components/ui'
import { STATUS_LABEL, cx, formatDate, formatNumber, formatVND } from '../lib/format'

const PO_TONE: Record<string, 'gray' | 'amber' | 'green' | 'red'> = { draft: 'gray', ordered: 'amber', received: 'green', cancelled: 'red' }

export function PurchasingPage() {
  const { branchId, user, toast } = useApp()
  const [tab, setTab] = useState<'po' | 'supplier'>('po')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<PurchaseOrder | null>(null)
  const [q, setQ] = useState('')
  const pos = useSql(() => getPurchaseOrders(branchId), [branchId])
  const suppliers = useSql(() => getSuppliers(), [])
  const filtered = pos.filter((p) => !q || p.code.toLowerCase().includes(q.toLowerCase()) || (p.supplier_name ?? '').toLowerCase().includes(q.toLowerCase()))
  const totalDebt = suppliers.reduce((s, x) => s + Number(x.debt), 0)

  return (
    <div>
      <PageHeader
        icon={<Truck size={20} />}
        title="Mua hàng & nhà cung cấp"
        description={`${pos.length} đơn mua · ${suppliers.length} NCC · tổng công nợ ${formatVND(totalDebt, { compact: true })}`}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>Tạo đơn mua (PO)</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'po', label: 'Đơn mua hàng', count: pos.length }, { value: 'supplier', label: 'Nhà cung cấp', count: suppliers.length }]} />
        {tab === 'po' && (
          <div className="relative ml-auto min-w-[240px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã PO hoặc NCC…" className="pl-9" />
          </div>
        )}
      </div>

      {tab === 'po' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Mã PO</th><th>Nhà cung cấp</th><th>Chi nhánh</th><th>Ngày tạo</th><th className="text-center">Mặt hàng</th><th className="text-right">Tổng tiền</th><th>Trạng thái</th><th className="text-center">Thao tác</th></tr></thead>
              <tbody>
                {filtered.map((po) => (
                  <tr key={po.id}>
                    <td className="font-medium text-ink-900 dark:text-ink-50">{po.code}</td>
                    <td className="max-w-[220px] truncate">{po.supplier_name}</td>
                    <td className="text-ink-500">{(po.branch_name ?? '').replace('Matcha House ', '')}</td>
                    <td className="whitespace-nowrap text-ink-500">{formatDate(po.created_at)}</td>
                    <td className="text-center tabular-nums">{po.item_count}</td>
                    <td className="text-right font-semibold tabular-nums">{formatVND(po.total)}</td>
                    <td><Badge tone={PO_TONE[po.status]}>{STATUS_LABEL[po.status] ?? po.status}</Badge></td>
                    <td>
                      <div className="flex justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(po)}>Chi tiết</Button>
                        {po.status === 'draft' && <Button size="sm" variant="secondary" onClick={() => { markPOOrdered(po.id); toast({ title: `Đã gửi ${po.code} cho NCC`, tone: 'success' }) }}>Gửi NCC</Button>}
                        {po.status === 'ordered' && (
                          <Button size="sm" variant="primary" icon={<PackageCheck size={13} />} onClick={() => {
                            if (!user) return
                            receivePO(po.id, user.id)
                            toast({ title: `Đã nhận hàng ${po.code}`, description: 'Tồn kho được cộng, công nợ NCC và sổ chi phí đã ghi nhận.', tone: 'success' })
                          }}>Nhận hàng</Button>
                        )}
                        {po.status === 'received' && <span className="flex items-center gap-1 px-1 text-[11.5px] text-matcha-600"><CheckCircle2 size={13} /> {formatDate(po.received_at)}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <EmptyState icon={<Receipt size={20} />} title="Chưa có đơn mua nào" />}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Mã</th><th>Nhà cung cấp</th><th>Liên hệ</th><th>Điều khoản</th><th className="text-right">Công nợ</th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-ink-900 dark:text-ink-50">{s.code}</td>
                    <td>{s.name}</td>
                    <td className="text-ink-500">{s.contact_name} · {s.phone}</td>
                    <td className="text-ink-500">{s.payment_terms}</td>
                    <td className={cx('text-right font-semibold tabular-nums', Number(s.debt) > 0 ? 'text-caramel-700' : 'text-ink-400')}>{formatVND(s.debt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {creating && <CreatePOModal onClose={() => setCreating(false)} suppliers={suppliers} branchId={branchId} />}
      {detail && <PODetailModal po={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function PODetailModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const items = useSql(() => getPurchaseOrderItems(po.id), [po.id])
  return (
    <Modal open onClose={onClose} title={`Đơn mua ${po.code}`} description={`${po.supplier_name} · ${po.branch_name} · ${STATUS_LABEL[po.status] ?? po.status}`} size="md">
      <table className="table-base">
        <thead><tr><th>Nguyên liệu</th><th className="text-right">Số lượng</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="font-medium text-ink-900 dark:text-ink-50">{i.ingredient_name}</td>
              <td className="text-right tabular-nums">{formatNumber(i.qty)} {i.unit}</td>
              <td className="text-right tabular-nums">{formatVND(i.unit_cost)}</td>
              <td className="text-right font-medium tabular-nums">{formatVND(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 space-y-1 rounded-xl bg-ink-50 p-3 text-[12.5px] dark:bg-ink-800/60">
        <div className="flex justify-between"><dt className="text-ink-500">Tiền hàng</dt><dd className="tabular-nums">{formatVND(po.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">VAT</dt><dd className="tabular-nums">{formatVND(po.vat)}</dd></div>
        <div className="flex justify-between border-t border-ink-200 pt-1 font-bold dark:border-ink-700"><dt>Tổng</dt><dd className="tabular-nums text-matcha-700 dark:text-matcha-300">{formatVND(po.total)}</dd></div>
      </dl>
      {po.note && <p className="mt-2 text-[12px] text-ink-500">Ghi chú: {po.note}</p>}
    </Modal>
  )
}

function CreatePOModal({ onClose, suppliers, branchId }: { onClose: () => void; suppliers: ReturnType<typeof getSuppliers>; branchId: number }) {
  const { user, toast } = useApp()
  const ingredients = useSql(() => getIngredients(), [])
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? 1)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<{ ingredientId: number; qty: number; unitCost: number }[]>([
    { ingredientId: ingredients[0]?.id ?? 1, qty: 100, unitCost: ingredients[0]?.unit_cost ?? 1000 },
  ])
  const total = lines.reduce((s, l) => s + l.qty * l.unitCost, 0)

  return (
    <Modal open onClose={onClose} title="Tạo đơn mua hàng (PO)" description="Chọn nguyên liệu và số lượng — nhận hàng sẽ tự cộng tồn kho" size="lg"
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" disabled={!lines.length} onClick={() => {
        if (!user) return
        const res = createPO({ supplierId, branchId, userId: user.id, note, items: lines })
        toast({ title: `Đã tạo ${res.code}`, description: 'Bấm "Gửi NCC" rồi "Nhận hàng" để hoàn tất quy trình.', tone: 'success' })
        onClose()
      }}>Tạo đơn · {formatVND(total)}</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nhà cung cấp"><Select value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Chi nhánh nhận"><Input value={`Chi nhánh ${branchId}`} disabled /></Field>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-700 dark:text-ink-200">Mặt hàng</span>
            <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => setLines([...lines, { ingredientId: ingredients[0]?.id ?? 1, qty: 50, unitCost: ingredients[0]?.unit_cost ?? 1000 }])}>Thêm dòng</Button>
          </div>
          <div className="space-y-1.5">
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_84px_110px_28px] items-center gap-1.5">
                <Select value={l.ingredientId} className="h-9 text-[12px]" onChange={(e) => {
                  const ing = ingredients.find((i) => i.id === Number(e.target.value))
                  setLines(lines.map((x, i) => (i === idx ? { ...x, ingredientId: Number(e.target.value), unitCost: ing?.unit_cost ?? x.unitCost } : x)))
                }}>
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </Select>
                <Input type="number" className="h-9 text-[12px]" value={l.qty} onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, qty: Number(e.target.value) } : x)))} />
                <Input type="number" className="h-9 text-[12px]" value={l.unitCost} onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, unitCost: Number(e.target.value) } : x)))} />
                <IconButton label="Xoá" className="h-8 w-8 text-rose-500" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 size={14} /></IconButton>
              </div>
            ))}
          </div>
        </div>
        <Field label="Ghi chú"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Đề xuất từ cảnh báo tồn kho thấp…" /></Field>
      </div>
    </Modal>
  )
}
