/**
 * Cửa quản trị CSDL: chỉ mở khi xác thực đúng tài khoản quản trị (kiểm tra ở Postgres).
 * Không có mật khẩu nào nằm trong mã nguồn app.
 */
import { useState } from 'react'
import { KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { adminLogin } from '../lib/adminAuth'
import { loadCloud, normCloudUrl, saveCloud } from '../lib/cloud'
import { Button, Card, Field, Input, Modal } from './ui'

export function AdminGate({ open, onClose, onUnlocked }: { open: boolean; onClose: () => void; onUnlocked: () => void }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const missing = (() => { const c = loadCloud(); return !normCloudUrl(c.url) || !c.key })()
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')

  const submit = async () => {
    setBusy(true)
    setErr(null)
    const conn = missing ? { url: url.trim(), key: key.trim() } : undefined
    if (missing && (!conn!.url || !conn!.key)) {
      setBusy(false); setErr('Nhập địa chỉ Supabase và anon key để kiểm tra tài khoản trên máy chủ.'); return
    }
    const r = await adminLogin(user, pass, conn)
    setBusy(false)
    if (!r.ok) { setErr(r.message ?? 'Đăng nhập thất bại'); setPass(''); return }
    if (conn) {
      // Máy mới: lưu kết nối ngay vào kho mã hoá của máy này để phần cài đặt dùng được.
      const cur = loadCloud()
      saveCloud({ ...cur, url: normCloudUrl(conn.url), key: conn.key, token: cur.token })
    }
    setUser(''); setPass(''); setUrl(''); setKey('')
    onUnlocked()
    onClose()
  }

  if (!open) return null

  return (
    <Modal open onClose={onClose} title="Quản trị cơ sở dữ liệu" size="sm" footer={
      <>
        <Button variant="ghost" onClick={onClose}>Đóng</Button>
        <Button variant="primary" icon={<KeyRound size={15} />} disabled={busy} onClick={submit}>{busy ? 'Đang kiểm tra…' : 'Mở khoá'}</Button>
      </>
    }>
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl bg-ink-50 p-2.5 text-[11.5px] leading-relaxed text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-matcha-600" />
          <span>
            Tài khoản quản trị được kiểm tra <b>trên máy chủ Postgres</b> (mật khẩu băm bcrypt, sai 5 lần khoá 15 phút).
            Không có mật khẩu nào nằm trong mã nguồn app, và chỉ phiên hợp lệ mới mở được thông tin kết nối.
          </span>
        </div>
        {missing && (
          <>
            <Field label="Địa chỉ Supabase (URL)">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" />
            </Field>
            <Field label="anon key (public)" hint="Dùng một lần để kiểm tra tài khoản; sau khi mở khoá sẽ được mã hoá lưu trên máy này.">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" autoComplete="off" />
            </Field>
          </>
        )}
        <Field label="Tài khoản quản trị">
          <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="admin" autoFocus autoComplete="off" />
        </Field>
        <Field label="Mật khẩu quản trị">
          <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••••" autoComplete="off"
            onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} />
        </Field>
        {err && <p className="rounded-xl bg-rose-50 p-2 text-[11.5px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-200"><Lock size={12} className="mr-1 inline" />{err}</p>}
      </div>
    </Modal>
  )
}

/** Thẻ chặn hiển thị khi người dùng chưa mở khoá quản trị. */
export function LockedNotice({ onUnlock }: { onUnlock: () => void }) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink-100 text-ink-500 dark:bg-ink-800">
          <Lock size={18} />
        </span>
        <div className="space-y-1">
          <p className="text-[13.5px] font-semibold text-ink-900 dark:text-ink-50">Khu vực được bảo vệ</p>
          <p className="max-w-md text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
            Thông tin kết nối cơ sở dữ liệu (địa chỉ Postgres, anon key, mã đồng bộ) chỉ hiện với <b>tài khoản quản trị</b>.
            Các tài khoản bán hàng/quản lý chi nhánh không xem được phần này.
          </p>
          <Button variant="primary" className="mt-2" icon={<KeyRound size={15} />} onClick={onUnlock}>Đăng nhập quản trị</Button>
        </div>
      </div>
    </Card>
  )
}
