/**
 * Bộ máy in ấn chuyên nghiệp.
 * Mẫu in = danh sách "block" (JSON lưu trong bảng print_templates) → render ra HTML đúng khổ giấy
 * (K80 80mm, K57 57mm, A5, A4) → in qua iframe ẩn để CSS không xung đột với app.
 * Hỗ trợ QR (chuẩn EMVCo) và barcode Code128 vẽ bằng SVG ngay trong bản in.
 */
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { formatDate, formatDateTime, formatVND } from './format'

export type PaperKind = 'k80' | 'k57' | 'a5' | 'a4'

export const PAPERS: Record<PaperKind, { label: string; widthMm: number; paddingMm: number }> = {
  k80: { label: 'K80 — máy in bill 80mm', widthMm: 80, paddingMm: 3 },
  k57: { label: 'K57 — máy in bill 57mm', widthMm: 57, paddingMm: 2 },
  a5: { label: 'A5 — phiếu giao hàng / biên bản', widthMm: 148, paddingMm: 8 },
  a4: { label: 'A4 — báo cáo', widthMm: 210, paddingMm: 12 },
}

export type BlockType =
  | 'logo' | 'text' | 'divider' | 'spacer' | 'items' | 'totals' | 'payments'
  | 'qr' | 'barcode' | 'fields' | 'signatures' | 'table' | 'note'

export interface PrintBlock {
  id: string
  type: BlockType
  label?: string
  value?: string
  align?: 'left' | 'center' | 'right'
  size?: number
  weight?: 400 | 500 | 600 | 700
  uppercase?: boolean
  cols?: { label: string; value?: string; align?: 'left' | 'right'; width?: string }[]
  source?: string
  showIf?: string
}

export interface PrintTemplate {
  code: string
  name: string
  kind: 'receipt' | 'cup_label' | 'delivery_note' | 'stocktake' | 'price_tag' | 'shift_report'
  paper: PaperKind
  widthMm: number
  blocks: PrintBlock[]
}

export const KIND_LABEL: Record<PrintTemplate['kind'], string> = {
  receipt: 'Hoá đơn bán hàng',
  cup_label: 'Tem ly / phiếu pha chế',
  delivery_note: 'Phiếu giao hàng',
  stocktake: 'Biên bản kiểm kê',
  price_tag: 'Nhãn kệ / bảng giá',
  shift_report: 'Báo cáo chốt ca',
}

const b = (type: BlockType, extra: Partial<PrintBlock> = {}): PrintBlock => ({
  id: `${type}-${Math.random().toString(36).slice(2, 8)}`, type, ...extra,
})

