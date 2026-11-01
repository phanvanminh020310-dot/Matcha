import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Barcode, Copy, Download, FileText, Layers, Plus, Printer, QrCode, Save, Settings2, Trash2, Type,
} from 'lucide-react'
import {
  DEFAULT_TEMPLATES, KIND_LABEL, PAPERS, getPath, printTemplate, renderTemplateBody, mountCodes, templateHtml,
  type PaperKind, type PrintBlock, type PrintTemplate,
} from '../lib/print'
import { buildCupCtx, buildOrderCtx, buildPriceTagCtx, buildShiftCtx, buildStocktakeCtx } from '../lib/printData'
import { all } from '../lib/db'
import {
  deletePrintTemplate, getPrintJobs, getPrintTemplates, logPrintJob, savePrintTemplate, setDefaultTemplate,
} from '../lib/api'
import { useSql, useDbVersion } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Input, Modal, Select, Tabs, Textarea } from '../components/ui'
import { cx, formatDateTime, formatVND } from '../lib/format'

const BLOCK_LIBRARY: { type: PrintBlock['type']; label: string; icon: string; hint: string }[] = [
  { type: 'text', label: 'Dòng chữ', icon: 'T', hint: 'Chữ tự do, hỗ trợ {{biến}}' },
  { type: 'logo', label: 'Tên quán', icon: '🏬', hint: 'Tiêu đề lớn' },
  { type: 'fields', label: 'Cặp nhãn–giá trị', icon: '≡', hint: 'Số HĐ, thời gian, khách…' },
  { type: 'items', label: 'Bảng món', icon: '🍵', hint: 'Danh sách món + topping' },
  { type: 'totals', label: 'Tổng tiền', icon: '₫', hint: 'Tạm tính, giảm giá, VAT' },
  { type: 'payments', label: 'Thanh toán', icon: '💳', hint: 'Phương thức đã thu' },
  { type: 'qr', label: 'Mã QR', icon: '▦', hint: 'VietQR hoặc link theo dõi' },
  { type: 'barcode', label: 'Barcode', icon: '||', hint: 'Code128' },
  { type: 'table', label: 'Bảng dữ liệu', icon: '▤', hint: 'Kiểm kê / chốt ca' },
  { type: 'signatures', label: 'Ô chữ ký', icon: '✍️', hint: 'Người giao / người nhận' },
  { type: 'divider', label: 'Đường kẻ', icon: '—', hint: 'Ngăn cách' },
  { type: 'spacer', label: 'Khoảng trống', icon: '␣', hint: 'Tạo khoảng nghỉ' },
  { type: 'note', label: 'Ghi chú', icon: '✎', hint: 'Cỡ chữ nhỏ' },
]

const VAR_HINTS = ['{{order.code}}', '{{order.created_at|datetime}}', '{{order.channel_label}}', '{{order.place}}', '{{order.queue_label}}',
  '{{customer.name}}', '{{customer.phone}}', '{{branch.name}}', '{{branch.address}}', '{{cashier}}', '{{item.name}}', '{{item.size}}',
  '{{item.toppings}}', '{{delivery.code}}', '{{delivery.address}}', '{{delivery.cod}}', '{{order.track_url}}', '{{vietqr}}']

type TabKey = 'design' | 'bulk' | 'queue'

