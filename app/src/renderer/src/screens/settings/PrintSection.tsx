import { maxCardSizeCm, viNumber } from '../../../../core/layout'
import { CompactInput } from '../../components/CompactInput'
import { Segmented } from '../../components/controls'
import { PagePositionPicker } from '../../components/PagePositionPicker'
import { FORMAT_OPTIONS, PAPER_OPTIONS } from '../../labels'
import type { DraftProps } from '../../useSettingsDraft'
import { CellStylesField } from './CellStylesField'
import { FontField } from './FontField'

/** Thẻ Bản in: khổ giấy, định dạng, kích thước và vị trí phiếu, font, chữ trong bảng. */
export function PrintSection(props: DraftProps & {
  /** Cỡ số kết quả đang dùng thật trên phiếu xem trước (pt). */
  numberSizePt: number
}) {
  const { draft, setDraft, numberSizePt } = props
  const p = draft.print
  const max = (paper: typeof p.paper) => maxCardSizeCm(paper, p.cardGapXCm, p.cardGapYCm)
  const cur = max(p.paper)

  return (
    <>
      <div className="grid-2 wide">
        <Segmented id="l-kho" label="Khổ giấy mặc định" options={PAPER_OPTIONS} value={p.paper}
          onChange={(v) => setDraft((d) => { d.print.paper = v })} variant="tall" />
        <Segmented id="l-dd" label="Định dạng mặc định" options={FORMAT_OPTIONS} value={p.format}
          onChange={(v) => setDraft((d) => { d.print.format = v })} variant="plain" />
        <div className="field">
          <span id="l-size" className="field-label">Kích thước phiếu</span>
          <div className="row wrap" role="group" aria-labelledby="l-size">
            <CompactInput id="f-cw" kind="width" label="bề rộng phiếu" title="Bề rộng mỗi phiếu. Để trống hoặc gõ auto: rộng nhất vừa khổ giấy"
              value={p.cardWidthCm} min={4} max={10} allowAuto autoValue={cur.w}
              onChange={(v) => setDraft((d) => { d.print.cardWidthCm = v })} />
            <CompactInput id="f-ch" kind="height" label="chiều cao phiếu" title="Chiều cao mỗi phiếu. Để trống hoặc gõ auto: cao hết chỗ trống"
              value={p.cardHeightCm} min={4} max={max('A4').h} allowAuto autoValue={cur.h}
              onChange={(v) => setDraft((d) => { d.print.cardHeightCm = v })} />
          </div>
          <span className="hint">
            Tối đa rộng {viNumber(max('A4').w)} cm (A4, A5), {viNumber(max('A6').w)} cm (A6); cao {viNumber(max('A4').h)} cm (A4),{' '}
            {viNumber(max('A5').h)} cm (A5, A6). Auto là lấy mức tối đa; nhấp đúp chữ “Rộng”/“Cao”, xoá số hoặc gõ “auto” để về Auto.
          </span>
        </div>
        <div className="field">
          <span id="l-gap" className="field-label">Khoảng cách giữa các phiếu</span>
          <div className="row" role="group" aria-labelledby="l-gap">
            <CompactInput id="f-gap-x" kind="gap-x" label="khoảng cách ngang giữa hai cột phiếu"
              title="Khoảng cách ngang giữa hai cột phiếu (A4, A5)" value={p.cardGapXCm}
              onChange={(v) => setDraft((d) => { d.print.cardGapXCm = v ?? 0 })} />
            <CompactInput id="f-gap-y" kind="gap-y" label="khoảng cách dọc giữa hai hàng phiếu"
              title="Khoảng cách dọc giữa hai hàng phiếu (A4)" value={p.cardGapYCm}
              onChange={(v) => setDraft((d) => { d.print.cardGapYCm = v ?? 0 })} />
          </div>
          <span className="hint">Ngang: giữa 2 cột (A4, A5). Dọc: giữa 2 hàng (A4). Kéo trên biểu tượng để chỉnh nhanh.</span>
        </div>
        <div className="field">
          <span id="l-calign" className="field-label">Vị trí cụm phiếu trên trang</span>
          <PagePositionPicker id="l-calign" paper={p.paper} value={p.cardAlign}
            onChange={(v) => setDraft((d) => { d.print.cardAlign = v })} />
          <span className="hint">
            {p.paper === 'A6'
              ? 'Khổ A6 chỉ có một phiếu: lệch trái / giữa / phải trong phần trống của trang.'
              : 'Phần giấy còn trống dồn sang phía đối diện; chọn Giữa để chia đều hai bên.'}
          </span>
        </div>
        <FontField draft={draft} setDraft={setDraft} numberSizePt={numberSizePt} />
      </div>
      <CellStylesField draft={draft} setDraft={setDraft} />
    </>
  )
}
