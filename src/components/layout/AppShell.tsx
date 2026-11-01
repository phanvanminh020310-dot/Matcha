import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Boxes, BookOpenCheck, ChartColumnBig, ChefHat, ChevronsLeft, ChevronsRight, CupSoda, Database, HeartHandshake,
  LayoutDashboard, LogOut, Menu, MonitorPlay, Moon, ReceiptText, Search, Settings, ShoppingCart, Sun, TicketPercent,
  Truck, Users, Wallet, Workflow, X, Command, Store, ChevronDown, RefreshCw, CircleHelp, Sparkles, Bike, Printer,
  DatabaseZap, ShieldCheck, Satellite,
} from 'lucide-react'
import { useApp } from '../../store/app'
import {navFor, type Role} from '../../lib/rbac'
import { getBranches, getActiveOrders, getProducts, getOrders, searchCustomers, type Branch } from '../../lib/api'
import { useSql } from '../../hooks/useDb'
import { cx, normalize, ROLE_LABEL } from '../../lib/format'
import { Badge, Button, IconButton, Kbd } from '../ui'
import { resetDatabase } from '../../lib/db'
import { checkWritePermission, loadCloud } from '../../lib/cloud'

const ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  ShoppingCart, ChefHat, MonitorPlay, ReceiptText, LayoutDashboard, Boxes, Truck, CupSoda, BookOpenCheck,
  TicketPercent, HeartHandshake, Users, ChartColumnBig, Wallet, Settings, Database, Workflow, Bike, Printer,
  DatabaseZap, ShieldCheck, Satellite,
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, branchId, setBranch, logout, theme, toggleTheme, sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [readOnly, setReadOnly] = useState(false)

  // Link chia sẻ "chỉ xem" → hiện nhãn để người dùng biết vì sao không sửa được dữ liệu
  useEffect(() => {
    const cfg = loadCloud()
    if (!cfg.url || !cfg.key) return
    let alive = true
    void checkWritePermission(cfg).then((w) => { if (alive && w === false) setReadOnly(true) })
    return () => { alive = false }
  }, [])

  const branches = useSql(() => getBranches(), [])
  const branch = branches.find((b) => b.id === branchId) ?? branches[0]
  const items = useMemo(() => {
    const list = role ? navFor(role as Role) : []
    // Máy dùng link CHỈ XEM: ẩn màn hình quản trị dữ liệu (ghi sẽ bị Postgres chặn)
    return readOnly ? list.filter((i) => i.to !== '/admin') : list
  }, [role, readOnly])
  const groups = useMemo(() => {
    const order: string[] = ['Bán hàng', 'Vận hành', 'Quản trị', 'Hệ thống']
    return order.map((g) => ({ group: g, items: items.filter((i) => i.group === g) })).filter((g) => g.items.length)
  }, [items])
  const activeOrders = useSql(() => (role === 'barista' || role ? getActiveOrders(branchId).length : 0), [branchId, role])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const currentLabel = items.find((i) => location.pathname.startsWith(i.to))?.label ?? 'Tổng quan'
  const compact = sidebarCollapsed

  return (
    <div className="flex min-h-dvh bg-cream-100 dark:bg-ink-950">
      {/* ---------------- Sidebar ---------------- */}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-ink-200/80 bg-white transition-[width,transform] duration-200 dark:border-ink-800 dark:bg-ink-900',
          compact ? 'w-[76px]' : 'w-[264px]',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-ink-100 px-4 dark:border-ink-800">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-matcha-600 text-lg shadow-soft">🍵</div>
          {!compact && (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight text-ink-900 dark:text-ink-50">Matcha POS</p>
              <p className="truncate text-[11px] text-ink-400">Chuỗi trà sữa &amp; cà phê</p>
            </div>
          )}
          <IconButton label="Đóng menu" className="ml-auto lg:hidden" onClick={() => setMobileNav(false)}><X size={18} /></IconButton>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Điều hướng chính">
          {groups.map((g) => (
            <div key={g.group} className="mb-4">
              {!compact && <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">{g.group}</p>}
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => setMobileNav(false)}
                        className={({ isActive }) =>
                          cx(
                            'group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13.5px] font-medium transition-colors',
                            isActive
                              ? 'bg-matcha-600 text-white shadow-soft'
                              : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
                            compact && 'justify-center px-0',
                          )
                        }
                        title={compact ? item.label : undefined}
                      >
                        <Icon size={18} className="shrink-0" />
                        {!compact && <span className="truncate">{item.label}</span>}
                        {item.badge === 'kds' && activeOrders > 0 && (
                          <span className={cx('ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold', compact ? 'absolute ml-6 mt-[-14px] bg-caramel-500 text-white' : 'bg-caramel-500 text-white')}>
                            {activeOrders}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-100 p-2.5 dark:border-ink-800">
          <button
            onClick={toggleSidebar}
            className="hidden w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] text-ink-500 hover:bg-ink-100 lg:flex dark:text-ink-400 dark:hover:bg-ink-800"
          >
            {compact ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Thu gọn menu</>}
          </button>
        </div>
      </aside>

      {mobileNavOpen && <div className="fixed inset-0 z-40 bg-ink-950/40 lg:hidden" onClick={() => setMobileNav(false)} />}

      {/* ---------------- Main ---------------- */}
      <div className={cx('flex min-w-0 flex-1 flex-col transition-[margin] duration-200', compact ? 'lg:ml-[76px]' : 'lg:ml-[264px]')}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-ink-200/80 bg-cream-100/85 px-3 backdrop-blur-xl dark:border-ink-800 dark:bg-ink-950/85 sm:px-5">
          <IconButton label="Mở menu" className="lg:hidden" onClick={() => setMobileNav(true)}><Menu size={20} /></IconButton>

          <div className="hidden min-w-0 shrink items-center gap-2 whitespace-nowrap text-[13px] text-ink-500 md:flex">
            <span className="hidden text-ink-400 xl:inline">{role ? ROLE_LABEL[role as Role] : ''}</span>
            <span className="hidden text-ink-300 xl:inline">/</span>
            <span className="truncate font-medium text-ink-800 dark:text-ink-100">{currentLabel}</span>
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto hidden h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-[13px] text-ink-400 transition-colors hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 md:flex lg:w-56 xl:w-64"
          >
            <Search size={15} />
            <span className="hidden whitespace-nowrap xl:inline">Tìm món, đơn, chức năng…</span>
            <span className="ml-auto hidden items-center gap-1 xl:flex"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
          </button>

          {/* branch switcher */}
          <div className="relative">
            <select
              value={branchId}
              onChange={(e) => setBranch(Number(e.target.value))}
              aria-label="Chọn chi nhánh"
              className="h-10 w-[104px] max-w-[168px] cursor-pointer appearance-none rounded-xl border border-ink-200 bg-white pl-8 pr-7 text-[13px] font-medium text-ink-800 focus:border-matcha-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 sm:w-auto"
            >
              {branches.map((b: Branch) => (
                <option key={b.id} value={b.id}>{b.code} · {b.city}</option>
              ))}
            </select>
            <Store size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-matcha-600" />
            <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-400" />
          </div>

          {readOnly && (
            <span title="Link chia sẻ chỉ đọc: Postgres chặn mọi thao tác ghi"
              className="rounded-full bg-amber-100 px-2 py-1 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              👁 chỉ xem
            </span>
          )}

          <IconButton label="Đổi giao diện sáng/tối" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</IconButton>

          <div className="flex items-center gap-2 border-l border-ink-200 pl-2 dark:border-ink-700">
            <div className="hidden text-right lg:block">
              <p className="max-w-[140px] truncate text-[13px] font-semibold leading-tight text-ink-900 dark:text-ink-50">{user?.name}</p>
              <p className="text-[11px] text-ink-400">{role ? ROLE_LABEL[role as Role] : ''}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-matcha-50 text-base dark:bg-matcha-900/40">{user?.avatar_emoji ?? '🧑'}</div>
            <IconButton label="Đăng xuất" onClick={() => { logout(); navigate('/login') }}><LogOut size={17} /></IconButton>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 pb-10 pt-4 sm:px-5">{children}</main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}

/* ---------------------------- Command palette ---------------------------- */
function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const role = useApp((s) => s.role)
  const branchId = useApp((s) => s.branchId)
  const items = useMemo(() => (role ? navFor(role as Role) : []), [role])
  const products = useSql(() => getProducts(), [])
  const orders = useSql(() => getOrders({ branchId, limit: 12 }).rows, [branchId])

  const results = useMemo(() => {
    const nq = normalize(q.trim())
    const nav = items.filter((i) => !nq || normalize(i.label).includes(nq)).slice(0, nq ? 6 : 8)
      .map((i) => ({ type: 'Chức năng', label: i.label, to: i.to, icon: ICONS[i.icon] ?? LayoutDashboard, hint: i.group }))
    const prod = !nq ? [] : products.filter((p) => normalize(p.name).includes(nq) || normalize(p.sku).includes(nq)).slice(0, 6)
      .map((p) => ({ type: 'Món', label: `${p.emoji} ${p.name}`, to: `/products?q=${encodeURIComponent(p.name)}`, icon: CupSoda, hint: p.sku }))
    const ord = !nq ? [] : orders.filter((o) => normalize(o.code).includes(nq) || normalize(o.customer_phone ?? '').includes(nq)).slice(0, 5)
      .map((o) => ({ type: 'Đơn hàng', label: `${o.code} · ${o.customer_name ?? 'Khách lẻ'}`, to: `/orders?order=${o.id}`, icon: ReceiptText, hint: o.status }))
    return [...nav, ...prod, ...ord]
  }, [q, items, products, orders])

  useEffect(() => setIndex(0), [q])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)) }
      if (e.key === 'Enter' && results[index]) { navigate(results[index].to); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [results, index, navigate, onClose])

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-ink-950/40 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-lift animate-fade-up dark:border-ink-700 dark:bg-ink-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 dark:border-ink-800">
          <Command size={16} className="text-ink-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm chức năng, món, mã đơn, SĐT khách…"
            className="h-12 flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none dark:text-ink-50"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-ink-400">Không tìm thấy kết quả nào</p>}
          {results.map((r, i) => {
            const Icon = r.icon
            return (
              <button
                key={`${r.type}-${r.label}-${i}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => { navigate(r.to); onClose() }}
                className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === index ? 'bg-matcha-50 dark:bg-ink-800' : 'hover:bg-ink-50 dark:hover:bg-ink-800/60')}
              >
                <Icon size={16} className="text-matcha-600" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-800 dark:text-ink-100">{r.label}</span>
                <Badge tone="gray">{r.type}</Badge>
                <span className="hidden w-20 truncate text-right text-[11px] text-ink-400 sm:block">{r.hint}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400 dark:border-ink-800">
          <span>↑↓ di chuyển</span><span>↵ mở</span><span>Ctrl K đóng</span>
        </div>
      </div>
    </div>
  )
}

/* --------------------------- Page header helper -------------------------- */
export function PageHeader({ title, description, actions, icon }: { title: string; description?: string; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-matcha-700 shadow-soft dark:bg-ink-900 dark:text-matcha-300">{icon}</div>}
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">{title}</h1>
          {description && <p className="mt-0.5 max-w-2xl text-[13px] text-ink-500 dark:text-ink-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function ResetDataButton() {
  const [busy, setBusy] = useState(false)
  const toast = useApp((s) => s.toast)
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      icon={<RefreshCw size={14} />}
      onClick={async () => {
        if (!confirm('Xoá toàn bộ dữ liệu hiện tại và nạp lại bộ dữ liệu demo 90 ngày?')) return
        setBusy(true)
        try {
          await resetDatabase()
          toast({ title: 'Đã nạp lại dữ liệu demo', description: 'CSDL mới đã được tạo trong IndexedDB.', tone: 'success' })
        } catch (e) {
          toast({ title: 'Nạp lại thất bại', description: String(e), tone: 'error' })
        } finally {
          setBusy(false)
        }
      }}
    >
      Reset dữ liệu demo
    </Button>
  )
}
