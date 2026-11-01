import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, CirclePause, CirclePlay, Footprints, GitCompareArrows, Info, RotateCcw, Sparkles, Workflow, Zap } from 'lucide-react'
import { SCENARIOS, diff, snapshot, type RowDiff, type SimContext } from '../lib/simulator'
import { lowStock } from '../lib/api'
import { all, scalar } from '../lib/db'
import { useSql } from '../hooks/useDb'
import { useApp } from '../store/app'
import { PageHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Select, Tooltip } from '../components/ui'
import { Erp3DScene } from '../components/Erp3DScene'
import { cx, formatNumber, formatVND, nowVN } from '../lib/format'


const MODULES: { id: string; label: string; icon: string; color: string; page: string; desc: string }[] = [
  { id: 'pos', label: 'POS', icon: '🧾', color: '#16a34a', page: '/pos', desc: 'Tạo đơn, thanh toán, in hoá đơn' },
  { id: 'kds', label: 'KDS', icon: '👩‍🍳', color: '#0ea5e9', page: '/kds', desc: 'Hàng đợi pha chế' },
  { id: 'inventory', label: 'Kho', icon: '📦', color: '#0891b2', page: '/inventory', desc: 'Tồn kho, thẻ kho, hao hụt' },
  { id: 'purchasing', label: 'Mua hàng', icon: '🚚', color: '#7c3aed', page: '/purchasing', desc: 'PO, nhận hàng, công nợ' },
  { id: 'finance', label: 'Tài chính', icon: '📊', color: '#e11d48', page: '/finance', desc: 'Sổ thu chi, P&L' },
  { id: 'crm', label: 'CRM', icon: '💚', color: '#fb7f14', page: '/customers', desc: 'Khách, điểm, hạng' },
  { id: 'reports', label: 'Báo cáo', icon: '📈', color: '#f59e0b', page: '/reports', desc: '11 loại báo cáo' },
  { id: 'data', label: 'Data Explorer', icon: '🗄️', color: '#64748b', page: '/data', desc: 'Schema, ERD, SQL' },
]

const FLOW_EDGES: [string, string, string][] = [
  ['pos', 'kds', 'order_events'],
  ['pos', 'inventory', 'inventory_txns'],
  ['pos', 'crm', 'customers'],
  ['inventory', 'purchasing', 'inventory_stock'],
  ['purchasing', 'finance', 'finance_entries'],
  ['pos', 'finance', 'payments'],
  ['kds', 'reports', 'orders'],
  ['inventory', 'reports', 'inventory_stock'],
  ['crm', 'reports', 'customers'],
  ['reports', 'data', 'SQL'],
]

function useLiveStats(branchId: number) {
  return useSql(() => {
    const today = nowVN().slice(0, 10)
    const orders = scalar<number>(`SELECT COUNT(*) FROM orders WHERE branch_id = ? AND date(created_at) = ?`, [branchId, today]) ?? 0
    const revenue = scalar<number>(`SELECT COALESCE(SUM(total),0) FROM orders WHERE branch_id = ? AND date(created_at) = ? AND status != 'cancelled'`, [branchId, today]) ?? 0
    const kds = scalar<number>(`SELECT COUNT(*) FROM orders WHERE branch_id = ? AND status IN ('pending','preparing')`, [branchId]) ?? 0
    const low = lowStock(branchId).length
    const poOpen = scalar<number>(`SELECT COUNT(*) FROM purchase_orders WHERE branch_id = ? AND status != 'received'`, [branchId]) ?? 0
    const debt = scalar<number>('SELECT COALESCE(SUM(debt),0) FROM suppliers') ?? 0
    const expense = scalar<number>(`SELECT COALESCE(SUM(amount),0) FROM finance_entries WHERE type = 'expense' AND substr(entry_date,1,7) = ?`, [today.slice(0, 7)]) ?? 0
    const customers = scalar<number>('SELECT COUNT(*) FROM customers') ?? 0
    const vouchers = scalar<number>('SELECT COUNT(*) FROM vouchers WHERE is_active = 1') ?? 0
    const tables = all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).length
    const rows = scalar<number>(`SELECT (SELECT COUNT(*) FROM orders) + (SELECT COUNT(*) FROM order_items) + (SELECT COUNT(*) FROM inventory_txns)`) ?? 0
    return { orders, revenue, kds, low, poOpen, debt, expense, customers, vouchers, tables, rows }
  }, [branchId])
}

