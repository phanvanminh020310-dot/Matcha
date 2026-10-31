import { useSyncExternalStore, useMemo, useCallback, useState, useEffect } from 'react'
import { dbEvents } from '../lib/db'

let version = 0
const subscribe = (cb: () => void) => dbEvents.subscribe(() => { version++; cb() })
const getSnapshot = () => version

/** Tăng mỗi khi có ghi dữ liệu → hook query tự tính lại. */
export function useDbVersion() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Query đồng bộ trên SQLite, tự refresh sau mỗi lần ghi. */
export function useSql<T>(fn: () => T, deps: unknown[] = []): T {
  const v = useDbVersion()
  return useMemo(() => fn(), [v, ...deps])
}

/** Gọi lại sau X ms — dùng cho KDS / màn hình gọi số (đồng hồ, polling). */
export function useInterval(cb: () => void, ms: number | null) {
  useEffect(() => {
    if (ms === null) return
    const id = setInterval(cb, ms)
    return () => clearInterval(id)
  }, [cb, ms])
}

export function useTick(ms = 1000) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return t
}

export function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback((next: T) => {
    setValue(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }, [key])
  return [value, set] as const
}
