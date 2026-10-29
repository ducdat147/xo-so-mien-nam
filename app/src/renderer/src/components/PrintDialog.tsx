import { useEffect, useRef } from 'react'
import type { PrinterList } from '../hooks'
import { CopiesField } from './CopiesField'
import { Printer } from './icons'
import { printerLabel, PrinterSelect } from './PrinterSelect'
import { SheetPreview } from './SheetPreview'

/**
 * Bước xem trước khi in: trang in đúng như sẽ ra giấy (phóng to được), chọn máy in và số tờ,
 * rồi mới in. Chạy được cả khi máy chưa cài máy in (khi đó khoá nút In và báo rõ).
 * Không có nút lưu PDF ở đây (chủ dự án bỏ 29-10-2026): lưu file ở mục Lưu file của màn chính.
 */
export function PrintDialog(props: {
  html: string
  width: number
  height: number
  blank: boolean
  /** "Thứ Ba 27-10-2026 · A4 đứng · 4 phiếu/tờ" */
  summary: string
  perSheet: number
  paperName: string
  copies: number
  onCopies: (n: number) => void
  printers: PrinterList
  deviceName: string | null
  onDeviceName: (name: string | null) => void
  busy: boolean
  onPrint: () => void
  onClose: () => void
}) {
  const p = props
  const printBtn = useRef<HTMLButtonElement>(null)
  const noPrinter = !!p.printers.printers && p.printers.printers.length === 0

  // Chỉ focus nút In lúc mở hộp: chạy lại theo onClose thì mỗi lần đổi số tờ / máy in là focus nhảy đi
  useEffect(() => printBtn.current?.focus(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !p.busy) p.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p.busy, p.onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-backdrop print-backdrop">
      <div className="print-dialog" role="dialog" aria-modal="true" aria-labelledby="print-title">
        <div className="print-view">
          <SheetPreview html={p.html} width={p.width} height={p.height} blank={p.blank} label="Xem trước khi in" />
        </div>
        <div className="print-side">
          <div className="print-head">
            <h2 id="print-title">Xem trước khi in</h2>
            <p className="hint">{p.summary}</p>
          </div>

          <PrinterSelect
            id="pd-printer"
            label="Máy in"
            value={p.deviceName}
            onChange={p.onDeviceName}
            list={p.printers}
            quietWhenEmpty
          />

          <CopiesField id="pd-copies" copies={p.copies} onChange={p.onCopies} paper={p.paperName} perSheet={p.perSheet} />

          {noPrinter ? (
            <p className="print-note warn" role="status">
              Máy này chưa cài máy in nào nên chưa in được. Cài hoặc cắm máy in rồi bấm nút tìm lại ở trên.
              Cần in ở máy khác thì đóng hộp này và lưu PDF ở mục Lưu file.
            </p>
          ) : (
            <p className="print-note">
              {p.deviceName
                ? `Bấm In là in ngay ${p.copies} tờ ra “${printerLabel(p.printers, p.deviceName)}”, không hỏi lại.`
                : 'Bấm In sẽ mở hộp thoại in của hệ thống để chọn máy in.'}
            </p>
          )}

          <div className="print-actions">
            <button ref={printBtn} type="button" className="btn accent" onClick={p.onPrint} disabled={p.busy || noPrinter}>
              <Printer />
              {p.busy ? 'Đang gửi lệnh in…' : p.deviceName ? `In ${p.copies} tờ` : 'In…'}
            </button>
            <button type="button" className="btn" onClick={p.onClose} disabled={p.busy}>Đóng</button>
          </div>
          <p className="hint">Phóng to: nút + ở góc, Ctrl/⌘ + con lăn chuột, hoặc nhấp đúp lên trang.</p>
        </div>
      </div>
    </div>
  )
}
