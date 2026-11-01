import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgePercent, Ban, Bike, Check, Clock, Coffee, CreditCard, Gift, Grid2x2, Heart, Layers, Minus, MoreHorizontal,
  PauseCircle, Phone, Plus, Printer, QrCode, Receipt, Search, ShoppingBag, Sparkles, Star, Store, Trash2, User,
  UserPlus, Utensils, Wallet, X, Zap, MapPin, Route as RouteIcon,
} from 'lucide-react'
import {
  addShiftCash, checkout, closeShift, computePromotionDiscount, createCustomer, getBranches, getCategories, getCustomer,
  getOrderDetail, getProductSizes, getProductToppings, getProducts, getShiftOpen, getTables, getToppings, openShift,
  searchCustomers, shiftSummary, validateVoucher, createDelivery, type Customer, type Product, type Topping,
} from '../lib/api'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { buildVietQR, bankByBin } from '../lib/vietqr'
import { getBankAccounts } from '../lib/api'
import QRCode from 'qrcode'
import { BRANCH_GEO, DEMO_PLACES, deliveryFeeFor, route as getRoute, searchAddress, type RouteResult } from '../lib/geo'
import { MapView } from '../components/MapView'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, MoneyInput, Select, Textarea, Tooltip } from '../components/ui'
import { CHANNEL_LABEL, cx, formatVND, normalize, nowVN, TIER_LABEL, formatDateTime } from '../lib/format'

const SUGAR = [0, 30, 50, 70, 100]
const ICE = [0, 30, 50, 70, 100]
const DENOMS = [10000, 20000, 50000, 100000, 200000, 500000]

interface CartLine {
  uid: string
  productId: number
  productName: string
  emoji: string
  size: string
  sugar: number
  ice: number
  qty: number
  basePrice: number
  toppings: { id: number; name: string; qty: number; price: number }[]
  note: string
  discount: number
}

interface HeldOrder { id: string; label: string; at: string; channel: 'dine_in' | 'takeaway' | 'delivery'; tableId: number | null; customerId: number | null; lines: CartLine[] }

const uid = () => Math.random().toString(36).slice(2, 9)
const linePrice = (l: CartLine) => (l.basePrice + l.toppings.reduce((s, t) => s + t.price * t.qty, 0)) * l.qty - l.discount

