import { CompactInput } from './CompactInput'

/** Ô "Số bản in" kèm dòng "2 tờ A4 = 8 phiếu" (cột trái màn Kết quả và bước xem trước khi in). */
export function CopiesField(props: {
  id: string
  copies: number
  onChange: (n: number) => void
  paper: string
  perSheet: number
}) {
  const { id, copies, onChange, paper, perSheet } = props
  return (
    <div className="copies">
      <div className="copies-text">
        <label htmlFor={id} className="field-label">Số bản in</label>
        <span className="hint">{copies} tờ {paper} = {copies * perSheet} phiếu</span>
      </div>
      <CompactInput id={id} kind="copies" label="số bản in" title="Số tờ in" unit="tờ"
        value={copies} min={1} max={99} step={1} onChange={(v) => v !== null && onChange(v)} />
    </div>
  )
}
