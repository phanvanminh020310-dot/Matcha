import { create } from 'zustand'
import type { User } from '../lib/api'
import type { Role } from '../lib/rbac'

export interface Toast { id: number; title: string; description?: string; tone: 'success' | 'error' | 'info' | 'warning' }

interface AppState {
  user: User | null
  role: Role | null
  branchId: number
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  commandOpen: boolean
  toasts: Toast[]
  login: (u: User) => void
  logout: () => void
  setBranch: (id: number) => void
  setTheme: (t: 'light' | 'dark') => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setMobileNav: (v: boolean) => void
  setCommandOpen: (v: boolean) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

function initialUser(): User | null {
  try {
    const raw = localStorage.getItem('matcha-user')
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  root.style.colorScheme = theme
}

const storedTheme = (localStorage.getItem('matcha-theme') as 'light' | 'dark' | null) ?? 'light'
applyTheme(storedTheme)

let toastId = 1

export const useApp = create<AppState>((set, get) => ({
  user: initialUser(),
  role: (initialUser()?.role as Role) ?? null,
  branchId: Number(localStorage.getItem('matcha-branch') ?? 1),
  theme: storedTheme,
  sidebarCollapsed: localStorage.getItem('matcha-sidebar') === '1',
  mobileNavOpen: false,
  commandOpen: false,
  toasts: [],
  login: (u) => {
    localStorage.setItem('matcha-user', JSON.stringify(u))
    set({ user: u, role: u.role })
  },
  logout: () => {
    localStorage.removeItem('matcha-user')
    set({ user: null, role: null })
  },
  setBranch: (id) => {
    localStorage.setItem('matcha-branch', String(id))
    set({ branchId: id })
  },
  setTheme: (t) => {
    localStorage.setItem('matcha-theme', t)
    applyTheme(t)
    set({ theme: t })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    localStorage.setItem('matcha-sidebar', next ? '1' : '0')
    set({ sidebarCollapsed: next })
  },
  setMobileNav: (v) => set({ mobileNavOpen: v }),
  setCommandOpen: (v) => set({ commandOpen: v }),
  toast: (t) => {
    const id = toastId++
    set({ toasts: [...get().toasts, { ...t, id }] })
    setTimeout(() => get().dismissToast(id), t.tone === 'error' ? 6000 : 3600)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const toast = (t: Omit<Toast, 'id'>) => useApp.getState().toast(t)