export const DEFAULT_TEMPLATES: PrintTemplate[] = [
  {
    code: 'receipt-k80',
    name: 'Hoá đơn bán hàng K80',
    kind: 'receipt',
    paper: 'k80',
    widthMm: 80,
    blocks: [
      b('logo', { align: 'center', size: 15, weight: 700, value: 'MATCHA HOUSE' }),
      b('text', { align: 'center', size: 9, value: '{{branch.name}}' }),
      b('text', { align: 'center', size: 8, value: '{{branch.address}} · ĐT {{branch.phone}}' }),
      b('divider'),
      b('fields', { cols: [
        { label: 'Số HĐ', value: '{{order.code}}' },
        { label: 'Thời gian', value: '{{order.created_at|datetime}}' },
        { label: 'Thu ngân', value: '{{cashier}}' },
        { label: 'Kênh', value: '{{order.channel_label}}' },
        { label: 'Bàn / số', value: '{{order.place}}' },
        { label: 'Khách', value: '{{customer.name}}' },
      ] }),
      b('divider'),
      b('items'),
      b('divider'),
      b('totals'),
      b('payments'),
      b('spacer', { size: 6 }),
      b('qr', { align: 'center', label: 'Quét để xem hoá đơn & theo dõi đơn', source: '{{order.track_url}}' }),
      b('barcode', { align: 'center', source: '{{order.code}}' }),
      b('note', { align: 'center', size: 8, value: 'Cảm ơn quý khách! Hẹn gặp lại 🌿' }),
      b('text', { align: 'center', size: 7, value: 'Wifi: matchahouse · Hotline: 1900 6868' }),
    ],
  },
  {
    code: 'cup-label',
    name: 'Tem ly / phiếu pha chế',
    kind: 'cup_label',
    paper: 'k57',
    widthMm: 57,
    blocks: [
      b('text', { align: 'center', size: 13, weight: 700, value: '{{order.queue_label}}' }),
      b('text', { align: 'center', size: 10, weight: 600, value: '{{item.name}}' }),
      b('text', { align: 'center', size: 9, value: '{{item.size}} · Đường {{item.sugar}}% · Đá {{item.ice}}%' }),
      b('text', { align: 'center', size: 9, value: 'Topping: {{item.toppings}}' }),
      b('divider'),
      b('text', { align: 'center', size: 8, weight: 600, value: '{{item.note}}' }),
      b('barcode', { align: 'center', source: '{{order.code}}' }),
      b('text', { align: 'center', size: 7, value: '{{order.code}} · {{order.time}}' }),
    ],
  },
  {
    code: 'delivery-note',
    name: 'Phiếu giao hàng A5',
    kind: 'delivery_note',
    paper: 'a5',
    widthMm: 148,
    blocks: [
      b('logo', { align: 'center', size: 16, weight: 700, value: 'MATCHA HOUSE' }),
      b('text', { align: 'center', size: 11, weight: 600, value: 'PHIẾU GIAO HÀNG' }),
      b('divider'),
      b('fields', { cols: [
        { label: 'Mã vận đơn', value: '{{delivery.code}}' },
        { label: 'Đơn hàng', value: '{{order.code}}' },
        { label: 'Người nhận', value: '{{customer.name}}' },
        { label: 'Điện thoại', value: '{{customer.phone}}' },
        { label: 'Địa chỉ', value: '{{delivery.address}}' },
        { label: 'Shipper', value: '{{delivery.shipper}}' },
        { label: 'Khoảng cách', value: '{{delivery.distance}}' },
        { label: 'Phí giao', value: '{{delivery.fee}}' },
        { label: 'Thu hộ COD', value: '{{delivery.cod}}' },
      ] }),
      b('divider'),
      b('items'),
      b('totals'),
      b('divider'),
      b('signatures', { cols: [{ label: 'Người giao hàng' }, { label: 'Người nhận hàng' }], size: 26 }),
      b('barcode', { align: 'center', source: '{{delivery.code}}' }),
    ],
  },
  {
    code: 'stocktake',
    name: 'Biên bản kiểm kê kho',
    kind: 'stocktake',
    paper: 'a5',
    widthMm: 148,
    blocks: [
      b('text', { align: 'center', size: 15, weight: 700, value: 'BIÊN BẢN KIỂM KÊ KHO' }),
      b('text', { align: 'center', size: 9, value: '{{branch.name}} · {{date}}' }),
      b('divider'),
      b('table', { source: 'stocktake' }),
      b('divider'),
      b('signatures', { cols: [{ label: 'Người kiểm kê' }, { label: 'Quản lý chi nhánh' }], size: 24 }),
    ],
  },
  {
    code: 'price-tag',
    name: 'Nhãn kệ / bảng giá',
    kind: 'price_tag',
    paper: 'k57',
    widthMm: 57,
    blocks: [
      b('text', { align: 'center', size: 20, value: '{{item.emoji}}' }),
      b('text', { align: 'center', size: 12, weight: 700, value: '{{item.name}}' }),
      b('text', { align: 'center', size: 15, weight: 700, value: '{{item.price}}' }),
      b('text', { align: 'center', size: 8, value: '{{item.category}}' }),
      b('barcode', { align: 'center', source: '{{item.sku}}' }),
    ],
  },
  {
    code: 'shift-report',
    name: 'Báo cáo chốt ca',
    kind: 'shift_report',
    paper: 'a5',
    widthMm: 148,
    blocks: [
      b('text', { align: 'center', size: 15, weight: 700, value: 'BÁO CÁO CHỐT CA' }),
      b('text', { align: 'center', size: 9, value: '{{branch.name}} · {{date}}' }),
      b('divider'),
      b('fields', { cols: [
        { label: 'Thu ngân', value: '{{shift.cashier}}' },
        { label: 'Mở ca', value: '{{shift.opened}}' },
        { label: 'Chốt ca', value: '{{shift.closed}}' },
        { label: 'Tiền đầu ca', value: '{{shift.opening_cash}}' },
        { label: 'Tiền mặt lý thuyết', value: '{{shift.expected_cash}}' },
        { label: 'Kiểm đếm', value: '{{shift.counted}}' },
        { label: 'Chênh lệch', value: '{{shift.diff}}' },
        { label: 'Số đơn', value: '{{shift.orders}}' },
      ] }),
      b('divider'),
      b('table', { source: 'payments' }),
      b('divider'),
      b('signatures', { cols: [{ label: 'Thu ngân' }, { label: 'Quản lý' }], size: 24 }),
    ],
  },
]

/* ------------------------------- render ------------------------------- */

export function getPath(ctx: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), ctx)
}

