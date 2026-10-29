import type { Paper } from '../../../../core/settings'
import { Segmented } from '../../components/controls'
import { CopiesField } from '../../components/CopiesField'
import { Printer } from '../../components/icons'
import { printerLabel, PrinterSelect } from '../../components/PrinterSelect'
import type { PrinterList } from '../../hooks'
import { PAPER_OPTIONS } from '../../labels'

/**
 * Nhóm In phiếu ở cột trái. Khổ giấy và "In phiếu trống" nằm đầu nhóm nhưng vẫn áp cho file lưu
 * (tên file có khổ và _trong).
 */
export function PrintCard(props: {
  paper: Paper
  onPaper: (p: Paper) => void
  blank: boolean
  onBlank: (on: boolean) => void
  printers: PrinterList
  deviceName: string | null
  onDeviceName: (name: string | null) => void
  copies: number
  onCopies: (n: number) => void
  perSheet: number
  /** In nhanh: bấm In là in thẳng ra máy đã chọn, không xem trước. */
  silent: boolean
  onSilent: (on: boolean) => void
  /** Đang in hoặc đang lưu: khoá nút In. */
  busy: boolean
  printing: boolean
  onPrint: () => void
}) {
  const p = props
  return (
    <section className="card tight" aria-labelledby="h-in-phieu">
      <h2 id="h-in-phieu" className="card-title"><Printer /> In phiếu</h2>
      <Segmented id="kho-label" label="Khổ giấy" options={PAPER_OPTIONS} value={p.paper} onChange={p.onPaper} variant="tall" />
      <label className="check">
        <input type="checkbox" checked={p.blank} onChange={(e) => p.onBlank(e.target.checked)} />
        <span>In phiếu trống (chưa có số)</span>
      </label>
      <PrinterSelect id="may-in" label="Máy in" value={p.deviceName} onChange={p.onDeviceName} list={p.printers} />
      <CopiesField id="so-ban" copies={p.copies} onChange={p.onCopies} paper={p.paper} perSheet={p.perSheet} />
      <label className={`check small${p.deviceName ? '' : ' disabled'}`}>
        <input
          type="checkbox"
          checked={p.silent}
          disabled={!p.deviceName}
          onChange={(e) => p.onSilent(e.target.checked)}
        />
        <span>In nhanh, bỏ qua bước xem trước</span>
      </label>
      {!p.deviceName && <span className="hint">Chọn một máy in cụ thể để bật in nhanh.</span>}
      <button type="button" className="btn accent" onClick={p.onPrint} disabled={p.busy}>
        <Printer />
        {p.printing ? 'Đang gửi lệnh in…' : p.silent ? `In ngay ${p.copies} tờ` : 'Xem trước và in…'}
      </button>
      {p.silent && <span className="hint">Bấm là in ngay ra “{printerLabel(p.printers, p.deviceName)}”, không xem trước.</span>}
    </section>
  )
}
