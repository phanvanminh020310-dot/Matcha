import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Info, Loader2, X } from 'lucide-react'
import { cx } from '../../lib/format'
import { useApp } from '../../store/app'

/* -------------------------------- Button -------------------------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'caramel'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  icon?: React.ReactNode
  block?: boolean
}
export function Button({ variant = 'secondary', size = 'md', loading, icon, block, className, children, disabled, ...rest }: ButtonProps) {
  const sizes = {
    sm: 'h-9 px-3 text-[13px] rounded-lg gap-1.5',
    md: 'h-11 px-4 text-sm rounded-xl gap-2',
    lg: 'h-12 px-5 text-[15px] rounded-2xl gap-2',
    xl: 'h-14 px-6 text-base rounded-2xl gap-2.5',
  }
  const variants = {
    primary: 'bg-matcha-600 text-white hover:bg-matcha-700 active:bg-matcha-800 shadow-soft',
    secondary: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 dark:bg-ink-800 dark:text-ink-100 dark:border-ink-700',
    ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    caramel: 'bg-caramel-500 text-white hover:bg-caramel-600',
  }
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none',
        sizes[size], variants[variant], block && 'w-full', className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({ className, label, children, active, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 transition-colors',
        'hover:bg-ink-100 hover:text-ink-800 dark:text-ink-300 dark:hover:bg-ink-800',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matcha-500',
        active && 'bg-matcha-50 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* --------------------------------- Card --------------------------------- */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-2xl border border-ink-200/80 bg-white shadow-soft dark:border-ink-800 dark:bg-ink-900', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, right, icon, className }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-start justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-ink-800 sm:px-5', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-matcha-50 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-ink-900 dark:text-ink-50">{title}</h3>
          {subtitle && <p className="truncate text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

/* -------------------------------- Badge --------------------------------- */
const badgeTones = {
  green: 'bg-matcha-50 text-matcha-700 ring-matcha-200 dark:bg-matcha-900/40 dark:text-matcha-300 dark:ring-matcha-800',
  amber: 'bg-caramel-50 text-caramel-700 ring-caramel-200 dark:bg-caramel-900/30 dark:text-caramel-300 dark:ring-caramel-800',
  red: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-900',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300',
  gray: 'bg-ink-100 text-ink-600 ring-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-700',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
}
export function Badge({ tone = 'gray', children, className, dot }: { tone?: keyof typeof badgeTones; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ring-inset', badgeTones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* -------------------------------- Inputs -------------------------------- */
export function Field({ label, hint, error, required, children, className }: { label?: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-ink-700 dark:text-ink-200">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 ' +
  'transition-colors focus:border-matcha-500 focus:outline-none focus:ring-2 focus:ring-matcha-500/20 ' +
  'dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50 dark:placeholder:text-ink-500'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, 'h-11', className)} {...rest} />
})

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'min-h-[80px] py-2.5', className)} {...rest} />
})

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(inputBase, 'h-11 pr-8', className)} {...rest}>
      {children}
    </select>
  )
})

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-matcha-500 focus-visible:ring-offset-2',
        checked ? 'bg-matcha-600' : 'bg-ink-300 dark:bg-ink-700')}
    >
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  )
}

/* --------------------------------- Modal -------------------------------- */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; description?: string
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-[min(96vw,1400px)]' }
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift animate-fade-up dark:bg-ink-900 sm:rounded-3xl', sizes[size])}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <div>
            <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-500 dark:text-ink-400">{description}</p>}
          </div>
          <IconButton label="Đóng" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-5 py-3 dark:border-ink-800 dark:bg-ink-950/40">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Xác nhận', tone = 'danger', onConfirm, onCancel, requireReason }: {
  open: boolean; title: string; message: string; confirmLabel?: string; tone?: 'danger' | 'primary'
  onConfirm: (reason?: string) => void; onCancel: () => void; requireReason?: boolean
}) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (open) setReason('') }, [open])
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm"
      footer={
        <>
          <Button onClick={onCancel}>Huỷ bỏ</Button>
          <Button variant={tone} disabled={requireReason && reason.trim().length < 3} onClick={() => onConfirm(reason)}>{confirmLabel}</Button>
        </>
      }>
      <div className="flex gap-3">
        <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-matcha-50 text-matcha-700')}>
          <AlertTriangle size={20} />
        </div>
        <div className="text-sm text-ink-600 dark:text-ink-300">{message}</div>
      </div>
      {requireReason && (
        <Field label="Lý do" required className="mt-4">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: khách đổi ý, nhập nhầm món…" />
        </Field>
      )}
    </Modal>
  )
}

