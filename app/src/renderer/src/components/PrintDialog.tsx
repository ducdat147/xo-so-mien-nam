import { useEffect, useRef } from 'react'
import type { PrinterItem } from '../../../shared/api'
import { NumberStepper } from './controls'
import { Download, Printer } from './icons'
import { PrinterSelect } from './PrinterSelect'
import { SheetPreview } from './SheetPreview'

/**
 * Bước xem trước khi in: trang in đúng như sẽ ra giấy (phóng to được), chọn máy in và số tờ,
 * rồi mới in. Chạy được cả khi máy chưa cài máy in (khi đó gợi ý lưu PDF).
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
  printers: PrinterItem[] | null
  findingPrinters: boolean
  onRefreshPrinters: () => void
  deviceName: string | null
  onDeviceName: (name: string | null) => void
  busy: boolean
  onPrint: () => void
  onSavePdf: () => void
  onClose: () => void
}) {
  const p = props
  const printBtn = useRef<HTMLButtonElement>(null)
  const noPrinter = !!p.printers && p.printers.length === 0
  const printerLabel = p.printers?.find((x) => x.name === p.deviceName)?.displayName ?? p.deviceName

  useEffect(() => {
    printBtn.current?.focus()
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
            printers={p.printers}
            loading={p.findingPrinters}
            onRefresh={p.onRefreshPrinters}
            quietWhenEmpty
          />

          <div className="copies">
            <div className="copies-text">
              <label htmlFor="pd-copies" className="field-label">Số bản in</label>
              <span className="hint">{p.copies} tờ {p.paperName} = {p.copies * p.perSheet} phiếu</span>
            </div>
            <NumberStepper id="pd-copies" label="số bản in" value={p.copies} onChange={p.onCopies} min={1} max={99} />
          </div>

          {noPrinter ? (
            <p className="print-note warn" role="status">
              Máy này chưa cài máy in nào nên chưa in được. Cài hoặc cắm máy in rồi bấm nút tìm lại ở trên.
              Trong lúc chờ có thể lưu PDF để in ở máy khác.
            </p>
          ) : (
            <p className="print-note">
              {p.deviceName
                ? `Bấm In là in ngay ${p.copies} tờ ra “${printerLabel}”, không hỏi lại.`
                : 'Bấm In sẽ mở hộp thoại in của hệ thống để chọn máy in.'}
            </p>
          )}

          <div className="print-actions">
            <button ref={printBtn} type="button" className="btn accent" onClick={p.onPrint} disabled={p.busy || noPrinter}>
              <Printer />
              {p.busy ? 'Đang gửi lệnh in…' : p.deviceName ? `In ${p.copies} tờ` : 'In…'}
            </button>
            <button type="button" className="btn" onClick={p.onSavePdf} disabled={p.busy}>
              <Download />
              Lưu PDF thay thế
            </button>
            <button type="button" className="btn ghost" onClick={p.onClose} disabled={p.busy}>Đóng</button>
          </div>
          <p className="hint">Phóng to: nút + ở góc, Ctrl/⌘ + con lăn chuột, hoặc nhấp đúp lên trang.</p>
        </div>
      </div>
    </div>
  )
}
