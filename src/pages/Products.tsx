import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Pencil, Plus, Search, Star, CupSoda, Upload } from 'lucide-react'
import { createProduct, getCategories, getProducts, updateProduct, type Product } from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, MoneyInput, Select, Switch, Textarea } from '../components/ui'
import { cx, downloadFile, formatPercent, formatVND, toCSV } from '../lib/format'

export function ProductsPage() {
  const { toast } = useApp()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [catId, setCatId] = useState<number | 'all'>('all')
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const products = useSql(() => getProducts(), [])
  const categories = useSql(() => getCategories(), [])

  const filtered = useMemo(() => {
    const nq = q.toLowerCase()
    return products.filter((p) => (catId === 'all' || p.category_id === catId) && (!nq || p.name.toLowerCase().includes(nq) || p.sku.toLowerCase().includes(nq)))
  }, [products, q, catId])

  const exportCsv = () => {
    downloadFile('thuc-don.csv', toCSV(products.map((p) => ({
      'Mã': p.sku, 'Tên món': p.name, 'Danh mục': p.category_name, 'Giá bán': p.base_price, 'Giá vốn': p.cost_price,
      'Biên LN': p.base_price ? (((p.base_price - p.cost_price) / p.base_price) * 100).toFixed(1) + '%' : '0%',
      'Đang bán': p.is_active ? 'Có' : 'Không', 'Bán chạy': p.is_bestseller ? 'Có' : 'Không',
    }))))
    toast({ title: 'Đã xuất thực đơn CSV', tone: 'success' })
  }

  return (
    <div>
      <PageHeader
        icon={<CupSoda size={20} />}
        title="Thực đơn & sản phẩm"
        description={`${products.length} món · ${products.filter((p) => p.is_active).length} đang bán · giá vốn lấy từ công thức BOM`}
        actions={
          <>
            <Button variant="secondary" icon={<Download size={15} />} onClick={exportCsv}>Xuất CSV</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>Thêm món</Button>
          </>
        }
      />

      <Card className="mb-3 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã món…" className="pl-9" />
        </div>
        <Select value={String(catId)} onChange={(e) => setCatId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="w-auto min-w-[180px]">
          <option value="all">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Món</th><th>Danh mục</th><th className="text-right">Giá bán</th><th className="text-right">Giá vốn</th>
                <th className="text-right">Biên LN</th><th className="text-center">Bán chạy</th><th className="text-center">Đang bán</th><th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const margin = p.base_price ? (p.base_price - p.cost_price) / p.base_price : 0
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-200 text-lg dark:bg-ink-800">{p.emoji}</span>
                        <div>
                          <p className="font-medium text-ink-900 dark:text-ink-50">{p.name}</p>
                          <p className="text-[11px] text-ink-400">{p.sku} · {p.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-ink-500">{p.category_emoji} {p.category_name}</td>
                    <td className="text-right font-semibold tabular-nums">{formatVND(p.base_price)}</td>
                    <td className="text-right tabular-nums text-ink-500">{formatVND(p.cost_price)}</td>
                    <td className={cx('text-right font-medium tabular-nums', margin > 0.6 ? 'text-matcha-600' : margin > 0.4 ? 'text-caramel-600' : 'text-rose-600')}>
                      {formatPercent(margin)}
                    </td>
                    <td className="text-center">
                      <button onClick={() => updateProduct(p.id, { is_bestseller: p.is_bestseller ? 0 : 1 })} aria-label="Bật/tắt bán chạy">
                        <Star size={15} className={p.is_bestseller ? 'text-caramel-500' : 'text-ink-300'} fill={p.is_bestseller ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="text-center"><Switch checked={!!p.is_active} onChange={(v) => updateProduct(p.id, { is_active: v ? 1 : 0 })} label="Đang bán" /></td>
                    <td><Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing(p)}>Sửa</Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState icon={<CupSoda size={20} />} title="Không tìm thấy món" description="Thử từ khoá khác." />}
      </Card>

      {editing && <ProductModal product={editing} categories={categories} onClose={() => setEditing(null)} />}
      {creating && <ProductModal categories={categories} onClose={() => setCreating(false)} />}
    </div>
  )
}

function ProductModal({ product, categories, onClose }: { product?: Product; categories: ReturnType<typeof getCategories>; onClose: () => void }) {
  const toast = useApp((s) => s.toast)
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product?.base_price ?? 45000)
  const [catId, setCatId] = useState(product?.category_id ?? categories[0]?.id ?? 1)
  const [emoji, setEmoji] = useState(product?.emoji ?? '🧋')
  const [desc, setDesc] = useState(product?.description ?? '')
  const [error, setError] = useState('')

  const save = () => {
    if (name.trim().length < 3) return setError('Tên món cần ít nhất 3 ký tự')
    if (price < 1000) return setError('Giá bán tối thiểu 1.000 ₫')
    if (product) {
      updateProduct(product.id, { name, base_price: price, category_id: catId, emoji, description: desc })
      toast({ title: 'Đã cập nhật món', description: name, tone: 'success' })
    } else {
      createProduct({ name, base_price: price, category_id: catId, emoji, description: desc })
      toast({ title: 'Đã thêm món mới', description: `${name} · nhớ cập nhật công thức BOM`, tone: 'success' })
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={product ? `Sửa: ${product.name}` : 'Thêm món mới'} size="md"
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" onClick={save}>{product ? 'Lưu thay đổi' : 'Tạo món'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên món" required className="sm:col-span-2"><Input value={name} onChange={(e) => { setName(e.target.value); setError('') }} placeholder="Trà sữa trân châu đường đen" /></Field>
        <Field label="Danh mục"><Select value={catId} onChange={(e) => setCatId(Number(e.target.value))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</Select></Field>
        <Field label="Icon (emoji)"><Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} /></Field>
        <Field label="Giá bán size M" required error={error}><MoneyInput value={price} onChange={setPrice} /></Field>
        <Field label="Giá vốn hiện tại" hint="Tự tính lại khi sửa công thức"><Input value={formatVND(product?.cost_price ?? 0)} disabled /></Field>
        <Field label="Mô tả" className="sm:col-span-2"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mô tả ngắn hiển thị trên thực đơn" /></Field>
      </div>
      {product && (
        <p className="mt-3 rounded-xl bg-cream-200/70 p-3 text-[11.5px] leading-relaxed text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          Món này có <b>{product.has_size ? '3 size S/M/L' : 'một size'}</b>. Giá vốn và biên lợi nhuận được tính tự động từ
          <b> công thức định lượng</b> ở trang Công thức (BOM) — sửa định lượng sẽ cập nhật lại giá vốn và COGS của mọi đơn mới.
        </p>
      )}
    </Modal>
  )
}