/* --------------------------------- Tabs --------------------------------- */
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto rounded-xl bg-ink-100/80 p-1 dark:bg-ink-800/70', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all',
            value === t.value ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-900 dark:text-ink-50' : 'text-ink-500 hover:text-ink-800 dark:text-ink-400',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-ink-200/70 px-1.5 text-[10px] text-ink-600 dark:bg-ink-700 dark:text-ink-300">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------ Empty/Skeleton --------------------------- */
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500">{icon ?? <Info size={24} />}</div>
      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-ink-500 dark:text-ink-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-ink-200/70 dark:bg-ink-800', className)} />
}

/* --------------------------------- Stats -------------------------------- */
export function Stat({ label, value, sub, icon, tone = 'green', trend }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: 'green' | 'amber' | 'blue' | 'red' | 'violet'; trend?: number }) {
  const tones = {
    green: 'bg-matcha-50 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
    amber: 'bg-caramel-50 text-caramel-700 dark:bg-caramel-900/30 dark:text-caramel-300',
    blue: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    red: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-500 dark:text-ink-400">{label}</p>
        {icon && <div className={cx('flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}>{icon}</div>}
      </div>
      <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
        {trend !== undefined && (
          <span className={cx('inline-flex items-center gap-0.5 font-medium', trend >= 0 ? 'text-matcha-600' : 'text-rose-600')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend * 100).toFixed(1).replace('.', ',')}%
          </span>
        )}
        {sub}
      </div>
    </Card>
  )
}

export function ProgressBar({ value, tone = 'green', className }: { value: number; tone?: 'green' | 'amber' | 'red'; className?: string }) {
  const tones = { green: 'bg-matcha-500', amber: 'bg-caramel-500', red: 'bg-rose-500' }
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-ink-200/80 dark:bg-ink-800', className)}>
      <div className={cx('h-full rounded-full transition-all duration-500', tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  )
}

/* ------------------------------- Pagination ------------------------------ */
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-[13px] text-ink-500 dark:text-ink-400">
      <span>
        {total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} / {total.toLocaleString('vi-VN')} dòng
      </span>
      <div className="flex items-center gap-1">
        <IconButton label="Trang trước" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}><ChevronLeft size={16} /></IconButton>
        <span className="px-2 text-xs">Trang {page}/{pages}</span>
        <IconButton label="Trang sau" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}><ChevronRight size={16} /></IconButton>
      </div>
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">{children}</kbd>
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <span className="group relative inline-flex">
      <span aria-describedby={id}>{children}</span>
      <span id={id} role="tooltip" className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-ink-700">
        {label}
      </span>
    </span>
  )
}

/* -------------------------------- Toaster ------------------------------- */
export function Toaster() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  const icons = {
    success: <Check size={16} className="text-matcha-600" />,
    error: <X size={16} className="text-rose-600" />,
    warning: <AlertTriangle size={16} className="text-caramel-600" />,
    info: <Info size={16} className="text-sky-600" />,
  }
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(94vw,420px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-3.5 shadow-lift animate-fade-up dark:border-ink-700 dark:bg-ink-900">
          <div className="mt-0.5">{icons[t.tone]}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink-900 dark:text-ink-50">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{t.description}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-700" aria-label="Đóng thông báo"><X size={14} /></button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

/** Ô nhập số tiền có định dạng VND */
export function MoneyInput({ value, onChange, className, ...rest }: { value: number; onChange: (v: number) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value ? new Intl.NumberFormat('vi-VN').format(value) : '')
  useEffect(() => {
    setText(value ? new Intl.NumberFormat('vi-VN').format(value) : '')
  }, [value])
  return (
    <div className="relative">
      <Input
        inputMode="numeric"
        className={cx('pr-8 text-right tabular-nums', className)}
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, '')
          setText(raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '')
          onChange(Number(raw || 0))
        }}
        {...rest}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">₫</span>
    </div>
  )
}
