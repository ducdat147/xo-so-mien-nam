import { TWIPS_PER_CM, viNumber, type SheetLayout } from '../../../../core/layout'
import { SheetPreview } from '../../components/SheetPreview'
import { SAMPLE_DAY } from '../../sample'

/** Cột phải màn Cài đặt: xem trước một phiếu theo bản nháp đang sửa. */
export function SettingsPreview(props: {
  layout: SheetLayout
  html: string
  /** Cỡ số đang để Auto. */
  autoNumberSize: boolean
  /** Ngày của kết quả tải gần nhất; null = đang dùng kết quả mẫu. */
  resultDate: string | null
}) {
  const { layout: l, html, autoNumberSize, resultDate } = props
  return (
    <aside className="settings-side" aria-labelledby="h-xt">
      <h2 id="h-xt">Xem trước phiếu</h2>
      <SheetPreview html={html} width={l.cardW / 15} height={l.cardH / 15} label="Xem trước một phiếu" pad={16} />
      <p className="hint">
        Cỡ số kết quả hiện tại: {viNumber(l.table.numberSize / 2)} pt{autoNumberSize ? ' (tự chỉnh để vừa phiếu)' : ''}.
        {' '}Khổ {l.paper}, phiếu {viNumber(l.cardW / TWIPS_PER_CM)} × {viNumber(l.cardH / TWIPS_PER_CM)} cm.
        {' '}{resultDate ? `Số trong phiếu là kết quả ngày ${resultDate}.` : `Số trong phiếu là kết quả mẫu ngày ${SAMPLE_DAY.date}.`}
      </p>
      {l.warnings.length > 0 && <ul className="warnings">{l.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
    </aside>
  )
}
