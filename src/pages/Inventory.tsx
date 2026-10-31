import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeftRight, Boxes, ClipboardList, Download, PackageMinus, PackagePlus, Search, Sparkles, Trash2, X } from 'lucide-react'
import {
  createStockOp, getBranches, getIngredients, getStock, getStockMovements, lowStock, transferStock, type Ingredient, type StockRow,
} from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, MoneyInput, ProgressBar, Select, Tabs, Textarea } from '../components/ui'
import { cx, downloadFile, formatNumber, formatVND, toCSV } from '../lib/format'

const TXN_LABEL: Record<string, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple' }> = {
  in: { label: 'Nhập kho', tone: 'green' }, out: { label: 'Xuất kho', tone: 'amber' }, sale: { label: 'Bán hàng', tone: 'blue' },
  waste: { label: 'Hao hụt / huỷ', tone: 'red' }, adjust: { label: 'Điều chỉnh', tone: 'purple' },
  transfer_in: { label: 'Nhận chuyển', tone: 'green' }, transfer_out: { label: 'Chuyển đi', tone: 'amber' },
}

export function InventoryPage() {
  const { branchId, user, toast } = useApp()
  const [tab, setTab] = useState<'stock' | 'movements' | 'suggest'>('stock')
  const [q, setQ] = useState('')
  const [op, setOp] = useState<{ type: 'in' | 'out' | 'waste' | 'adjust'; item: StockRow } | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const branches = useSql(() => getBranches(), [])
  const stock = useSql(() => getStock(branchId), [branchId])
  const alerts = useSql(() => lowStock(branchId), [branchId])
  const movements = useSql(() => getStockMovements(branchId, 300), [branchId])

  const filtered = useMemo(() => stock.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase())), [stock, q])
  const totalValue = stock.reduce((s, r) => s + Number(r.qty) * Number(r.avg_cost), 0)
  const lowCount = stock.filter((s) => Number(s.qty) < Number(s.min_stock)).length

  return (
    <div>
      <PageHeader
        icon={<Boxes size={20} />}
        title="Kho & nguyên liệu"
        description={`${stock.length} nguyên liệu · giá trị tồn ${formatVND(totalValue, { compact: true })} · ${lowCount} mục dưới định mức`}
        actions={
          <>
            <Button variant="secondary" icon={<ArrowLeftRight size={15} />} onClick={() => setTransferOpen(true)}>Chuyển kho</Button>
            <Button variant="secondary" icon={<Download size={15} />} onClick={() => {
              downloadFile('ton-kho.csv', toCSV(stock.map((s) => ({ 'Nguyên liệu': s.name, 'Nhóm': s.category, 'Tồn': s.qty, 'Đơn vị': s.unit, 'Định mức': s.min_stock, 'Giá vốn': s.avg_cost, 'Giá trị': Math.round(Number(s.qty) * Number(s.avg_cost)) }))))
              toast({ title: 'Đã xuất tồn kho CSV', tone: 'success' })
            }}>Xuất CSV</Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'stock', label: 'Tồn kho', count: stock.length },
          { value: 'movements', label: 'Thẻ kho', count: movements.length },
          { value: 'suggest', label: 'Đề xuất nhập', count: alerts.length },
        ]} />
        {tab === 'stock' && (
          <div className="relative ml-auto min-w-[220px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nguyên liệu…" className="pl-9" />
          </div>
        )}
      </div>

      {tab === 'stock' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Nguyên liệu</th><th>Nhóm</th><th className="text-right">Tồn</th><th className="text-right">Định mức</th><th className="w-28">Mức tồn</th><th className="text-right">Giá vốn</th><th className="text-right">Giá trị tồn</th><th className="text-center">Thao tác</th></tr></thead>
              <tbody>
                {filtered.map((s) => {
                  const ratio = Number(s.min_stock) ? Number(s.qty) / Number(s.min_stock) : 1
                  const low = ratio < 1
                  return (
                    <tr key={s.ingredient_id}>
                      <td className="font-medium text-ink-900 dark:text-ink-50">{s.name}</td>
                      <td className="text-ink-500">{s.category}</td>
                      <td className={cx('text-right font-semibold tabular-nums', low && 'text-rose-600')}>{formatNumber(s.qty, 1)} <span className="text-[11px] font-normal text-ink-400">{s.unit}</span></td>
                      <td className="text-right tabular-nums text-ink-500">{formatNumber(s.min_stock)}</td>
                      <td><ProgressBar value={Math.min(1, ratio / 1.5)} tone={ratio < 0.6 ? 'red' : ratio < 1 ? 'amber' : 'green'} /></td>
                      <td className="text-right tabular-nums text-ink-500">{formatVND(s.avg_cost)}</td>
                      <td className="text-right tabular-nums">{formatVND(Number(s.qty) * Number(s.avg_cost), { compact: true })}</td>
                      <td>
                        <div className="flex justify-center gap-0.5">
                          <button title="Nhập kho" onClick={() => setOp({ type: 'in', item: s })} className="rounded-lg p-1.5 text-matcha-600 hover:bg-matcha-50"><PackagePlus size={15} /></button>
                          <button title="Xuất kho" onClick={() => setOp({ type: 'out', item: s })} className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50"><PackageMinus size={15} /></button>
                          <button title="Hao hụt / huỷ" onClick={() => setOp({ type: 'waste', item: s })} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
                          <button title="Kiểm kê điều chỉnh" onClick={() => setOp({ type: 'adjust', item: s })} className="rounded-lg p-1.5 text-violet-600 hover:bg-violet-50"><ClipboardList size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <EmptyState icon={<Boxes size={20} />} title="Không có nguyên liệu" />}
        </Card>
      )}

      {tab === 'movements' && (
        <Card className="overflow-hidden">
          <CardHeader title="Thẻ kho" subtitle="30 ngày gần nhất ghi theo từng đơn, xa hơn ghi gộp theo ngày" icon={<ClipboardList size={16} />} />
          <div className="max-h-[calc(100dvh-260px)] overflow-auto">
            <table className="table-base">
              <thead><tr><th>Thời điểm</th><th>Nguyên liệu</th><th>Loại</th><th className="text-right">Số lượng</th><th className="text-right">Giá vốn</th><th>Tham chiếu</th><th>Diễn giải</th><th>Người thực hiện</th></tr></thead>
              <tbody>
                {movements.map((m) => {
                  const meta = TXN_LABEL[m.txn_type] ?? { label: m.txn_type, tone: 'gray' as const }
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-ink-500">{m.created_at.slice(0, 16)}</td>
                      <td className="font-medium text-ink-900 dark:text-ink-50">{m.ingredient_name}</td>
                      <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className={cx('text-right font-semibold tabular-nums', Number(m.qty) < 0 ? 'text-rose-600' : 'text-matcha-600')}>
                        {Number(m.qty) > 0 ? '+' : ''}{formatNumber(m.qty, 1)} {m.unit}
                      </td>
                      <td className="text-right tabular-nums text-ink-500">{formatVND(m.unit_cost)}</td>
                      <td className="text-[11px] text-ink-400">{m.ref_type}{m.ref_id ? `#${m.ref_id}` : ''}</td>
                      <td className="max-w-[240px] truncate text-ink-500">{m.note}</td>
                      <td className="text-ink-500">{m.user_name ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'suggest' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Nguyên liệu dưới định mức" subtitle={`${alerts.length} mục cần nhập thêm`} icon={<AlertTriangle size={16} />} />
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {alerts.length === 0 && <li className="py-8 text-center text-[13px] text-ink-400">Tất cả nguyên liệu đều trên định mức 🎉</li>}
              {alerts.map((a) => (
                <li key={`${a.branch_id}-${a.ingredient_id}`} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink-900 dark:text-ink-50">{a.name}</p>
                    <p className="text-[10.5px] text-ink-400">Tồn {formatNumber(a.qty, 1)}{a.unit} / định mức {formatNumber(a.min_stock)}{a.unit}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setOp({ type: 'in', item: a })} icon={<PackagePlus size={13} />}>Nhập</Button>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Cách hệ thống tính đề xuất" icon={<Sparkles size={16} />} />
            <div className="space-y-2 p-4 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
              <p>• Mức tiêu thụ bình quân 30 ngày gần nhất theo từng nguyên liệu.</p>
              <p>• Ngưỡng cảnh báo = định mức tồn tối thiểu × 1,15 (vùng đệm an toàn).</p>
              <p>• Số lượng đề xuất nhập = mức tiêu thụ 7 ngày + (định mức − tồn hiện tại).</p>
              <p className="rounded-lg bg-matcha-50 p-2.5 text-matcha-900 dark:bg-matcha-900/30 dark:text-matcha-100">
                Mở trang <b>Mua hàng &amp; NCC</b> để tạo đơn đặt hàng (PO) từ danh sách này, sau đó bấm <b>Nhận hàng</b> để cộng tồn kho và ghi công nợ.
              </p>
            </div>
          </Card>
        </div>
      )}

      {op && <StockOpModal type={op.type} item={op.item} onClose={() => setOp(null)} />}
      {transferOpen && <TransferModal onClose={() => setTransferOpen(false)} branches={branches} />}
    </div>
  )
}

function StockOpModal({ type, item, onClose }: { type: 'in' | 'out' | 'waste' | 'adjust'; item: StockRow; onClose: () => void }) {
  const { branchId, user, toast } = useApp()
  const ingredients = useSql(() => getIngredients(), [])
  const ing = ingredients.find((i) => i.id === item.ingredient_id)
  const [qty, setQty] = useState(type === 'adjust' ? Number(item.qty) : 0)
  const [cost, setCost] = useState(Number(item.avg_cost))
  const [note, setNote] = useState('')

  const titles = { in: 'Nhập kho', out: 'Xuất kho', waste: 'Hao hụt / huỷ', adjust: 'Kiểm kê điều chỉnh' }
  const finalQty = type === 'adjust' ? qty : Number(item.qty) + (type === 'in' ? Math.abs(qty) : -Math.abs(qty))

  return (
    <Modal open onClose={onClose} title={titles[type]} description={`${item.name} · tồn hiện tại ${formatNumber(item.qty, 1)} ${item.unit}`} size="sm"
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" disabled={!qty && type !== 'adjust'} onClick={() => {
        if (!user) return
        createStockOp({ branchId, ingredientId: item.ingredient_id, qty: type === 'adjust' ? qty - Number(item.qty) : Math.abs(qty), type, note: note || titles[type], userId: user.id, unitCost: cost })
        toast({ title: `${titles[type]} thành công`, description: `${item.name}: ${formatNumber(item.qty, 1)} → ${formatNumber(finalQty, 1)} ${item.unit}`, tone: 'success' })
        onClose()
      }}>Xác nhận</Button></>}>
      <div className="space-y-3">
        <Field label={type === 'adjust' ? 'Tồn thực tế sau kiểm kê' : 'Số lượng'} hint={`Đơn vị: ${item.unit}`}>
          <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} autoFocus />
        </Field>
        {type === 'in' && <Field label="Đơn giá nhập"><MoneyInput value={cost} onChange={setCost} /></Field>}
        <Field label="Diễn giải"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: nhập từ NCC Trà Việt Nam, hàng hỏng do ẩm…" /></Field>
        <p className="rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
          Tồn sau thao tác: <b>{formatNumber(finalQty, 1)} {item.unit}</b> · định mức {formatNumber(item.min_stock)}
        </p>
      </div>
    </Modal>
  )
}

function TransferModal({ onClose, branches }: { onClose: () => void; branches: ReturnType<typeof getBranches> }) {
  const { branchId, user, toast } = useApp()
  const ingredients = useSql(() => getIngredients(), [])
  const [toBranch, setToBranch] = useState(branches.find((b) => b.id !== branchId)?.id ?? 1)
  const [ingId, setIngId] = useState(ingredients[0]?.id ?? 1)
  const [qty, setQty] = useState(100)

  return (
    <Modal open onClose={onClose} title="Chuyển kho giữa chi nhánh" size="sm"
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" disabled={!qty} onClick={() => {
        if (!user) return
        transferStock(branchId, toBranch, ingId, qty, user.id)
        toast({ title: 'Đã chuyển kho', description: `${qty} ${ingredients.find((i) => i.id === ingId)?.unit} tới chi nhánh ${toBranch}`, tone: 'success' })
        onClose()
      }}>Chuyển</Button></>}>
      <div className="space-y-3">
        <Field label="Từ chi nhánh"><Input value={branches.find((b) => b.id === branchId)?.name ?? ''} disabled /></Field>
        <Field label="Đến chi nhánh"><Select value={toBranch} onChange={(e) => setToBranch(Number(e.target.value))}>{branches.filter((b) => b.id !== branchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
        <Field label="Nguyên liệu"><Select value={ingId} onChange={(e) => setIngId(Number(e.target.value))}>{ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</Select></Field>
        <Field label="Số lượng"><Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
      </div>
    </Modal>
  )
}
