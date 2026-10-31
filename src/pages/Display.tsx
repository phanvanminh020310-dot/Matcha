import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Coffee, Sparkles } from 'lucide-react'
import { getActiveOrders, getOrderDetail, getOrders, type Order } from '../lib/api'
import { useSql, useTick } from '../hooks/useDb'
import { useApp } from '../store/app'
import { CHANNEL_LABEL, formatDate, formatTime, formatVND, nowVN, cx } from '../lib/format'

/** Màn hình phụ dành cho khách: số đang pha chế, số sẵn sàng nhận và đơn gần nhất. */
export function DisplayPage() {
  const tick = useTick(1000)
  const branchId = useApp((s) => s.branchId)
  const [now, setNow] = useState(nowVN())
  useEffect(() => setNow(nowVN()), [tick])

  const active = useSql(() => getActiveOrders(branchId), [branchId, tick > 0])
  const latest = useSql(() => getOrders({ branchId, limit: 1 }).rows[0] as Order | undefined, [branchId, tick > 0])
  const detail = useSql(() => (latest ? getOrderDetail(latest.id) : null), [latest?.id])

  const preparing = active.filter((o) => o.status === 'pending' || o.status === 'preparing')
  const ready = active.filter((o) => o.status === 'ready')

  return (
    <div className="relative min-h-dvh overflow-hidden bg-matcha-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-matcha-700/50 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-caramel-600/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,.08),transparent_50%)]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-[1600px] flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl backdrop-blur">🍵</div>
            <div>
              <p className="text-[20px] font-semibold tracking-tight">Matcha House</p>
              <p className="text-[12px] text-white/50">Quầy phục vụ · vui lòng theo dõi số thứ tự</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[34px] font-bold leading-none tabular-nums">{now.slice(11, 16)}</p>
            <p className="text-[12px] text-white/50">{formatDate(now)}</p>
          </div>
        </header>

        <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* ready */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-matcha-300" />
              <h2 className="text-[15px] font-semibold text-matcha-200">Sẵn sàng nhận</h2>
              <span className="ml-auto text-[12px] text-white/40">{ready.length} đơn</span>
            </div>
            {ready.length === 0 ? (
              <p className="py-16 text-center text-[15px] text-white/30">Chưa có đơn nào sẵn sàng — quý khách vui lòng chờ trong giây lát</p>
            ) : (
              <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {ready.map((o) => (
                  <div key={o.id} className="animate-pop rounded-2xl bg-matcha-400 px-3 py-5 text-center text-matcha-950 shadow-[0_10px_40px_-12px_rgba(92,186,121,.9)]">
                    <p className="text-[42px] font-black leading-none tabular-nums">{o.queue_no ?? '—'}</p>
                    <p className="mt-1 text-[11px] font-semibold opacity-70">{CHANNEL_LABEL[o.channel]}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* preparing */}
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
              <div className="flex items-center gap-2">
                <Coffee size={18} className="text-caramel-300" />
                <h2 className="text-[15px] font-semibold text-caramel-200">Đang chuẩn bị</h2>
                <span className="ml-auto text-[12px] text-white/40">{preparing.length} đơn</span>
              </div>
              {preparing.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-white/30">Đang trống</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {preparing.map((o) => (
                    <div key={o.id} className="rounded-xl bg-white/10 px-4 py-3 text-center">
                      <p className="text-[26px] font-bold leading-none tabular-nums text-white">{o.queue_no ?? '—'}</p>
                      <p className="mt-1 text-[10.5px] text-white/40">{o.status === 'pending' ? 'chờ' : 'đang pha'}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* latest order summary */}
            <section className="flex-1 rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
              <h2 className="text-[15px] font-semibold text-white/80">Đơn gần nhất</h2>
              {detail ? (
                <>
                  <p className="mt-1 text-[12px] text-white/40">{detail.order.code} · {formatTime(detail.order.created_at)}</p>
                  <ul className="mt-3 space-y-1.5 text-[13px]">
                    {detail.items.slice(0, 6).map((it) => (
                      <li key={it.id} className="flex justify-between gap-3">
                        <span className="truncate text-white/80">{it.qty}× {it.product_name} <span className="text-white/40">({it.size_code})</span></span>
                        <span className="shrink-0 tabular-nums text-white/60">{formatVND(it.unit_price * it.qty)}</span>
                      </li>
                    ))}
                    {detail.items.length > 6 && <li className="text-[11px] text-white/40">+{detail.items.length - 6} món khác…</li>}
                  </ul>
                  <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-3">
                    <span className="text-[12px] text-white/50">Tổng cộng</span>
                    <span className="text-[24px] font-bold tabular-nums text-matcha-200">{formatVND(detail.order.total)}</span>
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-[13px] text-white/30">Chưa có đơn nào hôm nay</p>
              )}
            </section>
          </div>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[11.5px] text-white/35">
          <p>Cảm ơn quý khách đã ghé Matcha House 🌿</p>
          <Link to="/pos" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/70 hover:bg-white/15">
            Quay lại POS <ArrowRight size={12} />
          </Link>
        </footer>
      </div>
    </div>
  )
}
