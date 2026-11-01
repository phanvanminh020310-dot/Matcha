/**
 * Trang mở từ LINK DÙNG CHUNG: tự cấu hình cloud → tải toàn bộ dữ liệu → vào app.
 * Người nhận link không phải dán URL / anon key / mã đồng bộ gì cả.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CloudDownload, Loader2, TriangleAlert } from 'lucide-react'
import { pullAll, loadCloud, saveCloud, type SyncProgress } from '../lib/cloud'
import { applySharePayload, readShareFromLocation, type SharePayload } from '../lib/share'
import { isTursoUrl, loadTurso, tursoDelta } from '../lib/turso'
import { ensureRoles } from '../lib/permissions'
import { refreshRbac } from '../lib/rbac'
import { Button, Card } from '../components/ui'

export function JoinPage() {
  const navigate = useNavigate()
  const started = useRef(false)
  const [payload, setPayload] = useState<SharePayload | null>(null)
  const [step, setStep] = useState('Đang đọc link…')
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number>(0)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const p = readShareFromLocation()
    if (!p) {
      setError('Link này không có cấu hình cloud (có thể bị cắt khi gửi qua chat/email). Hãy copy lại đầy đủ link, hoặc vào Cài đặt → Cơ sở dữ liệu để tự dán thông tin.')
      return
    }
    setPayload(p)
    applySharePayload(p)
    setStep(isTursoUrl(p.url) ? 'Đang kết nối Turso…' : 'Đang kết nối Postgres…')
    const cfg = loadCloud()
    const job = isTursoUrl(p.url)
      ? tursoDelta(loadTurso(), (pr) => {
          setProgress(pr)
          if (!pr.done) setStep(`Đang tải bảng ${pr.table}…`)
        }).then((r) => ({ rows: r.applied }))
      : pullAll(cfg, (pr) => {
          setProgress(pr)
          if (!pr.done) setStep(`Đang tải bảng ${pr.table}…`)
        })
    job
      .then((res) => {
        saveCloud({ ...loadCloud(), autoSync: true, lastSync: new Date().toISOString(), lastRows: res.rows })
        ensureRoles()
        refreshRbac()
        setDone(res.rows)
        setStep('Xong')
        // dọn link để người dùng không vô tình gửi lại mã, rồi vào app
        setTimeout(() => {
          history.replaceState(null, '', `${location.pathname}#/login`)
          navigate('/login', { replace: true })
          location.reload()
        }, 1200)
      })
      .catch((e) => {
        setError((e as Error).message)
        setStep('Lỗi')
      })
  }, [navigate])

  const pct = progress ? Math.round((progress.index / progress.total) * 100) : 0

  return (
    <div className="grid min-h-dvh place-items-center bg-cream-100 p-5 dark:bg-ink-950">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-matcha-600 text-white">
            {error ? <TriangleAlert size={20} /> : done ? <CheckCircle2 size={20} /> : <CloudDownload size={20} />}
          </span>
          <div>
            <p className="text-[15px] font-bold text-ink-900 dark:text-ink-50">Matcha POS · Link dùng chung</p>
            <p className="text-[12px] text-ink-500 dark:text-ink-400">
              {payload
                ? `${payload.label || 'Chuỗi trà sữa'} · quyền ${
                    payload.mode === 'rw' ? 'làm việc (ghi đầy đủ)' : payload.mode === 'order' ? 'đặt hàng (chỉ ghi đơn & khách)' : 'chỉ xem'
                  }`
                : 'Đang kiểm tra link'}
            </p>
          </div>
        </div>

        {!error && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-[12.5px] text-ink-700 dark:text-ink-200">
              {done ? <CheckCircle2 size={15} className="text-matcha-600" /> : <Loader2 size={15} className="animate-spin text-matcha-600" />}
              <span>{done ? `Đã tải ${done.toLocaleString('vi-VN')} dòng — đang mở app…` : step}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
              <div className="h-full rounded-full bg-matcha-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            {progress && <p className="text-[11px] text-ink-400">{progress.index}/{progress.total} bảng · {progress.rows.toLocaleString('vi-VN')} dòng</p>}
          </div>
        )}

        {error && (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-rose-50 p-3 text-[12px] leading-relaxed text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">{error}</p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => { history.replaceState(null, '', `${location.pathname}#/settings`); location.reload() }}>Vào Cài đặt để dán tay</Button>
              <Button variant="ghost" onClick={() => { history.replaceState(null, '', `${location.pathname}#/login`); location.reload() }}>Dùng dữ liệu demo</Button>
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
          Link chứa sẵn địa chỉ Postgres + mã truy cập của chuỗi nên mở là dùng được. Nếu là link “chỉ xem”, mọi thao tác ghi đều bị Postgres chặn.
        </p>
      </Card>
    </div>
  )
}
