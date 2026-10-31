import { useMemo, useState } from 'react'
import { Background, Controls, MarkerType, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Download, Focus, Layers } from 'lucide-react'
import { Badge, Button, Select } from './ui'
import { COLUMN_META, FK_EDGES, MODULES, TABLES, type ModuleKey } from '../lib/schema'
import { tableRowCount } from '../lib/db'
import { useDbVersion } from '../hooks/useDb'
import { downloadFile, formatNumber } from '../lib/format'

const NODE_W = 204
const NODE_H = 70

const MODULE_ORDER: ModuleKey[] = ['sales', 'inventory', 'crm', 'hr', 'finance', 'system']

export function computeLayout(tables = TABLES) {
  const positions: Record<string, { x: number; y: number }> = {}
  MODULE_ORDER.forEach((m, mi) => {
    const list = tables.filter((t) => t.module === m)
    list.forEach((t, i) => {
      positions[t.name] = { x: mi * (NODE_W + 116) + (i % 2) * 26, y: i * (NODE_H + 34) }
    })
  })
  return positions
}

/** Xuất ERD thành SVG độc lập (không phụ thuộc DOM của React Flow). */
export function buildERDSvg(visible: typeof TABLES, highlight: string | null) {
  const positions = computeLayout()
  const names = new Set(visible.map((t) => t.name))
  const boxes = visible.map((t) => ({ t, p: positions[t.name] }))
  const maxX = Math.max(...boxes.map((b) => b.p.x + NODE_W)) + 60
  const maxY = Math.max(...boxes.map((b) => b.p.y + NODE_H)) + 60
  const edges = FK_EDGES.filter((e) => names.has(e.from) && names.has(e.to))
  const edgeSvg = edges.map((e) => {
    const a = positions[e.from]; const b = positions[e.to]
    if (!a || !b) return ''
    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2
    const x2 = b.x + NODE_W / 2, y2 = b.y + NODE_H / 2
    const mx = (x1 + x2) / 2
    const active = highlight && (e.from === highlight || e.to === highlight)
    return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="${active ? '#16a34a' : '#c3cfc6'}" stroke-width="${active ? 2 : 1}" opacity="${highlight && !active ? 0.25 : 0.9}" />`
  }).join('')
  const nodeSvg = boxes.map(({ t, p }) => {
    const dim = highlight && highlight !== t.name && !FK_EDGES.some((e) => (e.from === highlight && e.to === t.name) || (e.to === highlight && e.from === t.name))
    return `<g opacity="${dim ? 0.35 : 1}">
      <rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="12" fill="#ffffff" stroke="${highlight === t.name ? '#16a34a' : '#dbe3dd'}" stroke-width="${highlight === t.name ? 2 : 1}" />
      <rect x="${p.x}" y="${p.y}" width="4" height="${NODE_H}" rx="2" fill="${MODULES[t.module].color}" />
      <text x="${p.x + 16}" y="${p.y + 24}" font-family="Be Vietnam Pro, sans-serif" font-size="12" font-weight="600" fill="#1b211d">${escapeXml(t.label)}</text>
      <text x="${p.x + 16}" y="${p.y + 42}" font-family="monospace" font-size="10" fill="#7f8d84">${escapeXml(t.name)}</text>
      <text x="${p.x + NODE_W - 14}" y="${p.y + 24}" text-anchor="end" font-family="Be Vietnam Pro, sans-serif" font-size="10" fill="#9aa79f">${COLUMN_META[t.name]?.length ?? 0} cột</text>
    </g>`
  }).join('')
  const legend = MODULE_ORDER.filter((m) => visible.some((t) => t.module === m)).map((m, i) =>
    `<g><circle cx="${30 + i * 130}" cy="${maxY - 18}" r="5" fill="${MODULES[m].color}" /><text x="${42 + i * 130}" y="${maxY - 14}" font-family="Be Vietnam Pro, sans-serif" font-size="11" fill="#5b6861">${escapeXml(MODULES[m].label)}</text></g>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">
  <rect width="${maxX}" height="${maxY}" fill="#fdfcf8" />
  <text x="24" y="30" font-family="Be Vietnam Pro, sans-serif" font-size="16" font-weight="700" fill="#14532d">Matcha POS — Sơ đồ quan hệ dữ liệu</text>
  ${edgeSvg}${nodeSvg}${legend}
</svg>`
}

function escapeXml(s: string) {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string))
}

export function ERDView({ onSelect }: { onSelect: (table: string) => void }) {
  useDbVersion()
  const [module, setModule] = useState<ModuleKey | 'all'>('all')
  const [highlight, setHighlight] = useState<string | null>(null)
  const positions = useMemo(computeLayout, [])
  const visible = useMemo(() => (module === 'all' ? TABLES : TABLES.filter((t) => t.module === module)), [module])

  const nodes: Node[] = useMemo(() => visible.map((t) => {
    const related = FK_EDGES.some((e) => (e.from === highlight && e.to === t.name) || (e.to === highlight && e.from === t.name))
    const dim = highlight && highlight !== t.name && !related
    return {
      id: t.name,
      position: positions[t.name],
      data: {
        label: (
          <div className="w-[196px] text-left">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[13px] font-semibold text-ink-900 dark:text-ink-50">{t.icon} {t.label}</span>
              <span className="shrink-0 rounded bg-ink-100 px-1 text-[9px] text-ink-500 dark:bg-ink-800 dark:text-ink-300">{formatNumber(tableRowCount(t.name))}</span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-ink-400">{t.name}</p>
            <p className="mt-0.5 truncate text-[9.5px] text-ink-400">{COLUMN_META[t.name]?.length ?? 0} cột</p>
          </div>
        ),
      },
      style: {
        width: NODE_W,
        padding: 8,
        borderRadius: 12,
        borderLeft: `4px solid ${MODULES[t.module].color}`,
        border: `1px solid ${highlight === t.name ? '#16a34a' : '#dbe3dd'}`,
        background: 'var(--erd-node-bg, #fff)',
        opacity: dim ? 0.35 : 1,
        boxShadow: highlight === t.name ? '0 0 0 3px rgba(22,163,74,.18)' : '0 1px 2px rgba(16,24,20,.06)',
      },
    }
  }), [visible, positions, highlight])

  const edges: Edge[] = useMemo(() => {
    const seen = new Set<string>()
    return FK_EDGES.filter((e) => {
      if (!positions[e.from] || !positions[e.to]) return false
      const key = `${e.from}->${e.to}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).map((e) => {
      const active = highlight && (e.from === highlight || e.to === highlight)
      const dim = highlight && !active
      return {
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        animated: !!active,
        style: { stroke: active ? '#16a34a' : '#c3cfc6', strokeWidth: active ? 2 : 1.2, opacity: dim ? 0.2 : 0.85 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: active ? '#16a34a' : '#c3cfc6' },
      } as Edge
    })
  }, [highlight, positions])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-2.5 dark:border-ink-800">
        <Select value={module} onChange={(e) => setModule(e.target.value as ModuleKey | 'all')} className="h-9 w-[190px] text-[12.5px]">
          <option value="all">Tất cả module ({TABLES.length} bảng)</option>
          {MODULE_ORDER.map((m) => <option key={m} value={m}>{MODULES[m].label} ({TABLES.filter((t) => t.module === m).length})</option>)}
        </Select>
        <Badge tone="gray">{FK_EDGES.length} quan hệ</Badge>
        {highlight && <Button size="sm" variant="secondary" icon={<Focus size={14} />} onClick={() => setHighlight(null)}>Bỏ tô sáng</Button>}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadFile('matcha-pos-erd.svg', buildERDSvg(visible, highlight), 'image/svg+xml')}>Xuất SVG</Button>
        </div>
      </div>
      <div className="erd-canvas h-[calc(100dvh-330px)] w-full bg-cream-100/60 dark:bg-ink-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 0.82 }}
          minZoom={0.25}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => { setHighlight(node.id); onSelect(node.id) }}
          nodesConnectable={false}
          nodesDraggable
          elementsSelectable
        >
          <Background gap={18} size={1} color="#d9e2db" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeStrokeWidth={2} maskColor="rgba(253,252,248,.72)" nodeColor={(n) => MODULES[TABLES.find((t) => t.name === n.id)?.module ?? 'sales'].color} style={{ height: 124, width: 196, border: '1px solid #e2e8e3', borderRadius: 12 }} />
        </ReactFlow>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-[11px] text-ink-500 dark:text-ink-400">
        <Layers size={12} />
        {MODULE_ORDER.map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: MODULES[m].color }} />{MODULES[m].label}</span>
        ))}
        <span className="ml-auto">Bấm vào bảng để tô sáng quan hệ · kéo để di chuyển · cuộn để zoom</span>
      </div>
    </div>
  )
}
