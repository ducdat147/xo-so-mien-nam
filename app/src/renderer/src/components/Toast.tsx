import { useEffect, type ReactNode } from 'react'
import { api } from '../api'

export type ToastData =
  | { kind: 'saved'; files: string[] }
  | { kind: 'printed'; copies: number; printer?: string }
  | { kind: 'error'; title: string; text: string; action?: { label: string; run: () => void } }

const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p
const openLabel = (p: string) => (p.toLowerCase().endsWith('.pdf') ? 'Mở PDF' : 'Mở Word')

export function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  // Thông báo thành công tự ẩn; báo lỗi để người dùng tự đóng
  useEffect(() => {
    if (toast.kind === 'error') return
    const t = setTimeout(onClose, 10000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  const isError = toast.kind === 'error'
  let body: ReactNode
  let actions: ReactNode = null

  if (toast.kind === 'saved') {
    body = (
      <>
        <strong>Đã lưu {toast.files.length > 1 ? `${toast.files.length} file` : 'file'}</strong>
        <ul className="toast-files">{toast.files.map((f) => <li key={f}>{fileName(f)}</li>)}</ul>
      </>
    )
    actions = (
      <>
        {toast.files.map((f) => (
          <button key={f} type="button" className="btn" onClick={() => api.openFile(f)}>{openLabel(f)}</button>
        ))}
        <button type="button" className="btn" onClick={() => api.showInFolder(toast.files[0])}>Mở thư mục</button>
      </>
    )
  } else if (toast.kind === 'printed') {
    body = toast.printer
      ? <strong>Đã gửi {toast.copies} tờ tới máy in {toast.printer}</strong>
      : <strong>Đã gửi lệnh in</strong>
  } else {
    body = (
      <>
        <strong>{toast.title}</strong>
        {toast.text}
      </>
    )
    if (toast.action) {
      const { label, run } = toast.action
      actions = <button type="button" className="btn" onClick={() => { onClose(); run() }}>{label}</button>
    }
  }

  return (
    <div className={`toast${isError ? ' error' : ''}`} role={isError ? 'alert' : 'status'}>
      <div className="toast-head">
        <div className="toast-text">{body}</div>
        <button type="button" className="toast-close" aria-label="Đóng thông báo" onClick={onClose}>×</button>
      </div>
      {actions && <div className="toast-actions">{actions}</div>}
    </div>
  )
}