export function PrintStudioPage() {
  const { user, branchId, toast } = useApp()
  const [tab, setTab] = useState<TabKey>('design')
  const dbVersion = useDbVersion()
  const stored = useSql(() => getPrintTemplates(), [dbVersion])
  const [editing, setEditing] = useState<PrintTemplate | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)

  const templates = useMemo<PrintTemplate[]>(() => {
    const fromDb = stored.map((t) => ({
      code: t.code, name: t.name, kind: t.kind as PrintTemplate['kind'], paper: t.paper as PaperKind,
      widthMm: t.width_mm, blocks: safeParse(t.layout), isDefault: t.is_default,
    })) as (PrintTemplate & { isDefault?: number })[]
    return fromDb.length ? fromDb : DEFAULT_TEMPLATES
  }, [stored])

  const startEdit = (t: PrintTemplate) => { setEditing(structuredClone(t)); setSelectedBlock(null) }
  const addBlock = (type: PrintBlock['type']) => {
    if (!editing) return
    const def = defaultBlock(type)
    setEditing({ ...editing, blocks: [...editing.blocks, def] })
    setSelectedBlock(def.id)
  }
  const patchBlock = (id: string, patch: Partial<PrintBlock>) => {
    if (!editing) return
    setEditing({ ...editing, blocks: editing.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  }
  const moveBlock = (id: string, dir: -1 | 1) => {
    if (!editing) return
    const idx = editing.blocks.findIndex((b) => b.id === id)
    const target = idx + dir
    if (target < 0 || target >= editing.blocks.length) return
    const next = [...editing.blocks]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setEditing({ ...editing, blocks: next })
  }
  const removeBlock = (id: string) => {
    if (!editing) return
    setEditing({ ...editing, blocks: editing.blocks.filter((b) => b.id !== id) })
    setSelectedBlock(null)
  }

  const sampleOrderId = useSql(() => {
    const row = editing?.kind === 'delivery_note'
      ? all<{ id: number }>('SELECT o.id FROM orders o JOIN deliveries d ON d.order_id = o.id ORDER BY o.id DESC LIMIT 1')
      : all<{ id: number }>(`SELECT id FROM orders WHERE status != 'cancelled' ORDER BY id DESC LIMIT 1`)
    return row[0]?.id ?? null
  }, [dbVersion, editing?.kind])

  const sampleCtx = useMemo<Record<string, unknown>>(() => {
    if (!editing) return {}
    if (editing.kind === 'cup_label' && sampleOrderId) return buildCupCtx(sampleOrderId, 0, user?.name) ?? {}
    if (editing.kind === 'stocktake') return buildStocktakeCtx(branchId)
    if (editing.kind === 'shift_report') {
      const s = all<{ id: number }>('SELECT id FROM shifts ORDER BY id DESC LIMIT 1')
      return s[0] ? buildShiftCtx(s[0].id) : {}
    }
    if (editing.kind === 'price_tag') {
      const p = all<{ id: number }>('SELECT id FROM products ORDER BY id LIMIT 1')
      return p[0] ? buildPriceTagCtx(p[0].id) : {}
    }
    return sampleOrderId ? buildOrderCtx(sampleOrderId, { cashier: user?.name }) ?? {} : {}
  }, [editing?.code, editing?.kind, sampleOrderId, branchId, user?.name])

  const block = editing?.blocks.find((b) => b.id === selectedBlock) ?? null

  return (
    <div>
      <PageHeader icon={<Printer size={20} />} title="Studio in ấn"
        description="Thiết kế mẫu in, xem trước đúng khổ giấy, in thật qua máy in hoá đơn hoặc xuất PDF"
        actions={
          <>
            {editing && <Button icon={<Save size={15} />} onClick={() => {
              savePrintTemplate({ code: editing.code, name: editing.name, kind: editing.kind, paper: editing.paper, widthMm: PAPERS[editing.paper].widthMm, blocks: editing.blocks })
              toast({ title: 'Đã lưu mẫu in', description: editing.name, tone: 'success' })
            }}>Lưu mẫu</Button>}
            {editing && <Button variant="primary" icon={<Printer size={15} />} onClick={async () => {
              await printTemplate(editing, sampleCtx, { title: editing.name })
              logPrintJob({ templateCode: editing.code, copies: 1, status: 'printed', printer: 'Hộp thoại in', userId: user?.id ?? null, payload: JSON.stringify({ preview: true }) })
              toast({ title: 'Đã gửi lệnh in thử', tone: 'success' })
            }}>In thử</Button>}
          </>
        } />

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'design' as TabKey, label: 'Thiết kế mẫu', count: templates.length },
        { value: 'bulk' as TabKey, label: 'In hàng loạt' },
        { value: 'queue' as TabKey, label: 'Hàng đợi in' },
      ]} />

      {tab === 'design' && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => {
              const isDefault = (t as PrintTemplate & { isDefault?: number }).isDefault === 1
              return (
                <button key={t.code} onClick={() => startEdit(t)}
                  className={cx('rounded-xl border px-3 py-2 text-left transition',
                    editing?.code === t.code ? 'border-matcha-500 bg-matcha-50 dark:bg-matcha-900/20' : 'border-ink-200 bg-white hover:border-matcha-300 dark:border-ink-700 dark:bg-ink-900')}>
                  <div className="flex items-center gap-1.5">
                    <FileText size={13} className="text-ink-400" />
                    <span className="text-[12.5px] font-medium text-ink-900 dark:text-ink-50">{t.name}</span>
                    {isDefault && <Badge tone="green">mặc định</Badge>}
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-ink-400">{KIND_LABEL[t.kind]} · {PAPERS[t.paper].label.split(' — ')[0]}</p>
                </button>
              )
            })}
          </div>

          {!editing && (
            <Card className="p-6">
              <EmptyState title="Chọn một mẫu để thiết kế" description="Hoặc tạo mẫu mới từ thư viện khối bên dưới sau khi chọn mẫu." />
              <div className="mt-3 flex justify-center gap-2">
                <Button icon={<Plus size={15} />} onClick={() => {
                  const t: PrintTemplate = { ...structuredClone(DEFAULT_TEMPLATES[0]), code: `custom-${Date.now().toString(36)}`, name: 'Mẫu hoá đơn mới' }
                  savePrintTemplate({ code: t.code, name: t.name, kind: t.kind, paper: t.paper, widthMm: t.widthMm, blocks: t.blocks })
                  startEdit(t)
                }}>Tạo mẫu hoá đơn mới</Button>
              </div>
            </Card>
          )}

          {editing && (
            <div className="grid gap-3 xl:grid-cols-[210px_minmax(0,1fr)_390px]">
              {/* thư viện khối */}
              <Card className="p-2">
                <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Thư viện khối</p>
                <div className="grid grid-cols-2 gap-1">
                  {BLOCK_LIBRARY.map((b) => (
                    <button key={b.type} onClick={() => addBlock(b.type)} title={b.hint}
                      className="flex flex-col items-start gap-0.5 rounded-lg border border-ink-200 px-2 py-1.5 text-left hover:border-matcha-400 hover:bg-matcha-50 dark:border-ink-700 dark:hover:bg-matcha-900/20">
                      <span className="text-[13px]">{b.icon}</span>
                      <span className="text-[10.5px] font-medium leading-tight text-ink-700 dark:text-ink-200">{b.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 rounded-lg bg-cream-200/60 p-2 text-[10px] leading-relaxed text-ink-500 dark:bg-ink-800">
                  Mẹo: dùng biến như {`{{order.code}}`} để in dữ liệu thật của đơn.
                </p>
                <div className="mt-1 max-h-[150px] overflow-y-auto">
                  {VAR_HINTS.map((v) => (
                    <button key={v} onClick={() => block && patchBlock(block.id, { value: `${block.value ?? ''}${v}` })}
                      className="block w-full truncate rounded px-1.5 py-0.5 text-left font-mono text-[9.5px] text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800">{v}</button>
                  ))}
                </div>
              </Card>

              {/* danh sách khối */}
              <Card className="p-2">
                <div className="mb-1 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Cấu trúc mẫu · {editing.blocks.length} khối</p>
                  <div className="flex items-center gap-1">
                    <Select value={editing.paper} onChange={(e) => {
                      const paper = e.target.value as PaperKind
                      setEditing({ ...editing, paper, widthMm: PAPERS[paper].widthMm })
                    }} className="h-7 text-[11px]">
                      {Object.entries(PAPERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </Select>
                    <Button size="sm" variant="ghost" icon={<Copy size={13} />} onClick={() => {
                      const copy: PrintTemplate = { ...structuredClone(editing), code: `${editing.code}-copy`, name: `${editing.name} (bản sao)` }
                      setEditing(copy)
                    }} />
                    <Button size="sm" variant="ghost" className="text-rose-600" icon={<Trash2 size={13} />} onClick={() => {
                      deletePrintTemplate(editing.code); setEditing(null); toast({ title: 'Đã xoá mẫu (nếu không phải mặc định)', tone: 'warning' })
                    }} />
                  </div>
                </div>
                <div className="max-h-[520px] space-y-1 overflow-y-auto">
                  {editing.blocks.map((b, i) => (
                    <div key={b.id} onClick={() => setSelectedBlock(b.id)}
                      className={cx('flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5',
                        selectedBlock === b.id ? 'border-matcha-500 bg-matcha-50 dark:bg-matcha-900/20' : 'border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800')}>
                      <Layers size={12} className="shrink-0 text-ink-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-medium text-ink-800 dark:text-ink-100">{b.type} · {b.value ?? b.label ?? b.source ?? (b.cols ? `${b.cols.length} dòng` : '')}</p>
                        <p className="text-[9.5px] text-ink-400">#{i + 1} · {b.align ?? 'left'}{b.size ? ` · ${b.size}pt` : ''}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); moveBlock(b.id, -1) }} className="rounded p-0.5 text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700"><ArrowUp size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); moveBlock(b.id, 1) }} className="rounded p-0.5 text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700"><ArrowDown size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id) }} className="rounded p-0.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              </Card>

              {/* preview + thuộc tính */}
              <div className="space-y-3">
                <Card className="p-2">
                  <div className="mb-1 flex items-center justify-between px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Xem trước · {editing.widthMm}mm</p>
                    <Button size="sm" variant="ghost" icon={<Download size={12} />} onClick={() => {
                      const html = templateHtml(editing, sampleCtx, { title: editing.name })
                      const blob = new Blob([html], { type: 'text/html' })
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = `${editing.code}.html`
                      a.click()
                      URL.revokeObjectURL(a.href)
                    }}>HTML</Button>
                  </div>
                  <PrintPreview template={editing} ctx={sampleCtx} scale={editing.paper === 'k57' ? 1.4 : editing.paper === 'k80' ? 1.1 : editing.paper === 'a5' ? 0.9 : 0.72} />
                </Card>

                {block && (
                  <Card className="p-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      <Settings2 size={11} className="mr-1 inline" />Thuộc tính khối
                    </p>
                    <div className="space-y-1.5 p-1">
                      {(block.type === 'text' || block.type === 'logo' || block.type === 'note') && (
                        <Textarea rows={2} value={block.value ?? ''} onChange={(e) => patchBlock(block.id, { value: e.target.value })} placeholder="Nội dung, dùng {{order.code}}" className="text-[11px]" />
                      )}
                      {(block.type === 'qr' || block.type === 'barcode') && (
                        <>
                          <Input value={block.source ?? ''} onChange={(e) => patchBlock(block.id, { source: e.target.value })} className="text-[11px]" placeholder="{{vietqr}}" />
                          {block.type === 'qr' && <Input value={block.label ?? ''} onChange={(e) => patchBlock(block.id, { label: e.target.value })} className="text-[11px]" placeholder="Chú thích dưới mã" />}
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" icon={<QrCode size={12} />} onClick={() => patchBlock(block.id, { source: '{{vietqr}}' })}>VietQR</Button>
                            <Button size="sm" variant="ghost" icon={<Barcode size={12} />} onClick={() => patchBlock(block.id, { source: '{{order.track_url}}' })}>Link</Button>
                          </div>
                        </>
                      )}
                      {(block.type === 'fields' || block.type === 'signatures') && (
                        <div className="space-y-1">
                          {(block.cols ?? []).map((c, ci) => (
                            <div key={ci} className="flex gap-1">
                              <Input value={c.label} onChange={(e) => {
                                const cols = [...(block.cols ?? [])]
                                cols[ci] = { ...cols[ci], label: e.target.value }
                                patchBlock(block.id, { cols })
                              }} className="text-[10.5px]" placeholder="Nhãn" />
                              <Input value={c.value ?? ''} onChange={(e) => {
                                const cols = [...(block.cols ?? [])]
                                cols[ci] = { ...cols[ci], value: e.target.value }
                                patchBlock(block.id, { cols })
                              }} className="text-[10.5px]" placeholder="{{order.code}}" />
                              <button onClick={() => patchBlock(block.id, { cols: (block.cols ?? []).filter((_, k) => k !== ci) })} className="px-1 text-rose-500"><Trash2 size={11} /></button>
                            </div>
                          ))}
                          <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => patchBlock(block.id, { cols: [...(block.cols ?? []), { label: 'Nhãn mới', value: '' }] })}>Thêm dòng</Button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="text-[10.5px] text-ink-500">Cỡ chữ (pt)
                          <Input type="number" value={block.size ?? 9.5} onChange={(e) => patchBlock(block.id, { size: Number(e.target.value) })} className="mt-0.5 h-7 text-[11px]" />
                        </label>
                        <label className="text-[10.5px] text-ink-500">Độ đậm
                          <Select value={String(block.weight ?? 400)} onChange={(e) => patchBlock(block.id, { weight: Number(e.target.value) as PrintBlock['weight'] })} className="mt-0.5 h-7 text-[11px]">
                            <option value="400">Thường</option><option value="500">Vừa</option><option value="600">Đậm vừa</option><option value="700">Đậm</option>
                          </Select>
                        </label>
                      </div>
                      <div className="flex items-center gap-1">
                        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([al, Icon]) => (
                          <button key={al} onClick={() => patchBlock(block.id, { align: al })}
                            className={cx('rounded border px-1.5 py-1', block.align === al ? 'border-matcha-500 bg-matcha-50 text-matcha-700 dark:bg-matcha-900/30' : 'border-ink-200 text-ink-400 dark:border-ink-700')}>
                            <Icon size={12} />
                          </button>
                        ))}
                        <label className="ml-1 flex items-center gap-1 text-[10.5px] text-ink-500">
                          <input type="checkbox" checked={!!block.uppercase} onChange={(e) => patchBlock(block.id, { uppercase: e.target.checked })} className="accent-matcha-600" /> IN HOA
                        </label>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" icon={<Type size={12} />} onClick={() => patchBlock(block.id, { weight: 700 })}>Đậm tiêu đề</Button>
                      </div>
                    </div>
                  </Card>
                )}

                <Card className="p-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Mẫu mặc định theo loại</p>
                  <div className="mt-1 flex flex-wrap gap-1 p-1">
                    <Button size="sm" variant="ghost" onClick={() => { setDefaultTemplate(editing.code); toast({ title: 'Đã đặt làm mặc định', description: KIND_LABEL[editing.kind], tone: 'success' }) }}>Đặt mặc định</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      const html = templateHtml(editing, sampleCtx, { title: editing.name })
                      const w = window.open('', '_blank', 'width=420,height=760')
                      if (w) { w.document.write(html); w.document.close(); setTimeout(async () => { await mountCodes(w.document); w.focus(); w.print() }, 400) }
                    }}>Mở cửa sổ in</Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'bulk' && <BulkPrint templates={templates} />}
      {tab === 'queue' && <PrintQueue />}
    </div>
  )
}

function safeParse(layout: string): PrintBlock[] {
  try {
    const parsed = JSON.parse(layout)
    return Array.isArray(parsed) ? (parsed as PrintBlock[]) : []
  } catch { return [] }
}

function defaultBlock(type: PrintBlock['type']): PrintBlock {
  const id = `${type}-${Math.random().toString(36).slice(2, 8)}`
  switch (type) {
    case 'text': return { id, type, value: 'Nội dung mới', align: 'left', size: 9.5 }
    case 'logo': return { id, type, value: 'MATCHA HOUSE', align: 'center', size: 15, weight: 700 }
    case 'note': return { id, type, value: 'Ghi chú', align: 'center', size: 8 }
    case 'fields': return { id, type, cols: [{ label: 'Số HĐ', value: '{{order.code}}' }, { label: 'Thời gian', value: '{{order.created_at|datetime}}' }] }
    case 'qr': return { id, type, align: 'center', source: '{{vietqr}}', label: 'Quét để thanh toán' }
    case 'barcode': return { id, type, align: 'center', source: '{{order.code}}' }
    case 'table': return { id, type, source: 'stocktake' }
    case 'signatures': return { id, type, cols: [{ label: 'Người lập' }, { label: 'Người duyệt' }], size: 22 }
    case 'divider': return { id, type }
    case 'spacer': return { id, type, size: 8 }
    case 'items': return { id, type }
    case 'totals': return { id, type }
    case 'payments': return { id, type }
    default: return { id, type }
  }
}

/** Xem trước đúng khổ giấy, có QR/barcode thật. */
function PrintPreview({ template, ctx, scale = 1 }: { template: PrintTemplate; ctx: Record<string, unknown>; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderTemplateBody(template, ctx), [template, ctx])
  useEffect(() => {
    if (ref.current) void mountCodes(ref.current)
  }, [html])
  const paper = PAPERS[template.paper]
  return (
    <div className="max-h-[540px] overflow-auto rounded-lg bg-ink-100 p-3 dark:bg-ink-800">
      <div
        ref={ref}
        className="mx-auto bg-white text-black shadow-md"
        style={{ width: `${template.widthMm}mm`, padding: `${paper.paddingMm}mm`, transform: `scale(${scale})`, transformOrigin: 'top center', fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '9.5pt', lineHeight: 1.35 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function BulkPrint({ templates }: { templates: PrintTemplate[] }) {
  const { user, branchId, toast } = useApp()
  const [code, setCode] = useState(templates[0]?.code ?? 'receipt-k80')
  const [scope, setScope] = useState<'today' | 'selected'>('today')
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const orders = useSql(() => all<{ id: number; code: string; total: number; created_at: string; channel: string; customer_name: string | null }>(
    `SELECT o.id, o.code, o.total, o.created_at, o.channel, c.name AS customer_name FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.branch_id = ? AND o.status != 'cancelled' AND date(o.created_at) = date('now','+7 hours')
     ORDER BY o.id DESC LIMIT 60`, [branchId]), [branchId])

  const template = templates.find((t) => t.code === code) ?? templates[0]
  const targets = scope === 'today' ? orders : orders.filter((o) => picked.includes(o.id))
  const copies = template?.kind === 'cup_label' ? 1 : 1

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[320px_1fr]">
      <Card className="p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Cấu hình lô in</p>
        <div className="space-y-2">
          <label className="block text-[11.5px] text-ink-500">Mẫu in
            <Select value={code} onChange={(e) => setCode(e.target.value)} className="mt-0.5">
              {templates.map((t) => <option key={t.code} value={t.code}>{t.name} ({PAPERS[t.paper].label.split(' — ')[0]})</option>)}
            </Select>
          </label>
          <label className="block text-[11.5px] text-ink-500">Phạm vi
            <Select value={scope} onChange={(e) => setScope(e.target.value as 'today' | 'selected')} className="mt-0.5">
              <option value="today">Tất cả đơn hôm nay ({orders.length})</option>
              <option value="selected">Đơn được chọn ({picked.length})</option>
            </Select>
          </label>
          <div className="rounded-xl bg-cream-200/70 p-2 text-[11.5px] dark:bg-ink-800">
            <p className="flex justify-between"><span className="text-ink-500">Sẽ in</span><span className="font-semibold">{targets.length} bản</span></p>
            <p className="flex justify-between"><span className="text-ink-500">Khổ giấy</span><span>{template?.widthMm} mm</span></p>
            <p className="flex justify-between"><span className="text-ink-500">Máy in</span><span>Hộp thoại hệ thống</span></p>
          </div>
          <Button variant="primary" block icon={<Printer size={15} />} disabled={busy || !targets.length} onClick={async () => {
            setBusy(true)
            let count = 0
            for (const o of targets) {
              const ctx = template.kind === 'cup_label'
                ? buildCupCtx(o.id, 0, user?.name)
                : buildOrderCtx(o.id, { cashier: user?.name })
              if (!ctx) continue
              await printTemplate(template, ctx, { title: `${template.name} · ${o.code}` })
              logPrintJob({ templateCode: template.code, refType: 'orders', refId: o.id, copies, status: 'printed', printer: 'Hộp thoại in', userId: user?.id ?? null, payload: JSON.stringify({ code: o.code, total: o.total }) })
              count++
            }
            setBusy(false)
            toast({ title: `Đã xử lý ${count} bản in`, tone: 'success' })
          }}>{busy ? 'Đang in…' : 'Bắt đầu in hàng loạt'}</Button>
          <p className="text-[10.5px] leading-relaxed text-ink-400">
            Trình duyệt sẽ mở hộp thoại in cho từng bản. Chọn máy in hoá đơn (khổ K80) và tắt “Headers and footers” để căn đúng.
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Đơn hôm nay" subtitle={`${orders.length} đơn · chọn để in lẻ`} icon={<FileText size={16} />} />
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-cream-200 text-[10.5px] uppercase tracking-wide text-ink-500 dark:bg-ink-800">
              <tr><th className="w-8 px-2 py-1.5"></th><th className="px-2 py-1.5 text-left">Đơn</th><th className="px-2 py-1.5 text-left">Khách</th><th className="px-2 py-1.5 text-right">Tiền</th><th className="px-2 py-1.5 text-right">Giờ</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
                  <td className="px-2 py-1.5"><input type="checkbox" checked={picked.includes(o.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, o.id] : picked.filter((x) => x !== o.id))} className="accent-matcha-600" /></td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">{o.code}</td>
                  <td className="px-2 py-1.5">{o.customer_name ?? 'Khách lẻ'}</td>
                  <td className="px-2 py-1.5 text-right">{formatVND(o.total, { compact: true })}</td>
                  <td className="px-2 py-1.5 text-right text-ink-400">{o.created_at.slice(11, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <EmptyState title="Hôm nay chưa có đơn" />}
        </div>
      </Card>
    </div>
  )
}

function PrintQueue() {
  const jobs = useSql(() => getPrintJobs(80), [])
  return (
    <Card className="mt-3 overflow-hidden">
      <CardHeader title="Hàng đợi in" subtitle={`${jobs.length} lệnh gần nhất`} icon={<Printer size={16} />} />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-cream-200 text-[10.5px] uppercase tracking-wide text-ink-500 dark:bg-ink-800">
            <tr>
              <th className="px-2 py-1.5 text-left">#</th><th className="px-2 py-1.5 text-left">Mẫu</th><th className="px-2 py-1.5 text-left">Bản ghi</th>
              <th className="px-2 py-1.5 text-left">Máy in</th><th className="px-2 py-1.5 text-left">Người bấm</th><th className="px-2 py-1.5 text-left">Trạng thái</th><th className="px-2 py-1.5 text-left">Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
                <td className="px-2 py-1.5 text-ink-400">{j.id}</td>
                <td className="px-2 py-1.5 font-mono text-[11px]">{j.template_code}</td>
                <td className="px-2 py-1.5">{j.ref_type ? `${j.ref_type}#${j.ref_id}` : '—'}</td>
                <td className="px-2 py-1.5 text-ink-500">{j.printer ?? '—'}</td>
                <td className="px-2 py-1.5">{j.user_name ?? '—'}</td>
                <td className="px-2 py-1.5"><Badge tone={j.status === 'printed' ? 'green' : j.status === 'failed' ? 'red' : 'amber'}>{j.status}</Badge></td>
                <td className="px-2 py-1.5 text-ink-400">{formatDateTime(j.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <EmptyState title="Chưa có lệnh in" />}
      </div>
    </Card>
  )
}
