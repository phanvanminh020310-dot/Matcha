import { useMemo, useState } from 'react'
import { BookOpenCheck, Plus, Search, Trash2, Zap } from 'lucide-react'
import { deleteRecipeLine, getIngredients, getProducts, getRecipes, recipeCost, setRecipeLine, type Product } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, Select } from '../components/ui'
import { cx, formatNumber, formatPercent, formatVND } from '../lib/format'

export function RecipesPage() {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const products = useSql(() => getProducts(), [])
  const filtered = useMemo(() => products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())), [products, q])
  const current = selected ?? filtered[0] ?? null

  return (
    <div>
      <PageHeader
        icon={<BookOpenCheck size={20} />}
        title="Công thức & định lượng (BOM)"
        description="Mỗi món × size là một tập nguyên liệu. Khi bán, hệ thống trừ kho đúng theo bảng này và tính COGS từ giá vốn nguyên liệu."
      />
      <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-3 dark:border-ink-800">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm món…" className="pl-9" />
            </div>
          </div>
          <ul className="max-h-[calc(100dvh-260px)] divide-y divide-ink-100 overflow-y-auto dark:divide-ink-800">
            {filtered.map((p) => (
              <li key={p.id}>
                <button onClick={() => setSelected(p)}
                  className={cx('flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                    current?.id === p.id ? 'bg-matcha-50 dark:bg-matcha-900/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                  <span className="text-lg">{p.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink-900 dark:text-ink-50">{p.name}</p>
                    <p className="text-[10.5px] text-ink-400">{p.sku} · vốn {formatVND(p.cost_price)}</p>
                  </div>
                  {current?.id === p.id && <Badge tone="green">đang xem</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {current ? <RecipeDetail product={current} /> : <Card><EmptyState title="Chọn một món để xem công thức" /></Card>}
      </div>
    </div>
  )
}

function RecipeDetail({ product }: { product: Product }) {
  const toast = useApp((s) => s.toast)
  const lines = useSql(() => getRecipes(product.id), [product.id])
  const ingredients = useSql(() => getIngredients(), [])
  const [addOpen, setAddOpen] = useState(false)
  const [size, setSize] = useState<'S' | 'M' | 'L'>('M')
  const [ingId, setIngId] = useState(ingredients[0]?.id ?? 1)
  const [qty, setQty] = useState(10)

  const sizes: ('S' | 'M' | 'L')[] = product.has_size ? ['S', 'M', 'L'] : ['M']
  const costBySize = sizes.map((s) => ({ size: s, cost: recipeCost(product.id, s) }))
  const costM = costBySize.find((c) => c.size === 'M')?.cost ?? 0
  const margin = product.base_price ? (product.base_price - costM) / product.base_price : 0

  return (
    <Card>
      <CardHeader
        title={`${product.emoji} ${product.name}`}
        subtitle={`${product.sku} · giá bán ${formatVND(product.base_price)} · ${lines.length} dòng định lượng`}
        icon={<BookOpenCheck size={16} />}
        right={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>Thêm nguyên liệu</Button>}
      />
      <div className="grid gap-3 border-b border-ink-100 p-4 sm:grid-cols-3 dark:border-ink-800">
        {sizes.map((s) => {
          const c = costBySize.find((x) => x.size === s)?.cost ?? 0
          const delta = s === 'S' ? -4000 : s === 'L' ? 6000 : 0
          const price = product.base_price + delta
          return (
            <div key={s} className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Size {s}</p>
              <p className="mt-1 text-[17px] font-semibold text-ink-900 dark:text-ink-50">{formatVND(price)}</p>
              <p className="text-[11.5px] text-ink-500">Giá vốn {formatVND(c)}</p>
              <p className={cx('text-[11.5px] font-medium', price && (price - c) / price > 0.55 ? 'text-matcha-600' : 'text-caramel-600')}>
                Lãi gộp {formatVND(price - c)} ({formatPercent(price ? (price - c) / price : 0)})
              </p>
            </div>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Nguyên liệu</th><th>Nhóm</th><th>Size</th><th className="text-right">Định lượng</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th><th /></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="font-medium text-ink-900 dark:text-ink-50">{l.ingredient_name}</td>
                <td className="text-ink-500">{ingredients.find((i) => i.id === l.ingredient_id)?.category}</td>
                <td><Badge tone={l.size_code === 'M' ? 'green' : 'gray'}>{l.size_code}</Badge></td>
                <td className="text-right">
                  <input
                    type="number"
                    defaultValue={l.qty}
                    onBlur={(e) => {
                      const v = Number(e.target.value)
                      if (v > 0 && v !== l.qty) { setRecipeLine(product.id, l.size_code, l.ingredient_id, v); toast({ title: 'Đã cập nhật định lượng', description: `${l.ingredient_name}: ${l.qty} → ${v} ${l.unit}`, tone: 'success' }) }
                    }}
                    className="w-20 rounded-lg border border-ink-200 px-2 py-1 text-right text-[12.5px] tabular-nums focus:border-matcha-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900"
                  /> <span className="text-[11px] text-ink-400">{l.unit}</span>
                </td>
                <td className="text-right tabular-nums text-ink-500">{formatVND(l.unit_cost)}</td>
                <td className="text-right font-medium tabular-nums">{formatVND(l.line_cost)}</td>
                <td><IconButton label="Xoá dòng" className="h-7 w-7 text-rose-500 hover:bg-rose-50" onClick={() => deleteRecipeLine(l.id)}><Trash2 size={13} /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lines.length === 0 && <EmptyState icon={<Zap size={20} />} title="Món này chưa có công thức" description="Thêm nguyên liệu để hệ thống trừ kho và tính giá vốn khi bán." />}

      <div className="flex items-center gap-2 border-t border-ink-100 bg-ink-50/60 px-4 py-2.5 text-[12px] text-ink-500 dark:border-ink-800 dark:bg-ink-950/40">
        <Zap size={14} className="text-matcha-600" />
        Mỗi ly bán ra sẽ trừ kho đúng số lượng này (nhân số ly) và ghi một dòng vào thẻ kho với <code className="rounded bg-ink-200/70 px-1 dark:bg-ink-800">ref_type = 'orders'</code>.
      </div>

      {addOpen && (
        <Modal open onClose={() => setAddOpen(false)} title="Thêm nguyên liệu vào công thức" size="sm"
          footer={<><Button onClick={() => setAddOpen(false)}>Huỷ</Button>
            <Button variant="primary" onClick={() => { setRecipeLine(product.id, size, ingId, qty); setAddOpen(false); toast({ title: 'Đã thêm dòng công thức', tone: 'success' }) }}>Thêm</Button></>}>
          <div className="space-y-3">
            <Field label="Size"><Select value={size} onChange={(e) => setSize(e.target.value as any)}>{sizes.map((s) => <option key={s} value={s}>Size {s}</option>)}</Select></Field>
            <Field label="Nguyên liệu">
              <Select value={ingId} onChange={(e) => setIngId(Number(e.target.value))}>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit}) · {formatVND(i.unit_cost)}/{i.unit}</option>)}
              </Select>
            </Field>
            <Field label="Định lượng" hint="Số lượng theo đơn vị của nguyên liệu"><Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
          </div>
        </Modal>
      )}
    </Card>
  )
}
