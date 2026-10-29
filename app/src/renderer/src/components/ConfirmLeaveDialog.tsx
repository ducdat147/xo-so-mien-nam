import { useEffect, useRef, useState } from 'react'

/** Hỏi khi rời màn Cài đặt mà còn thay đổi chưa lưu. Esc = Ở lại. */
export function ConfirmLeaveDialog(props: {
  saving: boolean
  onStay: () => void
  onDiscard: () => void
  /** Lưu rồi rời màn; trả chuỗi lỗi, rỗng nếu lưu được. */
  onSave: () => Promise<string>
}) {
  const { saving, onStay, onDiscard, onSave } = props
  // Lỗi lưu nằm trong hộp: mở lại hộp lần sau không còn lỗi cũ
  const [error, setError] = useState('')
  const stayRef = useRef<HTMLButtonElement>(null)

  useEffect(() => stayRef.current?.focus(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onStay() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStay])

  return (
    <div className="modal-backdrop">
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-desc">
        <h2 id="leave-title">Cài đặt chưa được lưu</h2>
        <p id="leave-desc">Bạn đã sửa cài đặt nhưng chưa bấm “Lưu cài đặt”. Muốn làm gì với các thay đổi này?</p>
        {error && <p className="modal-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button ref={stayRef} type="button" className="btn ghost" onClick={onStay}>Ở lại</button>
          <button type="button" className="btn" onClick={onDiscard}>Bỏ thay đổi</button>
          <button type="button" className="btn accent" disabled={saving} onClick={async () => setError(await onSave())}>
            Lưu rồi quay lại
          </button>
        </div>
      </div>
    </div>
  )
}