export function ErpSimulatorPage() {
  const { branchId, user } = useApp()
  const stats = useLiveStats(branchId)
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [running, setRunning] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [speed, setSpeed] = useState(900)
  const [log, setLog] = useState<{ stepId: string; title: string; module: string; summary: string; diffs: RowDiff[] }[]>([])
  const [activeNode, setActiveNode] = useState<string | null>(null)
  const stateRef = useRef<Record<string, unknown>>({})

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!
  const ctx: SimContext = { branchId, userId: user?.id ?? 1, cashierId: user?.id ?? 1 }

  const reset = () => {
    setRunning(false); setStepIndex(0); setLog([]); stateRef.current = {}; setActiveNode(null)
  }

  const runStep = useCallback(() => {
    const step = scenario.steps[stepIndex]
    if (!step) { setRunning(false); return }
    const before = snapshot()
    let summary = ''
    try {
      summary = step.run(ctx, stateRef.current)
    } catch (e) {
      summary = `⚠️ Lỗi: ${(e as Error).message}`
    }
    const after = snapshot()
    const d = diff(before, after)
    setLog((l) => [...l, { stepId: step.id, title: step.title, module: step.module, summary, diffs: d }])
    setActiveNode(step.module.toLowerCase())
    setStepIndex((i) => i + 1)
  }, [scenario, stepIndex, branchId, user?.id])

  useEffect(() => {
    if (!running) return
    if (stepIndex >= scenario.steps.length) { setRunning(false); return }
    const t = setTimeout(() => runStep(), speed)
    return () => clearTimeout(t)
  }, [running, stepIndex, speed, runStep, scenario.steps.length])

  const nodeStats = (id: string) => {
    switch (id) {
      case 'pos': return [`${stats.orders} đơn hôm nay`, formatVND(stats.revenue, { compact: true })]
      case 'kds': return [`${stats.kds} phiếu đang xử lý`, 'đồng bộ realtime']
      case 'inventory': return [`${stats.low} mặt hàng dưới định mức`, 'thẻ kho đầy đủ']
      case 'purchasing': return [`${stats.poOpen} PO chưa nhận`, `nợ NCC ${formatVND(stats.debt, { compact: true })}`]
      case 'finance': return [`chi phí tháng ${formatVND(stats.expense, { compact: true })}`, 'P&L theo kỳ']
      case 'crm': return [`${formatNumber(stats.customers)} khách`, `${stats.vouchers} voucher bật`]
      case 'reports': return ['11 báo cáo', 'xuất CSV/Excel']
      case 'data': return [`${stats.tables} bảng`, `${formatNumber(stats.rows)} dòng nóng`]
      default: return []
    }
  }

  const latest = log[log.length - 1]
  const latestDiff = [...log].reverse().find((l) => l.diffs.length > 0) ?? latest
  const done = stepIndex >= scenario.steps.length

  return (
    <div>
      <PageHeader
        icon={<Workflow size={20} />}
        title="ERP Simulator"
        description="Chạy kịch bản nghiệp vụ trên chính CSDL đang dùng — mỗi bước ghi dữ liệu thật và hiện diff bảng/dòng/trước–sau"
        actions={<Badge tone="green" dot>sơ đồ 3D trực tiếp</Badge>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-3 py-2 dark:border-ink-800">
          <Badge tone="green" dot>số liệu sống</Badge>
          <span className="text-[11.5px] text-ink-500">Cạnh động khi module đang xử lý bước hiện tại · nút "Mở" để sang trang tương ứng</span>
          <Select value={activeNode ?? ''} onChange={(e) => setActiveNode(e.target.value || null)} className="ml-auto h-8 w-[170px] text-[11.5px]">
            <option value="">Mở module…</option>
            {MODULES.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
          </Select>
          {activeNode && (
            <a href={`#${MODULES.find((m) => m.id === activeNode)?.page ?? '/dashboard'}`} className="text-[11.5px] font-medium text-matcha-700 underline dark:text-matcha-300">Đi tới trang</a>
          )}
        </div>
        <Erp3DScene
          height={520}
          activeId={activeNode}
          running={running}
          onSelect={(id) => setActiveNode((cur) => (cur === id ? null : id))}
          modules={MODULES.map((m) => ({ id: m.id, label: m.label, icon: m.icon, color: m.color, desc: m.desc, stats: nodeStats(m.id) }))}
          edges={FLOW_EDGES.map(([from, to, label]) => ({ from, to, label }))}
        />
      </Card>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Kịch bản" subtitle="Chọn một kịch bản rồi chạy từng bước hoặc chạy tự động" icon={<Sparkles size={16} />}
            right={<Select value={String(speed)} onChange={(e) => setSpeed(Number(e.target.value))} className="h-8 w-[110px] text-[11.5px]">
              <option value="1600">Chậm</option><option value="900">Vừa</option><option value="350">Nhanh</option>
            </Select>} />
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {SCENARIOS.map((s) => (
              <button key={s.id} onClick={() => { setScenarioId(s.id); reset() }}
                className={cx('rounded-xl border p-2.5 text-left transition', scenarioId === s.id ? 'border-matcha-500 bg-matcha-50 dark:bg-matcha-900/20' : 'border-ink-200 hover:border-matcha-300 dark:border-ink-700')}>
                <p className="text-[12.5px] font-semibold text-ink-900 dark:text-ink-50">{s.icon} {s.name}</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-500 dark:text-ink-400">{s.description}</p>
                <p className="mt-1 text-[10px] text-ink-400">{s.steps.length} bước</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 p-3 dark:border-ink-800">
            <Button variant="primary" icon={running ? <CirclePause size={15} /> : <CirclePlay size={15} />} onClick={() => {
              if (done) { reset(); setTimeout(() => setRunning(true), 50); return }
              setRunning((r) => !r)
              if (!running && stepIndex === 0) setLog([])
            }}>{running ? 'Tạm dừng' : done ? 'Chạy lại' : 'Chạy tự động'}</Button>
            <Button icon={<Footprints size={15} />} disabled={running || done} onClick={runStep}>Bước tiếp ({stepIndex}/{scenario.steps.length})</Button>
            <Button icon={<RotateCcw size={15} />} onClick={reset}>Đặt lại</Button>
            <span className="ml-auto text-[11px] text-ink-400">{log.length} bước đã chạy · {log.reduce((s, l) => s + l.diffs.length, 0)} thay đổi dữ liệu</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Các bước thực thi" subtitle={scenario.name} icon={<Zap size={16} />} />
          <ol className="space-y-1.5 p-3">
            {scenario.steps.map((s, i) => {
              const doneStep = i < stepIndex
              const current = i === stepIndex && running
              const entry = log.find((l) => l.stepId === s.id)
              return (
                <li key={s.id} className={cx('rounded-xl border p-2.5 transition',
                  doneStep ? 'border-matcha-200 bg-matcha-50/60 dark:border-matcha-800 dark:bg-matcha-900/20' : current ? 'border-caramel-300 bg-caramel-50 dark:bg-caramel-900/20' : 'border-ink-200 dark:border-ink-700')}>
                  <div className="flex items-start gap-2">
                    <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                      doneStep ? 'bg-matcha-600 text-white' : current ? 'bg-caramel-500 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>{doneStep ? '✓' : i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-ink-900 dark:text-ink-50">{s.title}</p>
                      <p className="text-[10.5px] text-ink-500 dark:text-ink-400">{s.detail}</p>
                      {entry && <p className="mt-1 rounded-lg bg-white/70 px-2 py-1 text-[11px] text-ink-700 dark:bg-ink-900/60 dark:text-ink-200">{entry.summary}</p>}
                    </div>
                    <Badge tone="gray">{s.module}</Badge>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
      </div>

      <Card className="mt-3 overflow-hidden">
        <CardHeader title="Data diff" subtitle={latestDiff ? `Bước: ${latestDiff.title}` : 'Chưa chạy bước nào'} icon={<GitCompareArrows size={16} />}
          right={latestDiff ? <Badge tone="amber">{latestDiff.diffs.length} thay đổi</Badge> : undefined} />
        {!latestDiff && <EmptyState icon={<GitCompareArrows size={20} />} title="Bấm “Chạy tự động” hoặc “Bước tiếp”" description="Mỗi bước sẽ ghi dữ liệu thật và liệt kê bảng · dòng · giá trị trước → sau." />}
        {latestDiff && (
          <div className="max-h-[360px] overflow-auto">
            <table className="table-base">
              <thead><tr><th>Bảng</th><th>Dòng</th><th>Loại</th><th>Cột</th><th>Trước</th><th>Sau</th></tr></thead>
              <tbody>
                {latestDiff.diffs.slice(0, 60).flatMap((d) => (d.fields.length ? d.fields : [{ name: '—', before: '', after: '' }]).map((f, fi) => (
                  <tr key={`${d.table}-${d.rowId}-${fi}`}>
                    <td className="whitespace-nowrap font-mono text-[11px] text-ink-700 dark:text-ink-200">{d.table}</td>
                    <td className="whitespace-nowrap text-[11px] text-ink-500">#{d.rowId}{d.label ? ` · ${d.label}` : ''}</td>
                    <td><Badge tone={d.change === 'insert' ? 'green' : d.change === 'delete' ? 'red' : 'amber'}>{d.change === 'insert' ? 'thêm' : d.change === 'delete' ? 'xoá' : 'sửa'}</Badge></td>
                    <td className="font-mono text-[11px] text-ink-500">{f.name}</td>
                    <td className="max-w-[220px] truncate text-[11px] text-rose-600/80 line-through">{f.before || '—'}</td>
                    <td className="max-w-[220px] truncate text-[11px] font-medium text-matcha-700 dark:text-matcha-300">{f.after || '—'}</td>
                  </tr>
                )))}
              </tbody>
            </table>
            {latestDiff.diffs.length > 60 && <p className="px-3 py-2 text-[11px] text-ink-400">Hiển thị 60 / {latestDiff.diffs.length} thay đổi (đã gộp để dễ đọc)</p>}
            {latestDiff.diffs.length === 0 && <p className="px-3 py-6 text-center text-[12.5px] text-ink-400">Bước này chỉ đọc dữ liệu, không phát sinh thay đổi.</p>}
          </div>
        )}
      </Card>

      <Card className="mt-3 border-dashed">
        <div className="flex items-start gap-2 p-3 text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
          <Info size={14} className="mt-0.5 shrink-0 text-matcha-600" />
          <p>
            Simulator không mô phỏng bằng hình vẽ: mỗi bước gọi đúng hàm nghiệp vụ mà POS/back-office dùng
            (<code>checkout()</code>, <code>receivePO()</code>, <code>closeShift()</code>, <code>cancelOrder()</code>…), sau đó chụp 17 bảng liên quan
            trước và sau bước để tính diff. Vì vậy sau khi chạy, bạn mở Dashboard, Kho hay Data Explorer đều thấy số liệu đã đổi thật.
            Muốn quay về dữ liệu gốc? Dùng <b>Reset dữ liệu demo</b> ở Cài đặt / Data Explorer.
          </p>
        </div>
      </Card>
    </div>
  )
}
