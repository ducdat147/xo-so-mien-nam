import { viNumber } from '../../../../core/layout'
import { DEFAULT_FONT } from '../../../../core/settings'
import { CompactInput } from '../../components/CompactInput'
import { useLocalFonts } from '../../hooks'
import type { DraftProps } from '../../useSettingsDraft'

/** Font chữ của phiếu (chỉ font đã cài trên máy) và cỡ số kết quả. */
export function FontField(props: DraftProps & {
  /** Cỡ số kết quả đang dùng thật trên phiếu xem trước (pt). */
  numberSizePt: number
}) {
  const { draft, setDraft, numberSizePt } = props
  const { font, numberFontPt } = draft.print
  const localFonts = useLocalFonts()
  // Chưa đọc được danh sách thì đưa vài font phổ biến để vẫn chọn được
  const fontMissing = !!localFonts?.length && !localFonts.includes(font)
  const fontChoices = localFonts?.length ? localFonts : [DEFAULT_FONT, 'Arial']
  const fontList = fontChoices.includes(font) ? fontChoices : [font, ...fontChoices]
  const numberPt = viNumber(numberSizePt)

  return (
    <div className="field">
      <span id="l-typo" className="field-label">Font chữ &amp; cỡ số</span>
      <div className="row" role="group" aria-labelledby="l-typo">
        <select
          id="f-font"
          className="input grow"
          aria-label="Font chữ trên phiếu"
          value={font}
          onChange={(e) => setDraft((d) => { d.print.font = e.target.value })}
        >
          {fontList.map((f) => (
            <option key={f} value={f}>{f === font && fontMissing ? `${f} (máy chưa cài)` : f}</option>
          ))}
        </select>
        <CompactInput id="f-nsize" kind="size" label="cỡ số kết quả" unit="pt"
          title="Cỡ số kết quả. Để trống hoặc gõ auto: lớn nhất vừa phiếu"
          value={numberFontPt} min={8} max={30} step={0.5} allowAuto autoValue={numberSizePt}
          onChange={(v) => setDraft((d) => { d.print.numberFontPt = v })} />
      </div>
      <span className={fontMissing ? 'hint warn' : 'hint'}>
        {fontMissing
          ? `Máy này chưa cài font “${font}”, phiếu sẽ in bằng font thay thế.`
          : 'Font lấy từ các font đã cài trên máy, dùng cho cả phiếu.'}{' '}
        {numberFontPt === null
          ? `Cỡ số Auto là lớn nhất vừa phiếu, hiện là ${numberPt} pt.`
          : numberSizePt < numberFontPt
            ? `Cỡ ${viNumber(numberFontPt)} pt to quá, đang dùng ${numberPt} pt cho vừa phiếu.`
            : `Cỡ số cố định ${numberPt} pt.`}{' '}
        Nhấp đúp chữ “Cỡ”, xoá số hoặc gõ “auto” để về Auto.
      </span>
    </div>
  )
}