function interpolate(tpl: string, ctx: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr: string) => {
    const [rawPath, filter] = expr.split('|').map((s) => s.trim())
    const value = getPath(ctx, rawPath)
    if (value == null || value === '') return '—'
    if (filter === 'currency') return formatVND(Number(value))
    if (filter === 'datetime') return formatDateTime(String(value))
    if (filter === 'date') return formatDate(String(value))
    if (filter === 'number') return String(Math.round(Number(value)))
    return String(value)
  })
}

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

function blockHtml(block: PrintBlock, ctx: Record<string, unknown>): string {
  const align = block.align ?? 'left'
  const style = [
    `text-align:${align}`,
    block.size ? `font-size:${block.size}pt` : '',
    block.weight ? `font-weight:${block.weight}` : '',
    block.uppercase ? 'text-transform:uppercase;letter-spacing:.04em' : '',
  ].filter(Boolean).join(';')

  switch (block.type) {
    case 'logo':
      return `<div style="${style};margin-bottom:2px">${esc(interpolate(block.value ?? '', ctx))}</div>`
    case 'text':
      return `<div style="${style}">${esc(interpolate(block.value ?? '', ctx))}</div>`
    case 'note':
      return `<div style="${style};color:#333">${esc(interpolate(block.value ?? '', ctx))}</div>`
    case 'divider':
      return `<hr style="border:none;border-top:1px dashed #999;margin:4px 0" />`
    case 'spacer':
      return `<div style="height:${block.size ?? 8}px"></div>`
    case 'fields':
      return `<table style="width:100%;font-size:9pt;border-collapse:collapse">${(block.cols ?? []).map((c) =>
        `<tr><td style="color:#555;padding:0.6mm 0;width:38%">${esc(c.label)}</td><td style="font-weight:600">${esc(interpolate(c.value ?? '', ctx))}</td></tr>`).join('')}</table>`
    case 'items': {
      const items = (ctx.items as { qty: number; name: string; size?: string; unit_price: number; amount: number; note?: string; toppings?: string; sugar?: number; ice?: number }[]) ?? []
      return `<table style="width:100%;font-size:9pt;border-collapse:collapse">
        ${items.map((it) => `
          <tr>
            <td style="padding:0.8mm 0;vertical-align:top">
              <div style="font-weight:600">${esc(it.name)}${it.size ? ` <span style="font-weight:400">(${esc(it.size)})</span>` : ''}</div>
              ${it.toppings ? `<div style="font-size:8pt;color:#555">+ ${esc(it.toppings)}</div>` : ''}
              ${it.note ? `<div style="font-size:8pt;color:#555">※ ${esc(it.note)}</div>` : ''}
            </td>
            <td style="text-align:center;vertical-align:top">${it.qty}</td>
            <td style="text-align:right;vertical-align:top">${formatVND(it.amount)}</td>
          </tr>`).join('')}
      </table>`
    }
    case 'totals': {
      const rows: [string, number, boolean?][] = [
        ['Tạm tính', Number(ctx.subtotal ?? 0)],
        ...(Number(ctx.item_discount ?? 0) > 0 ? [['Giảm giá món', -Number(ctx.item_discount)] as [string, number]] : []),
        ...(Number(ctx.promotion_discount ?? 0) > 0 ? [['Khuyến mãi', -Number(ctx.promotion_discount)] as [string, number]] : []),
        ...(Number(ctx.voucher_discount ?? 0) > 0 ? [['Voucher', -Number(ctx.voucher_discount)] as [string, number]] : []),
        ...(Number(ctx.delivery_fee ?? 0) > 0 ? [['Phí giao hàng', Number(ctx.delivery_fee)] as [string, number]] : []),
        ['VAT (đã gồm)', Number(ctx.vat_amount ?? 0)],
      ]
      return `<table style="width:100%;font-size:9pt;border-collapse:collapse">
        ${rows.map(([label, value]) => `<tr><td style="padding:0.4mm 0">${esc(label)}</td><td style="text-align:right">${formatVND(value)}</td></tr>`).join('')}
        <tr><td style="padding-top:1.5mm;font-size:11pt;font-weight:700">KHÁCH PHẢI TRẢ</td><td style="text-align:right;padding-top:1.5mm;font-size:11pt;font-weight:700">${formatVND(Number(ctx.total ?? 0))}</td></tr>
        ${ctx.points_earned ? `<tr><td colspan="2" style="font-size:8pt;color:#555;padding-top:1mm">Điểm tích luỹ: +${ctx.points_earned}</td></tr>` : ''}
      </table>`
    }
    case 'payments': {
      const payments = (ctx.payments as { method: string; amount: number; ref?: string }[]) ?? []
      if (!payments.length) return ''
      return `<div style="font-size:8.5pt;margin-top:1mm">${payments.map((p) =>
        `<div style="display:flex;justify-content:space-between"><span>${esc(p.method)}${p.ref ? ` · ${esc(p.ref)}` : ''}</span><span>${formatVND(p.amount)}</span></div>`).join('')}</div>`
    }
    case 'qr': {
      const value = interpolate(block.source ?? '', ctx)
      return `<div style="text-align:center;margin:2mm 0">
        ${block.label ? `<div style="font-size:7.5pt;color:#444;margin-bottom:1mm">${esc(block.label)}</div>` : ''}
        <div data-qr="${esc(value)}" style="display:inline-block"></div>
      </div>`
    }
    case 'barcode': {
      const value = interpolate(block.source ?? '', ctx)
      return `<div style="text-align:center;margin:1.5mm 0"><svg data-barcode="${esc(value)}" style="max-width:100%"></svg></div>`
    }
    case 'signatures':
      return `<table style="width:100%;font-size:8.5pt;text-align:center;margin-top:2mm"><tr>
        ${(block.cols ?? [{ label: 'Người lập' }, { label: 'Người duyệt' }]).map((c) => `<td style="width:50%;padding-top:1mm">${esc(c.label)}<div style="height:${block.size ?? 22}mm"></div><div style="border-top:1px dotted #999;margin:0 6mm"></div><div style="font-size:7.5pt;color:#666">Ký, ghi rõ họ tên</div></td>`).join('')}
      </tr></table>`
    case 'table': {
      const rows = (ctx[block.source ?? ''] as { name: string; value: string }[]) ?? []
      return `<table style="width:100%;font-size:8.5pt;border-collapse:collapse">
        ${rows.map((r, i) => `<tr style="background:${i % 2 ? '#faf9f4' : 'transparent'}"><td style="padding:0.8mm 0;border-bottom:1px solid #eee">${esc(r.name)}</td><td style="text-align:right;border-bottom:1px solid #eee">${esc(r.value)}</td></tr>`).join('')}
      </table>`
    }
    default:
      return ''
  }
}

