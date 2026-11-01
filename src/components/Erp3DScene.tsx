/**
 * Sân khấu 3D cho ERP Simulator: các module nằm trên một "bàn điều khiển" nghiêng 3D,
 * dây dữ liệu nối giữa các module có gói tin chạy liên tục, module đang xử lý phát sáng.
 * Thuần CSS 3D + SVG (không thêm thư viện), xoay/nghiêng/zoom bằng chuột.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Compass, Maximize2, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react'
import { cx } from '../lib/format'

export interface SceneModule {
  id: string
  label: string
  icon: string
  color: string
  desc: string
  stats: string[]
}

export interface SceneEdge { from: string; to: string; label: string }

const COLS = 4
const CELL_W = 300
const CELL_H = 232
const MARGIN = 72 // chừa viền để thẻ ở rìa không bị cắt khi nghiêng 3D
const BOARD_W = COLS * CELL_W + MARGIN * 2
const BOARD_H = Math.ceil(8 / COLS) * CELL_H + MARGIN * 2

export function Erp3DScene({
  modules, edges, activeId, running = true, onSelect, height = 470,
}: {
  modules: SceneModule[]
  edges: SceneEdge[]
  activeId: string | null
  running?: boolean
  onSelect?: (id: string) => void
  height?: number
}) {
  const [rot, setRot] = useState(-8)
  const [tilt, setTilt] = useState(48)
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState(0.78)
  const boxRef = useRef<HTMLDivElement>(null)
  const [spin, setSpin] = useState(false)
  const [play, setPlay] = useState(true)
  const drag = useRef<{ x: number; rot: number; tilt: number; mode: 'rot' | 'tilt' } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const packetRefs = useRef<{ el: SVGCircleElement; path: SVGPathElement; offset: number; speed: number }[]>([])

  const pos = useMemo(() => Object.fromEntries(modules.map((m, i) => [m.id, {
    x: MARGIN + (i % COLS) * CELL_W + CELL_W / 2,
    y: MARGIN + Math.floor(i / COLS) * CELL_H + CELL_H / 2,
  }])), [modules])

  const paths = useMemo(() => edges.map((e, i) => {
    const a = pos[e.from]
    const b = pos[e.to]
    if (!a || !b) return null
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2 - Math.abs(b.x - a.x) * 0.16 - 26
    return { id: `${e.from}-${e.to}-${i}`, d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`, edge: e }
  }).filter(Boolean) as { id: string; d: string; edge: SceneEdge }[], [edges, pos])

  // co giãn vừa khung: bàn 3D luôn nằm trọn trong khung nhìn, ở mọi kích thước màn hình
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const compute = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      const projectedH = BOARD_H * Math.cos((tilt * Math.PI) / 180) + 190
      setFit(Math.min(w / (BOARD_W * 1.06), h / projectedH) * 0.82)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tilt])

  // tự xoay chậm như bàn điều khiển
  useEffect(() => {
    if (!spin) return
    const t = setInterval(() => setRot((r) => r + 0.35), 40)
    return () => clearInterval(t)
  }, [spin])

  // gói dữ liệu chạy trên dây
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      packetRefs.current.forEach((p) => {
        if (!play) return
        p.offset = (p.offset + dt * p.speed) % 1
        try {
          const pt = p.path.getPointAtLength(p.offset * p.path.getTotalLength())
          p.el.setAttribute('cx', String(pt.x))
          p.el.setAttribute('cy', String(pt.y))
        } catch { /* path chưa render */ }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [play, paths.length])

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, rot, tilt, mode: e.shiftKey || e.button === 2 ? 'tilt' : 'rot' }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    if (drag.current.mode === 'rot') setRot(drag.current.rot + dx * 0.28)
    else setTilt(Math.max(20, Math.min(74, drag.current.tilt - dx * 0.22)))
  }
  const endDrag = () => { drag.current = null }

  const active = modules.find((m) => m.id === activeId)

  return (
    <div ref={boxRef} className="relative overflow-hidden rounded-2xl border border-ink-800 bg-[#070d14]" style={{ height }}>
      {/* nền không gian */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, #12263c 0%, #0a1420 42%, #05090f 100%)' }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{ backgroundImage: 'radial-gradient(rgba(120,180,255,.28) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

      <div
        className="absolute inset-0 grid place-items-center"
        style={{ perspective: '1500px', perspectiveOrigin: '50% 40%', cursor: drag.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="relative"
          style={{
            width: BOARD_W, height: BOARD_H,
            transformStyle: 'preserve-3d',
            transform: `translateY(-18px) scale(${(fit * zoom).toFixed(4)}) rotateX(${tilt}deg) rotateZ(${rot}deg)`,
            transition: drag.current ? 'none' : 'transform .25s ease-out',
          }}
        >
          {/* sàn bàn điều khiển */}
          <div className="absolute inset-0 rounded-[36px]" style={{
            transform: 'translateZ(0px)',
            background: 'linear-gradient(160deg, rgba(20,40,64,.95), rgba(9,17,28,.96))',
            boxShadow: 'inset 0 0 90px rgba(56,189,248,.10), 0 40px 90px rgba(0,0,0,.6)',
            border: '1px solid rgba(86,140,196,.28)',
          }} />
          <div className="absolute inset-0 rounded-[36px] opacity-25" style={{
            backgroundImage: 'linear-gradient(rgba(125,211,252,.32) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,.32) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            maskImage: 'radial-gradient(circle at 50% 50%, #000 55%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 55%, transparent 78%)',
          }} />

          {/* dây dữ liệu + gói tin (nằm trên sàn) */}
          <svg ref={svgRef} className="absolute inset-0" width={BOARD_W} height={BOARD_H} style={{ transform: 'translateZ(2px)' }}>
            <defs>
              <linearGradient id="wire" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.55" />
              </linearGradient>
            </defs>
            {paths.map((p) => {
              const hot = activeId && (p.edge.from === activeId || p.edge.to === activeId)
              const mid = paths.indexOf(p)
              return (
                <g key={p.id}>
                  <path d={p.d} fill="none" stroke={hot ? 'rgba(74,222,128,.28)' : 'rgba(125,211,252,.14)'} strokeWidth={hot ? 12 : 8} strokeLinecap="round" />
                  <path ref={(el) => {
                    if (!el) return
                    const speed = hot ? 0.55 : 0.28
                    if (!packetRefs.current.find((x) => x.offset === (mid % 7) / 7 && x.path === el)) {
                      /* đăng ký bên dưới qua vòng lặp packet */
                    }
                  }} d={p.d} fill="none" stroke="url(#wire)" strokeWidth={hot ? 2.6 : 1.6} strokeDasharray={hot ? '10 7' : '7 9'} strokeLinecap="round">
                    {running && <animate attributeName="stroke-dashoffset" from="0" to="-68" dur={hot ? '0.8s' : '1.8s'} repeatCount="indefinite" />}
                  </path>
                  {[0, 0.34, 0.67].map((phase, k) => (
                    <circle key={k} r={hot ? 4.6 : 3.2} fill={hot ? '#86efac' : '#7dd3fc'} opacity={hot ? 0.95 : 0.65}
                      ref={(el) => {
                        if (!el) return
                        const pathEl = el.parentElement?.querySelector('path:nth-of-type(2)') as SVGPathElement | null
                        if (!pathEl) return
                        const existing = packetRefs.current.find((x) => x.el === el)
                        if (!existing) packetRefs.current.push({ el, path: pathEl, offset: (k / 3 + mid * 0.13) % 1, speed: hot ? 0.5 : 0.26 })
                        else { existing.offset = existing.offset; existing.speed = hot ? 0.5 : 0.26 }
                      }}
                    />
                  ))}
                </g>
              )
            })}
          </svg>

          {/* module */}
          {modules.map((m) => {
            const p = pos[m.id]
            const isActive = activeId === m.id
            const z = isActive ? 60 : 34
            return (
              <div key={m.id} className="absolute" style={{
                left: p.x, top: p.y, width: 236, transformStyle: 'preserve-3d',
                transform: `translate3d(-50%, -50%, 0)`,
              }}>
                {/* bóng đổ trên sàn */}
                <div className="absolute left-1/2 top-1/2 rounded-full" style={{
                  width: 200, height: 54, transform: `translate(-50%, -50%) translateZ(1px)`,
                  background: `radial-gradient(ellipse at center, ${m.color}55, transparent 70%)`, filter: 'blur(9px)',
                }} />
                <div
                  onPointerDown={(e) => { if (isActive) e.stopPropagation() }}
                  onClick={() => onSelect?.(m.id)}
                  className="relative cursor-pointer rounded-2xl p-2.5 transition-shadow"
                  style={{
                    transform: `rotateZ(${-rot}deg) rotateX(${-tilt}deg) translateZ(${z}px)`,
                    transformOrigin: 'center center',
                    background: isActive
                      ? `linear-gradient(150deg, ${m.color}33, rgba(12,22,34,.96))`
                      : 'linear-gradient(150deg, rgba(24,38,56,.96), rgba(11,19,30,.97))',
                    border: `1px solid ${isActive ? m.color : 'rgba(120,160,200,.24)'}`,
                    boxShadow: isActive
                      ? `0 0 0 1px ${m.color}55, 0 0 34px ${m.color}55, 0 18px 40px rgba(0,0,0,.55)`
                      : '0 14px 30px rgba(0,0,0,.45)',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-6 w-6 place-items-center rounded-lg text-[13px]" style={{ background: `${m.color}26` }}>{m.icon}</span>
                    <span className="text-[12px] font-semibold text-white">{m.label}</span>
                    {isActive && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: m.color }} />}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{m.desc}</p>
                  <div className="mt-1.5 space-y-0.5">
                    {m.stats.map((s) => (
                      <p key={s} className="flex items-center gap-1 text-[10.5px] text-slate-200">
                        <span className="h-1 w-1 rounded-full" style={{ background: m.color }} />{s}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a1220]/85 px-2.5 py-1.5 backdrop-blur">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" /> SƠ ĐỒ 3D
        </span>
        <span className="text-[11px] text-slate-400">· {modules.length} module · {paths.length} luồng dữ liệu</span>
        {active && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${active.color}26`, color: active.color }}>{active.label} đang xử lý</span>}
      </div>

      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button title="Xoay trái" onClick={() => setRot((r) => r - 12)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[#0a1220]/85 text-slate-200 transition hover:bg-[#12253c]"><RotateCcw size={14} /></button>
        <button title="Xoay phải" onClick={() => setRot((r) => r + 12)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[#0a1220]/85 text-slate-200 transition hover:bg-[#12253c]"><Compass size={14} /></button>
        <button title="Phóng to" onClick={() => setZoom((z) => Math.min(1.6, z + 0.12))} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[#0a1220]/85 text-slate-200 transition hover:bg-[#12253c]"><Plus size={14} /></button>
        <button title="Thu nhỏ" onClick={() => setZoom((z) => Math.max(0.52, z - 0.12))} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[#0a1220]/85 text-slate-200 transition hover:bg-[#12253c]"><Minus size={14} /></button>
        <button title="Về mặc định" onClick={() => { setRot(-8); setTilt(54); setZoom(1) }} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[#0a1220]/85 text-slate-200 transition hover:bg-[#12253c]"><Maximize2 size={14} /></button>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0a1220]/88 px-2.5 py-2 backdrop-blur">
        <button onClick={() => setPlay((p) => !p)} className="flex items-center gap-1.5 rounded-lg bg-sky-500/90 px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-sky-400">
          {play ? <Pause size={13} /> : <Play size={13} />} {play ? 'Dừng gói tin' : 'Chạy gói tin'}
        </button>
        <button onClick={() => setSpin((s) => !s)} className={cx('rounded-lg border px-2.5 py-1.5 text-[11.5px] transition',
          spin ? 'border-sky-400/50 bg-sky-500/20 text-sky-200' : 'border-white/12 text-slate-200 hover:bg-white/10')}>
          {spin ? 'Dừng tự xoay' : 'Tự xoay'}
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
          Độ nghiêng
          <input type="range" min={20} max={74} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} className="w-24 accent-sky-400" />
        </label>
        <span className="ml-auto hidden text-[10px] text-slate-500 sm:block">Kéo để xoay · Shift + kéo để nghiêng · lăn chuột để zoom</span>
      </div>
    </div>
  )
}