export function POSPage() {
  const { user, branchId, toast } = useApp()
  const branches = useSql(() => getBranches(), [])
  const branch = branches.find((b) => b.id === branchId)
  const categories = useSql(() => getCategories(), [])
  const products = useSql(() => getProducts(), [])
  const allToppings = useSql(() => getToppings(), [])

  const [catId, setCatId] = useState<number | 'all' | 'best'>('all')
  const [q, setQ] = useState('')
  const [favorites, setFavorites] = useState<number[]>(() => JSON.parse(localStorage.getItem('pos-favs') ?? '[]'))
  const [lines, setLines] = useState<CartLine[]>([])
  const [channel, setChannel] = useState<'dine_in' | 'takeaway' | 'delivery'>('takeaway')
  const [source, setSource] = useState<'pos' | 'grabfood' | 'shopeefood' | 'website' | 'app'>('pos')
  const [tableId, setTableId] = useState<number | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryFee, setDeliveryFee] = useState(15000)
  const [deliveryGeo, setDeliveryGeo] = useState<{ lat: number; lng: number; distanceKm: number; etaMin: number } | null>(null)
  const [geoOpen, setGeoOpen] = useState(false)
  const [note, setNote] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [voucher, setVoucher] = useState<{ id: number; code: string; discount: number } | null>(null)
  const [voucherError, setVoucherError] = useState('')
  const [pointsUsed, setPointsUsed] = useState(0)
  const [usePromo, setUsePromo] = useState(true)

  const [customizing, setCustomizing] = useState<{ product: Product; editUid?: string } | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [held, setHeld] = useState<HeldOrder[]>(() => JSON.parse(localStorage.getItem('pos-held') ?? '[]'))
  const [receipt, setReceipt] = useState<{ orderId: number; code: string; queue: number | null } | null>(null)
  const [shiftOpenModal, setShiftOpenModal] = useState(false)
  const [cancelLine, setCancelLine] = useState<CartLine | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const openShiftNow = useSql(() => (user ? getShiftOpen(branchId) : null), [branchId, user])
  const tables = useSql(() => getTables(branchId), [branchId])

  useEffect(() => { localStorage.setItem('pos-favs', JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem('pos-held', JSON.stringify(held)) }, [held])

  // phím tắt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F4' && lines.length) { e.preventDefault(); setPaymentOpen(true) }
      if (e.key === 'F8' && lines.length) { e.preventDefault(); holdOrder() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const filtered = useMemo(() => {
    const nq = normalize(q)
    return products.filter((p) => {
      if (!p.is_active) return false
      if (catId === 'best' && !p.is_bestseller) return false
      if (typeof catId === 'number' && p.category_id !== catId) return false
      if (!nq) return true
      return normalize(p.name).includes(nq) || p.sku.toLowerCase().includes(nq)
    })
  }, [products, catId, q])

  const subtotal = lines.reduce((s, l) => s + l.basePrice * l.qty + l.toppings.reduce((a, t) => a + t.price * t.qty, 0) * l.qty - l.discount, 0)
  const promo = useMemo(() => computePromotionDiscount(subtotal, customer?.tier ?? 'bronze', nowVN()), [subtotal, customer?.tier])
  const promoDiscount = usePromo ? promo.amount : 0
  const voucherDiscount = voucher?.discount ?? 0
  const vatRate = branch?.vat_rate ?? 0.08
  const maxPoints = customer ? Math.min(customer.points, Math.floor((subtotal - promoDiscount - voucherDiscount) / 1000) * 0.5) : 0
  const pointsValue = Math.round(pointsUsed) * 1000
  const total = Math.max(0, subtotal - promoDiscount - voucherDiscount - pointsValue) + (channel === 'delivery' ? deliveryFee : 0)
  const vatAmount = Math.round(((subtotal - promoDiscount - voucherDiscount) * vatRate) / (1 + vatRate))

  const addToCart = (product: Product, cfg: { size: string; sugar: number; ice: number; toppings: { id: number; name: string; price: number }[]; note: string; qty: number; editUid?: string }) => {
    const sizes = getProductSizes(product.id)
    const delta = sizes.find((s) => s.code === cfg.size)?.price_delta ?? 0
    const line: CartLine = {
      uid: cfg.editUid ?? uid(),
      productId: product.id,
      productName: product.name,
      emoji: product.emoji || '🧋',
      size: cfg.size,
      sugar: cfg.sugar,
      ice: cfg.ice,
      qty: cfg.qty,
      basePrice: product.base_price + delta,
      toppings: cfg.toppings.map((t) => ({ id: t.id, name: t.name, qty: 1, price: t.price })),
      note: cfg.note,
      discount: 0,
    }
    setLines((prev) => (cfg.editUid ? prev.map((l) => (l.uid === cfg.editUid ? { ...line, discount: l.discount } : l)) : [...prev, line]))
    toast({ title: `Đã thêm ${product.name}`, description: `${cfg.size} · đường ${cfg.sugar}% · đá ${cfg.ice}%${cfg.toppings.length ? ' · ' + cfg.toppings.length + ' topping' : ''}`, tone: 'success' })
  }

  const applyVoucher = () => {
    if (!voucherCode.trim()) return
    const res = validateVoucher(voucherCode, subtotal, customer?.tier ?? 'bronze')
    if (!res.ok) { setVoucherError(res.error); setVoucher(null); return }
    setVoucherError('')
    setVoucher({ id: res.voucher.id, code: res.voucher.code, discount: res.discount })
    toast({ title: `Áp voucher ${res.voucher.code}`, description: `Giảm ${formatVND(res.discount)}`, tone: 'success' })
  }

  const holdOrder = () => {
    if (!lines.length) return
    const item: HeldOrder = {
      id: uid(), label: `${lines.length} món · ${formatVND(total)}`, at: nowVN(), channel, tableId, customerId: customer?.id ?? null, lines,
    }
    setHeld([item, ...held])
    setLines([]); setCustomer(null); setTableId(null); setVoucher(null); setVoucherCode(''); setPointsUsed(0); setNote('')
    toast({ title: 'Đã giữ đơn', description: 'Mở lại từ danh sách đơn chờ bên phải.', tone: 'info' })
  }

  const reopenHeld = (h: HeldOrder) => {
    setLines(h.lines)
    setChannel(h.channel)
    setTableId(h.tableId)
    setCustomer(h.customerId ? getCustomer(h.customerId) : null)
    setHeld(held.filter((x) => x.id !== h.id))
    setHeldOpen(false)
    toast({ title: 'Đã mở lại đơn chờ', tone: 'info' })
  }

  const doCheckout = (payments: { method: string; amount: number }[]) => {
    if (!user) return
    const res = checkout({
      branchId, channel, source: channel === 'delivery' ? source : 'pos', tableId: channel === 'dine_in' ? tableId : null,
      customerId: customer?.id ?? null, cashierId: user.id,
      items: lines.map((l) => ({
        productId: l.productId, productName: l.productName, size: l.size, sugar: l.sugar, ice: l.ice, qty: l.qty,
        unitPrice: l.basePrice + l.toppings.reduce((s, t) => s + t.price * t.qty, 0), discount: l.discount,
        note: l.note || undefined, toppings: l.toppings,
      })),
      promotionDiscount: promoDiscount, voucherId: voucher?.id ?? null, voucherDiscount,
      vatRate, deliveryFee: channel === 'delivery' ? deliveryFee : 0, deliveryAddress: channel === 'delivery' ? deliveryAddress : undefined,
      pointsUsed, note: note || undefined, payments,
    })
    setPaymentOpen(false)
    setReceipt({ orderId: res.orderId, code: res.code, queue: res.queueNo })
    if (channel === 'delivery' && deliveryAddress.trim()) {
      createDelivery({
        orderId: res.orderId, branchId, address: deliveryAddress.trim(),
        lat: deliveryGeo?.lat ?? null, lng: deliveryGeo?.lng ?? null,
        distanceKm: deliveryGeo?.distanceKm ?? 0, fee: deliveryFee, codAmount: res.total,
        etaMinutes: deliveryGeo?.etaMin ?? null, userId: user.id,
      })
    }
    setLines([]); setCustomer(null); setTableId(null); setVoucher(null); setVoucherCode(''); setPointsUsed(0); setNote(''); setDeliveryAddress(''); setDeliveryGeo(null)
    toast({
      title: `Thanh toán thành công ${formatVND(res.total)}`,
      description: `Đơn ${res.code}${res.queueNo ? ` · số gọi ${res.queueNo}` : ''} · đã trừ ${res.stockDeducted.length} nguyên liệu khỏi kho`,
      tone: 'success',
    })
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* ---------------------------- LEFT: catalog ---------------------------- */}
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm món hoặc quét mã vạch / SKU…  (F2)"
              className="h-11 pl-9 pr-16"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10.5px] text-ink-400">F2</span>
          </div>
          <Button variant={held.length ? 'caramel' : 'secondary'} icon={<PauseCircle size={16} />} onClick={() => setHeldOpen(true)}>
            Đơn chờ {held.length > 0 && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[11px]">{held.length}</span>}
          </Button>
          <Button variant="secondary" icon={<Clock size={16} />} onClick={() => setShiftOpenModal(true)}>
            {openShiftNow ? 'Ca đang mở' : 'Mở ca'}
          </Button>
        </div>

        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <CatChip active={catId === 'all'} onClick={() => setCatId('all')} icon={<Grid2x2 size={14} />} label="Tất cả" />
          <CatChip active={catId === 'best'} onClick={() => setCatId('best')} icon={<Star size={14} />} label="Bán chạy" />
          {categories.filter((c) => c.is_active).map((c) => (
            <CatChip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)} label={`${c.emoji ?? ''} ${c.name}`} />
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card><EmptyState icon={<Coffee size={22} />} title="Không có món nào khớp" description="Thử từ khoá khác hoặc bỏ bộ lọc danh mục." /></Card>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((p) => {
              const fav = favorites.includes(p.id)
              const inCart = lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty, 0)
              return (
                <div key={p.id} className="group relative">
                  <button
                    onClick={() => setCustomizing({ product: p })}
                    className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-ink-200/80 bg-white text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-matcha-300 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-matcha-500 dark:border-ink-800 dark:bg-ink-900"
                  >
                    <div className="relative flex h-[86px] items-center justify-center bg-gradient-to-br from-matcha-50 via-cream-100 to-caramel-50 text-[34px] dark:from-ink-800 dark:via-ink-800 dark:to-ink-800">
                      <span aria-hidden>{p.emoji || '🧋'}</span>
                      {p.is_bestseller === 1 && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-caramel-500 px-1.5 py-0.5 text-[9.5px] font-semibold text-white">BÁN CHẠY</span>
                      )}
                      {inCart > 0 && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-matcha-600 px-1 text-[10px] font-bold text-white">{inCart}</span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-2.5">
                      <p className="line-clamp-2 min-h-[34px] text-[12.5px] font-medium leading-tight text-ink-900 dark:text-ink-50">{p.name}</p>
                      <div className="mt-1 flex items-end justify-between gap-1">
                        <span className="text-[13px] font-semibold text-matcha-700 dark:text-matcha-300">{formatVND(p.base_price)}</span>
                        {p.has_size === 1 && <span className="text-[10px] text-ink-400">S·M·L</span>}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setFavorites((f) => (fav ? f.filter((x) => x !== p.id) : [...f, p.id]))}
                    aria-label={fav ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
                    className={cx('absolute bottom-1.5 right-1.5 rounded-lg p-1 transition-colors', fav ? 'text-rose-500' : 'text-ink-300 hover:text-rose-400')}
                  >
                    <Heart size={13} fill={fav ? 'currentColor' : 'none'} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ---------------------------- RIGHT: cart ---------------------------- */}
      <div className="min-w-0">
        <Card className="sticky top-[72px] flex max-h-[calc(100dvh-88px)] flex-col overflow-hidden">
          <div className="border-b border-ink-100 p-3 dark:border-ink-800">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900 dark:text-ink-50">
                <ShoppingBag size={16} className="text-matcha-600" /> Đơn hiện tại
              </h2>
              <span className="text-[11.5px] text-ink-400">{branch?.name}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl bg-ink-100/80 p-1 dark:bg-ink-800/70">
              {(['dine_in', 'takeaway', 'delivery'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => { setChannel(c); if (c === 'dine_in') setTableOpen(true) }}
                  className={cx('flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-medium transition-all',
                    channel === c ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-900 dark:text-ink-50' : 'text-ink-500')}
                >
                  {c === 'dine_in' ? <Utensils size={13} /> : c === 'takeaway' ? <ShoppingBag size={13} /> : <Bike size={13} />}
                  {CHANNEL_LABEL[c]}
                </button>
              ))}
            </div>
            {channel === 'dine_in' && (
              <button onClick={() => setTableOpen(true)} className="mt-2 flex w-full items-center justify-between rounded-xl border border-dashed border-ink-300 px-3 py-2 text-[12.5px] hover:border-matcha-400 dark:border-ink-700">
                <span className="flex items-center gap-2 text-ink-600 dark:text-ink-300"><Utensils size={13} /> {tableId ? tables.find((t) => t.id === tableId)?.name : 'Chọn bàn'}</span>
                <span className="text-matcha-600">Chọn</span>
              </button>
            )}
            {channel === 'delivery' && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={source} onChange={(e) => setSource(e.target.value as any)} className="h-9 text-[12px]">
                    <option value="grabfood">GrabFood</option>
                    <option value="shopeefood">ShopeeFood</option>
                    <option value="website">Website</option>
                    <option value="app">App</option>
                  </Select>
                  <MoneyInput value={deliveryFee} onChange={setDeliveryFee} className="h-9 text-[12px]" />
                </div>
                <div className="flex gap-1.5">
                  <Input value={deliveryAddress} onChange={(e) => { setDeliveryAddress(e.target.value); setDeliveryGeo(null) }} placeholder="Địa chỉ giao hàng" className="h-9 text-[12px]" />
                  <Button size="sm" variant={deliveryGeo ? 'secondary' : 'primary'} className="h-9 shrink-0" icon={<MapPin size={13} />} onClick={() => setGeoOpen(true)}>
                    {deliveryGeo ? `${deliveryGeo.distanceKm}km` : 'Bản đồ'}
                  </Button>
                </div>
                {deliveryGeo && <p className="text-[10.5px] text-matcha-700 dark:text-matcha-300">Tuyến OSRM {deliveryGeo.distanceKm} km · ~{deliveryGeo.etaMin} phút · phí {formatVND(deliveryFee)}</p>}
              </div>
            )}
          </div>

          {/* customer */}
          <button onClick={() => setCustomerOpen(true)} className="flex items-center gap-2 border-b border-ink-100 px-3 py-2.5 text-left hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/50">
            <div className={cx('flex h-8 w-8 items-center justify-center rounded-xl text-[13px]', customer ? 'bg-matcha-50 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300' : 'bg-ink-100 text-ink-400 dark:bg-ink-800')}>
              {customer ? '💚' : <User size={15} />}
            </div>
            <div className="min-w-0 flex-1">
              {customer ? (
                <>
                  <p className="truncate text-[12.5px] font-semibold text-ink-900 dark:text-ink-50">{customer.name}</p>
                  <p className="text-[11px] text-ink-400">{customer.phone} · {TIER_LABEL[customer.tier].emoji} {TIER_LABEL[customer.tier].label} · {customer.points} điểm</p>
                </>
              ) : (
                <p className="text-[12.5px] text-ink-500">Khách lẻ — thêm khách để tích điểm</p>
              )}
            </div>
            <span className="text-[11.5px] text-matcha-600">{customer ? 'Đổi' : 'Thêm'}</span>
          </button>

          {/* lines */}
          <div className="min-h-[120px] flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <EmptyState icon={<ShoppingBag size={20} />} title="Chưa có món nào" description="Chọn món ở cột bên trái để bắt đầu đơn mới." />
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {lines.map((l) => (
                  <li key={l.uid} className="group px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-[17px]">{l.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold leading-tight text-ink-900 dark:text-ink-50">{l.productName}</p>
                        <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-500">
                          {l.size} · đường {l.sugar}% · đá {l.ice}%
                          {l.toppings.length > 0 && <> · {l.toppings.map((t) => t.name).join(', ')}</>}
                        </p>
                        {l.note && <p className="text-[10.5px] italic text-caramel-600">“{l.note}”</p>}
                      </div>
                      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-900 dark:text-ink-50">{formatVND(linePrice(l))}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <div className="flex items-center rounded-lg border border-ink-200 dark:border-ink-700">
                        <button className="px-2 py-1 text-ink-500 hover:text-ink-900" aria-label="Giảm" onClick={() => setLines((p) => p.flatMap((x) => (x.uid === l.uid ? (x.qty === 1 ? [] : [{ ...x, qty: x.qty - 1 }]) : [x])))}><Minus size={12} /></button>
                        <span className="min-w-6 text-center text-[12px] font-semibold tabular-nums">{l.qty}</span>
                        <button className="px-2 py-1 text-ink-500 hover:text-ink-900" aria-label="Tăng" onClick={() => setLines((p) => p.map((x) => (x.uid === l.uid ? { ...x, qty: x.qty + 1 } : x)))}><Plus size={12} /></button>
                      </div>
                      <IconButton label="Sửa tuỳ chọn" className="h-7 w-7" onClick={() => setCustomizing({ product: products.find((p) => p.id === l.productId)!, editUid: l.uid })}><MoreHorizontal size={14} /></IconButton>
                      <IconButton label="Nhân đôi" className="h-7 w-7" onClick={() => setLines((p) => [...p, { ...l, uid: uid() }])}><Layers size={13} /></IconButton>
                      <IconButton label="Xoá món" className="h-7 w-7 text-rose-500 hover:bg-rose-50" onClick={() => setCancelLine(l)}><Trash2 size={13} /></IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* totals */}
          <div className="border-t border-ink-100 p-3 dark:border-ink-800">
            {promo.amount > 0 && (
              <button onClick={() => setUsePromo((v) => !v)} className={cx('mb-2 flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11.5px]', usePromo ? 'border-matcha-300 bg-matcha-50 text-matcha-800 dark:border-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-200' : 'border-ink-200 text-ink-500 dark:border-ink-700')}>
                <Gift size={14} />
                <span className="flex-1 truncate">{promo.label}</span>
                <span className="font-semibold">−{formatVND(promo.amount)}</span>
                <span className={cx('flex h-4 w-4 items-center justify-center rounded-full border', usePromo ? 'border-matcha-600 bg-matcha-600 text-white' : 'border-ink-300')}>{usePromo && <Check size={11} />}</span>
              </button>
            )}

            <div className="mb-2 flex gap-1.5">
              <Input value={voucherCode} onChange={(e) => { setVoucherCode(e.target.value); setVoucherError('') }} placeholder="Mã voucher" className="h-9 text-[12px] uppercase" />
              <Button size="sm" variant="secondary" onClick={applyVoucher}>Áp dụng</Button>
            </div>
            {voucherError && <p className="mb-2 text-[11px] text-rose-600">{voucherError}</p>}
            {voucher && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-matcha-50 px-2.5 py-1.5 text-[11.5px] text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-200">
                <span className="flex items-center gap-1.5"><BadgePercent size={13} /> {voucher.code}</span>
                <span className="flex items-center gap-2 font-semibold">−{formatVND(voucher.discount)} <button onClick={() => { setVoucher(null); setVoucherCode('') }} aria-label="Bỏ voucher"><X size={12} /></button></span>
              </div>
            )}

            {customer && customer.points > 0 && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-cream-200/70 px-2.5 py-1.5 text-[11.5px] dark:bg-ink-800">
                <span className="flex items-center gap-1.5 text-ink-600 dark:text-ink-300"><Sparkles size={13} /> Dùng điểm ({customer.points})</span>
                <input type="range" min={0} max={Math.floor(maxPoints)} value={pointsUsed} onChange={(e) => setPointsUsed(Number(e.target.value))} className="h-1 w-20 accent-matcha-600" />
                <span className="w-14 text-right font-semibold tabular-nums">{formatVND(pointsValue)}</span>
              </div>
            )}

            <dl className="space-y-1 text-[12px]">
              <Row label="Tạm tính" value={formatVND(subtotal)} />
              {promoDiscount > 0 && <Row label="Khuyến mãi tự động" value={`−${formatVND(promoDiscount)}`} tone="green" />}
              {voucherDiscount > 0 && <Row label="Voucher" value={`−${formatVND(voucherDiscount)}`} tone="green" />}
              {pointsValue > 0 && <Row label="Điểm tích luỹ" value={`−${formatVND(pointsValue)}`} tone="green" />}
              {channel === 'delivery' && <Row label="Phí giao hàng" value={formatVND(deliveryFee)} />}
              <Row label={`VAT ${(vatRate * 100).toFixed(0)}% (đã gồm)`} value={formatVND(vatAmount)} muted />
            </dl>
            <div className="my-2 flex items-end justify-between border-t border-dashed border-ink-200 pt-2 dark:border-ink-700">
              <span className="text-[12.5px] font-medium text-ink-600 dark:text-ink-300">Khách phải trả</span>
              <span className="text-[21px] font-bold tracking-tight text-matcha-700 dark:text-matcha-300">{formatVND(total)}</span>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-1.5">
              <Button variant="secondary" size="lg" icon={<PauseCircle size={16} />} onClick={holdOrder} disabled={!lines.length}>Giữ</Button>
              <Button variant="primary" size="lg" icon={<Wallet size={17} />} onClick={() => setPaymentOpen(true)} disabled={!lines.length}>
                Thanh toán
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------- modals ---------------- */}
      {customizing && (
        <CustomizeModal
          product={customizing.product}
          editUid={customizing.editUid}
          allToppings={allToppings}
          initial={lines.find((l) => l.uid === customizing.editUid)}
          onClose={() => setCustomizing(null)}
          onAdd={(cfg) => { addToCart(customizing.product, { ...cfg, editUid: customizing.editUid }); setCustomizing(null) }}
        />
      )}

      {paymentOpen && (
        <PaymentModal
          total={total}
          subtotal={subtotal}
          code={undefined}
          onClose={() => setPaymentOpen(false)}
          onConfirm={doCheckout}
        />
      )}

      {geoOpen && (
        <DeliveryGeoModal
          branchId={branchId}
          onClose={() => setGeoOpen(false)}
          onPick={(p) => {
            setDeliveryAddress(p.address)
            setDeliveryFee(p.fee)
            setDeliveryGeo({ lat: p.lat, lng: p.lng, distanceKm: p.distanceKm, etaMin: p.etaMin })
            setGeoOpen(false)
          }}
        />
      )}

      {customerOpen && (
        <CustomerModal
          onClose={() => setCustomerOpen(false)}
          onPick={(c) => { setCustomer(c); setPointsUsed(0); setCustomerOpen(false) }}
        />
      )}

      {tableOpen && (
        <TableModal tables={tables} selected={tableId} onClose={() => setTableOpen(false)} onPick={(id) => { setTableId(id); setTableOpen(false) }} />
      )}

      {heldOpen && (
        <Modal open onClose={() => setHeldOpen(false)} title="Đơn đang giữ" description={`${held.length} đơn chờ xử lý`} size="md">
          {held.length === 0 ? <EmptyState icon={<PauseCircle size={20} />} title="Không có đơn chờ" description="Dùng nút Giữ để tạm lưu đơn và mở lại sau." /> : (
            <ul className="space-y-2">
              {held.map((h) => (
                <li key={h.id} className="flex items-center gap-3 rounded-xl border border-ink-200 p-3 dark:border-ink-700">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">{CHANNEL_LABEL[h.channel]} · {h.label}</p>
                    <p className="text-[11px] text-ink-400">{formatDateTime(h.at)} · {h.lines.map((l) => l.productName).join(', ').slice(0, 60)}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setHeld(held.filter((x) => x.id !== h.id))}>Xoá</Button>
                  <Button size="sm" variant="primary" onClick={() => reopenHeld(h)}>Mở lại</Button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}

      {shiftOpenModal && <ShiftModal onClose={() => setShiftOpenModal(false)} />}

      <ConfirmDialog
        open={!!cancelLine}
        title="Xoá món khỏi đơn?"
        message={`Món “${cancelLine?.productName}” sẽ bị xoá khỏi đơn hiện tại.`}
        confirmLabel="Xoá món"
        onCancel={() => setCancelLine(null)}
        onConfirm={() => { setLines((p) => p.filter((x) => x.uid !== cancelLine?.uid)); setCancelLine(null) }}
      />
    </div>
  )
}

function Row({ label, value, tone, muted }: { label: string; value: string; tone?: 'green'; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cx(muted ? 'text-ink-400' : 'text-ink-500 dark:text-ink-400')}>{label}</dt>
      <dd className={cx('tabular-nums', tone === 'green' ? 'font-medium text-matcha-700 dark:text-matcha-300' : muted ? 'text-ink-400' : 'text-ink-800 dark:text-ink-100')}>{value}</dd>
    </div>
  )
}

function CatChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx('flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-medium transition-all',
        active ? 'border-matcha-600 bg-matcha-600 text-white shadow-soft' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}
    >
      {icon}{label}
    </button>
  )
}

/* ------------------------- Customize modal ------------------------- */
function CustomizeModal({ product, initial, allToppings, onClose, editUid, onAdd }: {
  product: Product; initial?: CartLine; allToppings: Topping[]; onClose: () => void; editUid?: string
  onAdd: (cfg: { size: string; sugar: number; ice: number; toppings: { id: number; name: string; price: number }[]; note: string; qty: number }) => void
}) {
  const sizes = getProductSizes(product.id)
  const allowed = useMemo(() => getProductToppings(product.id), [product.id])
  const [size, setSize] = useState(initial?.size ?? (sizes.find((s) => s.code === 'M')?.code ?? sizes[0]?.code ?? 'M'))
  const [sugar, setSugar] = useState(initial?.sugar ?? 70)
  const [ice, setIce] = useState(initial?.ice ?? 70)
  const [picked, setPicked] = useState<string[]>(initial?.toppings.map((t) => t.name) ?? [])
  const [note, setNote] = useState(initial?.note ?? '')
  const [qty, setQty] = useState(initial?.qty ?? 1)

  const delta = sizes.find((s) => s.code === size)?.price_delta ?? 0
  const toppings = allowed.filter((t) => picked.includes(t.name))
  const unit = product.base_price + delta + toppings.reduce((s, t) => s + t.price, 0)

  return (
    <Modal
      open
      onClose={onClose}
      title={product.name}
      description={`${product.sku} · ${formatVND(product.base_price)} · giá vốn ${formatVND(product.cost_price)}`}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button variant="primary" size="lg" icon={<Plus size={16} />} onClick={() => onAdd({ size, sugar, ice, toppings: toppings.map((t) => ({ id: t.id, name: t.name, price: t.price })), note, qty })}>
            {editUid ? 'Cập nhật' : 'Thêm vào đơn'} · {formatVND(unit * qty)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {product.has_size === 1 && (
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-700 dark:text-ink-200">Size</p>
            <div className="grid grid-cols-3 gap-2">
              {sizes.map((s) => (
                <button key={s.code} onClick={() => setSize(s.code)}
                  className={cx('rounded-xl border px-3 py-2.5 text-center transition-all', size === s.code ? 'border-matcha-600 bg-matcha-50 dark:bg-matcha-900/30' : 'border-ink-200 hover:border-ink-300 dark:border-ink-700')}>
                  <span className="block text-[13px] font-semibold text-ink-900 dark:text-ink-50">{s.name}</span>
                  <span className="text-[11px] text-ink-500">{s.price_delta === 0 ? 'giá gốc' : `${s.price_delta > 0 ? '+' : ''}${formatVND(s.price_delta)}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {product.sugar_option === 1 && (
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-700 dark:text-ink-200">Mức đường</p>
            <div className="flex gap-1.5">
              {SUGAR.map((s) => (
                <button key={s} onClick={() => setSugar(s)} className={cx('flex-1 rounded-lg border py-2 text-[12px] font-medium transition-all', sugar === s ? 'border-matcha-600 bg-matcha-50 text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-200' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}>{s}%</button>
              ))}
            </div>
          </div>
        )}

        {product.ice_option === 1 && (
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-700 dark:text-ink-200">Mức đá</p>
            <div className="flex gap-1.5">
              {ICE.map((s) => (
                <button key={s} onClick={() => setIce(s)} className={cx('flex-1 rounded-lg border py-2 text-[12px] font-medium transition-all', ice === s ? 'border-matcha-600 bg-matcha-50 text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-200' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}>{s}%</button>
              ))}
            </div>
          </div>
        )}

        {allowed.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-700 dark:text-ink-200">Topping ({picked.length} đã chọn)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {allowed.map((t) => {
                const on = picked.includes(t.name)
                return (
                  <button key={t.id}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== t.name) : [...p, t.name]))}
                    className={cx('flex items-center justify-between rounded-lg border px-2.5 py-2 text-[12px] transition-all', on ? 'border-matcha-600 bg-matcha-50 text-matcha-900 dark:bg-matcha-900/30 dark:text-matcha-100' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}>
                    <span className="truncate">{t.name}</span>
                    <span className="ml-1 shrink-0 text-[11px] text-ink-500">+{formatVND(t.price).replace(' ₫', '')}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <Field label="Ghi chú cho pha chế">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: ít đá, không ống hút, thêm 1 ly riêng…" />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-ink-100/70 p-2.5 dark:bg-ink-800/70">
          <span className="text-[12.5px] font-medium text-ink-700 dark:text-ink-200">Số lượng</span>
          <div className="flex items-center gap-1">
            <IconButton label="Giảm" onClick={() => setQty((n) => Math.max(1, n - 1))}><Minus size={14} /></IconButton>
            <span className="w-8 text-center text-[15px] font-semibold tabular-nums">{qty}</span>
            <IconButton label="Tăng" onClick={() => setQty((n) => n + 1)}><Plus size={14} /></IconButton>
          </div>
        </div>
      </div>
    </Modal>
  )
}


/* ------------------- Chọn địa chỉ giao + tính phí theo bản đồ ------------------- */
function DeliveryGeoModal({ branchId, onClose, onPick }: {
  branchId: number
  onClose: () => void
  onPick: (p: { address: string; lat: number; lng: number; distanceKm: number; etaMin: number; fee: number }) => void
}) {
  const origin = BRANCH_GEO[branchId] ?? BRANCH_GEO[1]
  const [q, setQ] = useState('')
  const [places, setPlaces] = useState<{ display: string; lat: number; lng: number; district?: string }[]>([])
  const [picked, setPicked] = useState<{ display: string; lat: number; lng: number; district?: string } | null>(null)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [manual, setManual] = useState('')

  const search = async () => {
    setLoading(true)
    const res = await searchAddress(q)
    setPlaces(res.length ? res : DEMO_PLACES.map((p) => ({ display: p.address, lat: p.lat, lng: p.lng, district: p.district })))
    setLoading(false)
  }
  const choose = async (p: { display: string; lat: number; lng: number; district?: string }) => {
    setPicked(p)
    setRoute(await getRoute({ lat: origin.lat, lng: origin.lng }, { lat: p.lat, lng: p.lng }))
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Địa chỉ giao & phí ship" description="Tìm địa chỉ thật (OpenStreetMap) → tính tuyến đường OSRM → phí theo km"
      footer={<>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="primary" disabled={!picked || !route} icon={<Check size={15} />} onClick={() => {
          if (!picked || !route) return
          onPick({ address: picked.display, lat: picked.lat, lng: picked.lng, distanceKm: route.distanceKm, etaMin: route.durationMin, fee: deliveryFeeFor(route.distanceKm) })
        }}>Dùng địa chỉ này</Button>
      </>}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search() }} placeholder="72 Lê Thánh Tôn, Quận 1…" />
          <Button variant="primary" disabled={loading || q.length < 3} onClick={search}>{loading ? 'Đang tìm…' : 'Tìm'}</Button>
        </div>
        {places.length > 0 && (
          <div className="max-h-[160px] space-y-1 overflow-y-auto rounded-xl border border-ink-200 p-1.5 dark:border-ink-700">
            {places.map((p, i) => (
              <button key={i} onClick={() => choose(p)} className={cx('w-full rounded-lg px-2 py-1.5 text-left text-[11.5px] hover:bg-ink-50 dark:hover:bg-ink-800', picked?.display === p.display && 'bg-matcha-50 dark:bg-matcha-900/20')}>
                <p className="line-clamp-2 text-ink-700 dark:text-ink-200">{p.display}</p>
                {p.district && <p className="text-[10px] text-ink-400">{p.district}</p>}
              </button>
            ))}
          </div>
        )}
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Hoặc nhập địa chỉ tay (không tính phí tự động)" className="text-[12px]" />
        {manual.length > 5 && !picked && (
          <Button size="sm" variant="secondary" onClick={() => onPick({ address: manual, lat: 0, lng: 0, distanceKm: 0, etaMin: 0, fee: 0 })}>Dùng địa chỉ nhập tay</Button>
        )}
        <MapView
          markers={[
            { id: 'o', lat: origin.lat, lng: origin.lng, kind: 'branch', label: 'Quán' },
            ...(picked ? [{ id: 'c', lat: picked.lat, lng: picked.lng, kind: 'customer' as const, label: 'Điểm giao' }] : []),
          ]}
          route={route?.geometry}
          height={240}
        />
        {route && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-matcha-50 p-2.5 text-[12px] dark:bg-matcha-900/20">
            <span className="flex items-center gap-1"><RouteIcon size={13} /> {route.distanceKm} km</span>
            <span>~{route.durationMin} phút</span>
            <span className="font-semibold">Phí ship {formatVND(deliveryFeeFor(route.distanceKm))}</span>
            <span className="text-[10.5px] text-ink-400">nguồn: {route.source === 'osrm' ? 'OSRM (định tuyến thật)' : 'ước lượng offline'}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* --------------------------- Payment modal --------------------------- */
function PaymentModal({ total, subtotal, onClose, onConfirm }: { total: number; subtotal: number; code?: string; onClose: () => void; onConfirm: (p: { method: string; amount: number }[]) => void }) {
  const methods = [
    { id: 'cash', label: 'Tiền mặt', icon: Wallet, desc: 'Tiền thừa tự tính' },
    { id: 'qr', label: 'VietQR', icon: QrCode, desc: 'Chuyển khoản / QR' },
    { id: 'card', label: 'Thẻ', icon: CreditCard, desc: 'POS swipe' },
    { id: 'momo', label: 'MoMo', icon: Phone, desc: 'Ví điện tử' },
    { id: 'zalopay', label: 'ZaloPay', icon: Zap, desc: 'Ví điện tử' },
    { id: 'credit', label: 'Ghi nợ', icon: Receipt, desc: 'Cần quản lý duyệt' },
  ]
  const { branchId, toast } = useApp()
  const accounts = useSql(() => getBankAccounts(), [])
  const account = accounts.find((a) => a.branch_id === branchId) ?? accounts[0]
  const memo = useMemo(() => `MATCHA ${String(Math.floor(total / 1000)).padStart(3, '0')}K`, [total])
  const payload = useMemo(() => (account ? buildVietQR({ bankBin: account.bank_bin, accountNo: account.account_no, amount: total, memo, merchantName: 'MATCHA HOUSE' }) : ''), [account?.bank_bin, account?.account_no, total, memo])
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    if (!payload) return
    let alive = true
    QRCode.toDataURL(payload, { width: 320, margin: 1, errorCorrectionLevel: 'M' }).then((url) => { if (alive) setQrUrl(url) }).catch(() => {})
    return () => { alive = false }
  }, [payload])

  const [method, setMethod] = useState('cash')
  const [cash, setCash] = useState(total)
  const [split, setSplit] = useState(false)
  const [second, setSecond] = useState<{ method: string; amount: number } | null>(null)
  const change = method === 'cash' ? cash - total : 0
  const paid = split && second ? Math.min(total, cash) + second.amount : method === 'cash' ? Math.min(cash, total) : total
  const valid = split && second ? paid >= total : method === 'cash' ? cash >= total : true

  const confirm = () => {
    if (split && second) {
      const first = Math.min(total, Math.max(0, cash))
      onConfirm([{ method, amount: first }, { method: second.method, amount: Math.max(0, total - first) }])
    } else {
      onConfirm([{ method, amount: total }])
    }
  }

  return (
    <Modal
      open onClose={onClose} title="Thanh toán" description={`Khách phải trả ${formatVND(total)}`} size="lg"
      footer={<><Button onClick={onClose}>Huỷ</Button><Button variant="primary" size="lg" disabled={!valid} icon={<Check size={17} />} onClick={confirm}>Xác nhận &amp; in</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
        <div>
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => { setMethod(m.id); setSplit(false); if (m.id === 'cash') setCash(total) }}
                  className={cx('flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all', method === m.id ? 'border-matcha-600 bg-matcha-50 dark:bg-matcha-900/30' : 'border-ink-200 hover:border-ink-300 dark:border-ink-700')}>
                  <Icon size={18} className={method === m.id ? 'text-matcha-700' : 'text-ink-400'} />
                  <div>
                    <p className="text-[12.5px] font-semibold text-ink-900 dark:text-ink-50">{m.label}</p>
                    <p className="text-[10.5px] text-ink-400">{m.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <button onClick={() => { setSplit((v) => !v); setSecond(split ? null : { method: 'qr', amount: 0 }) }}
            className={cx('mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-[12px]', split ? 'border-caramel-400 bg-caramel-50 text-caramel-800 dark:bg-caramel-900/20' : 'border-ink-200 text-ink-600 dark:border-ink-700')}>
            <span>Thanh toán nhiều phương thức</span>
            <span className="text-[11px]">{split ? 'Đang bật' : 'Tắt'}</span>
          </button>

          {split && second && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-ink-50 p-2 dark:bg-ink-800/60">
              <Select value={second.method} onChange={(e) => setSecond({ ...second, method: e.target.value })} className="h-9 text-[12px]">
                {methods.filter((m) => m.id !== method).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
              <MoneyInput value={second.amount} onChange={(v) => setSecond({ ...second, amount: v })} className="h-9 text-[12px]" />
            </div>
          )}

          {method === 'cash' && !split && (
            <div className="mt-3">
              <p className="mb-1.5 text-[12px] font-medium text-ink-600 dark:text-ink-300">Tiền khách đưa</p>
              <MoneyInput value={cash} onChange={setCash} className="h-12 text-lg font-semibold" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DENOMS.map((d) => (
                  <button key={d} onClick={() => setCash((c) => c + d)} className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-[11.5px] font-medium text-ink-700 hover:border-matcha-400 dark:border-ink-700 dark:text-ink-200">+{formatVND(d, { compact: true })}</button>
                ))}
                <button onClick={() => setCash(total)} className="rounded-lg border border-matcha-300 bg-matcha-50 px-2.5 py-1.5 text-[11.5px] font-medium text-matcha-800 dark:bg-matcha-900/30">Đủ tiền</button>
              </div>
            </div>
          )}

          {method === 'qr' && (
            <div className="mt-3 rounded-xl border border-dashed border-ink-300 p-3 dark:border-ink-700">
              <div className="flex items-start gap-3">
                <div className="grid h-[132px] w-[132px] shrink-0 place-items-center rounded-lg bg-white p-1">
                  {qrUrl ? <img src={qrUrl} alt="VietQR" className="h-full w-full object-contain" /> : <span className="text-[10px] text-ink-400">Đang tạo QR…</span>}
                </div>
                <div className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                  <p className="font-semibold text-ink-900 dark:text-ink-50">VietQR · {account ? bankByBin(account.bank_bin)?.short : '—'}</p>
                  <p className="truncate">STK {account?.account_no ?? '—'} · {account?.account_name ?? '—'}</p>
                  <p>Số tiền <b>{formatVND(total)}</b></p>
                  <p className="truncate">Nội dung: <b>{memo}</b></p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button onClick={() => { navigator.clipboard?.writeText(payload); toast({ title: 'Đã copy payload VietQR', description: 'Chuẩn EMVCo · CRC hợp lệ', tone: 'success' }) }}
                      className="rounded border border-ink-200 px-1.5 py-0.5 text-[10.5px] dark:border-ink-700">Copy mã</button>
                    <button onClick={() => {
                      const a = document.createElement('a')
                      a.href = qrUrl; a.download = `vietqr-${total}.png`; a.click()
                    }} className="rounded border border-ink-200 px-1.5 py-0.5 text-[10.5px] dark:border-ink-700">Tải PNG</button>
                    <span className="rounded bg-matcha-50 px-1.5 py-0.5 text-[10px] text-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-300">
                      CRC {payload.slice(-4)}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-ink-400">
                Quét bằng app ngân hàng bất kỳ (Vietcombank, MB, Techcombank…) — mã đúng chuẩn NAPAS 247.
                Sau khi khách chuyển, bấm xác nhận; giao dịch sẽ nằm trong mục <b>Đối soát</b> ở trang Tài chính.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-matcha-900 p-4 text-white">
          <p className="text-[11.5px] uppercase tracking-wide text-white/50">Tổng thanh toán</p>
          <p className="mt-1 text-[26px] font-bold tracking-tight">{formatVND(total)}</p>
          <div className="mt-3 space-y-1 text-[11.5px] text-white/70">
            <div className="flex justify-between"><span>Tạm tính</span><span>{formatVND(subtotal)}</span></div>
            <div className="flex justify-between"><span>Khách đưa</span><span>{formatVND(method === 'cash' ? cash : total)}</span></div>
            <div className="flex justify-between border-t border-white/15 pt-1 text-matcha-200"><span>Tiền thừa</span><span className="font-semibold">{formatVND(Math.max(0, change))}</span></div>
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-white/40">
            Sau khi xác nhận: đơn vào KDS, nguyên liệu bị trừ theo công thức, khách được tích điểm và doanh thu cập nhật ngay.
          </p>
        </div>
      </div>
    </Modal>
  )
}

/* --------------------------- Customer modal -------------------------- */
function CustomerModal({ onClose, onPick }: { onClose: () => void; onPick: (c: Customer) => void }) {
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', birthday: '' })
  const results = useSql(() => (q.trim().length >= 2 ? searchCustomers(q.trim(), 12) : []), [q])
  const recent = useSql(() => searchCustomers('', 6), [])

  return (
    <Modal open onClose={onClose} title="Khách hàng" description="Tìm theo số điện thoại hoặc tên, hoặc tạo khách mới" size="md"
      footer={creating ? (
        <>
          <Button onClick={() => setCreating(false)}>Quay lại</Button>
          <Button variant="primary" disabled={!form.name || form.phone.length < 9}
            onClick={() => { const c = createCustomer(form); onPick(c) }}>Tạo &amp; chọn</Button>
        </>
      ) : undefined}>
      {creating ? (
        <div className="space-y-3">
          <Field label="Họ tên" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Thu Hà" /></Field>
          <Field label="Số điện thoại" required hint="Dùng làm khoá tra cứu tại quầy"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0901234567" inputMode="tel" /></Field>
          <Field label="Sinh nhật"><Input value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} placeholder="MM-DD, ví dụ 12-25" /></Field>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nhập SĐT hoặc tên khách…" className="pl-9" />
            </div>
            <Button variant="secondary" icon={<UserPlus size={16} />} onClick={() => setCreating(true)}>Khách mới</Button>
          </div>
          <div className="mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto">
            {(q.length >= 2 ? results : recent).map((c) => (
              <button key={c.id} onClick={() => onPick(c)} className="flex w-full items-center gap-3 rounded-xl border border-ink-200 p-2.5 text-left hover:border-matcha-400 dark:border-ink-700">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-200 text-sm dark:bg-ink-800">{TIER_LABEL[c.tier].emoji}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink-900 dark:text-ink-50">{c.name}</p>
                  <p className="text-[11px] text-ink-400">{c.phone} · {TIER_LABEL[c.tier].label} · {c.points} điểm · {formatVND(c.total_spent, { compact: true })}</p>
                </div>
                <Badge tone={c.tier === 'diamond' ? 'blue' : c.tier === 'gold' ? 'amber' : 'gray'}>{c.order_count} đơn</Badge>
              </button>
            ))}
            {q.length >= 2 && results.length === 0 && <p className="py-6 text-center text-[13px] text-ink-400">Không tìm thấy khách — bấm “Khách mới” để tạo.</p>}
          </div>
        </>
      )}
    </Modal>
  )
}

/* ----------------------------- Table modal --------------------------- */
function TableModal({ tables, selected, onClose, onPick }: { tables: ReturnType<typeof getTables>; selected: number | null; onClose: () => void; onPick: (id: number) => void }) {
  const zones = [...new Set(tables.map((t) => t.zone))]
  return (
    <Modal open onClose={onClose} title="Sơ đồ bàn" description="Chọn bàn cho đơn tại quán" size="lg">
      <div className="space-y-4">
        {zones.map((z) => (
          <div key={z}>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-400">{z}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {tables.filter((t) => t.zone === z).map((t) => (
                <button key={t.id} onClick={() => onPick(t.id)}
                  className={cx('rounded-2xl border p-3 text-center transition-all',
                    selected === t.id ? 'border-matcha-600 bg-matcha-600 text-white' :
                      t.status === 'occupied' ? 'border-caramel-300 bg-caramel-50 text-caramel-800 dark:bg-caramel-900/20' : 'border-ink-200 hover:border-matcha-400 dark:border-ink-700')}>
                  <p className="text-[13px] font-semibold">{t.name}</p>
                  <p className="text-[10.5px] opacity-70">{t.seats} chỗ · {t.status === 'occupied' ? 'đang dùng' : t.status === 'reserved' ? 'đặt trước' : 'trống'}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ---------------------------- Receipt modal -------------------------- */
function ReceiptModal({ data, onClose }: { data: { orderId: number; code: string; queue: number | null }; onClose: () => void }) {
  const detail = useSql(() => {
    const d = getOrderDetailSafe(data.orderId)
    return d
  }, [data.orderId])
  const branches = useSql(() => getBranches(), [])
  const branchId = useApp((s) => s.branchId)
  const branch = branches.find((b) => b.id === branchId)
  const [tab, setTab] = useState<'receipt' | 'labels'>('receipt')

  if (!detail) return null
  const { order, items, payments } = detail

  return (
    <Modal open onClose={onClose} title="In hoá đơn & tem ly" description={`Đơn ${order.code}${data.queue ? ` · số gọi ${data.queue}` : ''}`} size="md"
      footer={<><Button onClick={() => setTab(tab === 'receipt' ? 'labels' : 'receipt')}>{tab === 'receipt' ? 'Xem tem ly' : 'Xem hoá đơn'}</Button><Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>In (K80)</Button></>}>
      <div className="print-root">
        {tab === 'receipt' ? (
          <div className="print-area mx-auto w-[300px] rounded-lg bg-white p-4 font-mono text-[11px] leading-relaxed text-ink-900">
            <p className="text-center text-[13px] font-bold">{branch?.name}</p>
            <p className="text-center text-[10px]">{branch?.address}, {branch?.city}</p>
            <p className="text-center text-[10px]">ĐT: {branch?.phone}</p>
            <div className="print-hr my-2 border-t border-dashed border-ink-400" />
            <p className="text-center text-[12px] font-bold">HOÁ ĐƠN THANH TOÁN</p>
            <p className="text-center">Số: {order.code}</p>
            <p className="text-center">{formatDateTime(order.created_at)}</p>
            {data.queue && <p className="mt-1 text-center text-[15px] font-bold">SỐ GỌI: {data.queue}</p>}
            <div className="print-hr my-2 border-t border-dashed border-ink-400" />
            <table className="w-full">
              <thead><tr className="border-b border-ink-400"><th className="text-left">Món</th><th className="text-right">SL</th><th className="text-right">T.Tiền</th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="align-top">
                      {it.product_name} ({it.size_code})
                      <br /><span className="text-[9.5px]">Đường {it.sugar_level}% · Đá {it.ice_level}%</span>
                      {it.toppings?.length ? <><br /><span className="text-[9.5px]">+ {it.toppings.map((t) => t.topping_name).join(', ')}</span></> : null}
                      {it.note ? <><br /><span className="text-[9.5px] italic">* {it.note}</span></> : null}
                    </td>
                    <td className="text-right align-top">{it.qty}</td>
                    <td className="text-right align-top">{formatVND(it.unit_price * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="print-hr my-2 border-t border-dashed border-ink-400" />
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>Tạm tính</span><span>{formatVND(order.subtotal)}</span></div>
              {order.promotion_discount > 0 && <div className="flex justify-between"><span>Khuyến mãi</span><span>-{formatVND(order.promotion_discount)}</span></div>}
              {order.voucher_discount > 0 && <div className="flex justify-between"><span>Voucher</span><span>-{formatVND(order.voucher_discount)}</span></div>}
              {order.delivery_fee > 0 && <div className="flex justify-between"><span>Phí giao</span><span>{formatVND(order.delivery_fee)}</span></div>}
              <div className="flex justify-between"><span>VAT (đã gồm)</span><span>{formatVND(order.vat_amount)}</span></div>
              <div className="mt-1 flex justify-between border-t border-ink-400 pt-1 text-[13px] font-bold"><span>TỔNG</span><span>{formatVND(order.total)}</span></div>
            </div>
            <div className="print-hr my-2 border-t border-dashed border-ink-400" />
            {payments.map((p) => <div key={p.id} className="flex justify-between"><span>TT {p.method.toUpperCase()}</span><span>{formatVND(p.amount)}</span></div>)}
            <p className="mt-2 text-center text-[10px]">Cảm ơn quý khách! Hẹn gặp lại 🌿</p>
            <p className="text-center text-[9px]">Matcha POS · demo</p>
          </div>
        ) : (
          <div className="print-area print-area--labels mx-auto w-[300px]">
            {items.flatMap((it) => Array.from({ length: it.qty }).map((_, i) => (
              <div key={`${it.id}-${i}`} className="cup-label mb-2 border border-dashed border-ink-400 p-2 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold">{data.queue ?? order.code.slice(-4)}</span>
                  <span className="text-[10px]">{CHANNEL_LABEL[order.channel]}</span>
                </div>
                <p className="mt-1 text-[12.5px] font-bold">{it.product_name}</p>
                <p className="text-[10.5px]">Size {it.size_code} · Đường {it.sugar_level}% · Đá {it.ice_level}%</p>
                {it.toppings?.length ? <p className="text-[10.5px]">Topping: {it.toppings.map((t) => t.topping_name).join(', ')}</p> : null}
                {it.note ? <p className="text-[10.5px] italic">* {it.note}</p> : null}
                <p className="mt-1 text-[9px]">{order.code} · {formatDateTime(order.created_at)}</p>
              </div>
            )))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function getOrderDetailSafe(id: number) {
  return getOrderDetail(id)
}

/* ----------------------------- Shift modal --------------------------- */
function ShiftModal({ onClose }: { onClose: () => void }) {
  const { user, branchId, toast } = useApp()
  const shift = useSql(() => getShiftOpen(branchId), [branchId])
  const [opening, setOpening] = useState(500000)
  const [counted, setCounted] = useState(0)
  const [cashAmount, setCashAmount] = useState(0)
  const [cashReason, setCashReason] = useState('')
  const summary = useSql(() => (shift ? shiftSummary(shift.id) : null), [shift?.id])

  return (
    <Modal open onClose={onClose} title="Ca làm việc" description={shift ? `Ca #${shift.id} đang mở` : 'Chưa có ca nào đang mở'} size="md"
      footer={shift
        ? <><Button onClick={onClose}>Đóng</Button><Button variant="danger" disabled={!counted} onClick={() => { closeShift(shift.id, counted, ''); toast({ title: 'Đã chốt ca', description: `Chênh lệch ${formatVND(counted - (summary?.expected ?? 0))}`, tone: 'success' }); onClose() }}>Chốt ca</Button></>
        : <><Button onClick={onClose}>Đóng</Button><Button variant="primary" disabled={!user} onClick={() => { if (user) { openShift(branchId, user.id, opening); toast({ title: 'Đã mở ca', description: `Tiền đầu ca ${formatVND(opening)}`, tone: 'success' }); onClose() } }}>Mở ca</Button></>}>
      {shift && summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            <Info label="Thu ngân" value={user?.name ?? '—'} />
            <Info label="Mở lúc" value={formatDateTime(shift.opened_at)} />
            <Info label="Tiền đầu ca" value={formatVND(shift.opening_cash)} />
            <Info label="Số đơn trong ca" value={String(summary.orders)} />
            <Info label="Doanh thu ca" value={formatVND(summary.revenue)} />
            <Info label="Tiền mặt dự kiến" value={formatVND(summary.expected)} />
          </div>
          <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
            <p className="mb-2 text-[12px] font-semibold text-ink-700 dark:text-ink-200">Thu/chi tiền mặt trong ca</p>
            <div className="flex gap-2">
              <MoneyInput value={cashAmount} onChange={setCashAmount} className="h-9 text-[12px]" />
              <Input value={cashReason} onChange={(e) => setCashReason(e.target.value)} placeholder="Lý do" className="h-9 text-[12px]" />
              <Button size="sm" variant="secondary" disabled={!cashAmount} onClick={() => { addShiftCash(shift.id, 'in', cashAmount, cashReason, user!.id); setCashAmount(0); setCashReason('') }}>Nộp</Button>
              <Button size="sm" variant="secondary" disabled={!cashAmount} onClick={() => { addShiftCash(shift.id, 'out', cashAmount, cashReason, user!.id); setCashAmount(0); setCashReason('') }}>Rút</Button>
            </div>
          </div>
          <Field label="Tiền mặt kiểm đếm khi chốt ca" hint="Hệ thống so với tiền mặt dự kiến và ghi nhận chênh lệch">
            <MoneyInput value={counted} onChange={setCounted} />
          </Field>
          {counted > 0 && (
            <p className={cx('text-[12.5px] font-medium', counted - summary.expected === 0 ? 'text-matcha-700' : 'text-caramel-700')}>
              Chênh lệch: {formatVND(counted - summary.expected, { sign: true })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Tiền mặt đầu ca" hint="Kiểm đếm tiền trong két trước khi bắt đầu bán">
            <MoneyInput value={opening} onChange={setOpening} />
          </Field>
          <p className="rounded-xl bg-matcha-50 p-3 text-[12px] leading-relaxed text-matcha-900 dark:bg-matcha-900/30 dark:text-matcha-100">
            Mỗi ca gắn với một thu ngân và một chi nhánh. Cuối ca, hệ thống đối soát tiền mặt thực tế với tiền mặt lý thuyết
            (đầu ca + thu tiền mặt − chi tiền mặt).
          </p>
        </div>
      )}
    </Modal>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 px-2.5 py-2 dark:bg-ink-800/60">
      <p className="text-[10.5px] text-ink-400">{label}</p>
      <p className="font-semibold text-ink-800 dark:text-ink-100">{value}</p>
    </div>
  )
}