export function renderTemplateBody(template: PrintTemplate, ctx: Record<string, unknown>) {
  return template.blocks
    .filter((bl) => !bl.showIf || String(getPath(ctx, bl.showIf) ?? '') !== '')
    .map((bl) => blockHtml(bl, ctx))
    .join('\n')
}

export function templateHtml(template: PrintTemplate, ctx: Record<string, unknown>, opts: { title?: string } = {}) {
  const paper = PAPERS[template.paper] ?? PAPERS.k80
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<title>${esc(opts.title ?? template.name)}</title>
<style>
  @page { size: ${template.widthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: ${paper.paddingMm}mm;
    width: ${template.widthMm}mm;
    font-family: 'Be Vietnam Pro', 'Matcha Emoji', 'Noto Color Emoji', 'Helvetica Neue', Arial, sans-serif;
    color: #111; font-size: 9.5pt; line-height: 1.35;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  table { border-collapse: collapse; }
  svg { max-width: 100%; }
</style></head>
<body>${renderTemplateBody(template, ctx)}</body></html>`
}

/** Vẽ QR (EMVCo) + barcode Code128 vào các node [data-qr] / [data-barcode] trong một DOM root. */
export async function mountCodes(root: ParentNode) {
  const qrNodes = Array.from(root.querySelectorAll('[data-qr]')) as HTMLElement[]
  await Promise.all(qrNodes.map(async (node) => {
    const value = node.getAttribute('data-qr') ?? ''
    if (!value) return
    try {
      node.innerHTML = await QRCode.toString(value, { type: 'svg', margin: 0, width: 96, errorCorrectionLevel: 'M' })
    } catch { node.textContent = '' }
  }))
  const barNodes = Array.from(root.querySelectorAll('[data-barcode]')) as Element[]
  barNodes.forEach((node) => {
    const value = node.getAttribute('data-barcode') ?? ''
    try {
      JsBarcode(node as unknown as SVGSVGElement, value, { format: 'CODE128', width: 1.1, height: 34, fontSize: 9, margin: 0, displayValue: true })
    } catch { /* barcode không hợp lệ */ }
  })
}

/** In thật: dựng iframe ẩn, render QR/barcode rồi gọi hộp thoại in của hệ điều hành. */
export async function printTemplate(template: PrintTemplate, ctx: Record<string, unknown>, opts: { copies?: number; title?: string } = {}) {
  const html = templateHtml(template, ctx, opts)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument!
  doc.open()
  doc.write(html)
  doc.close()
  await mountCodes(doc)

  const copies = Math.max(1, opts.copies ?? 1)
  for (let i = 0; i < copies; i++) {
    await new Promise<void>((resolve) => {
      const done = () => { window.removeEventListener('afterprint', done); resolve() }
      window.addEventListener('afterprint', done)
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(done, 1500)
    })
  }
  setTimeout(() => iframe.remove(), 800)
}
