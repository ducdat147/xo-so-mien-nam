import { Fragment } from 'react'
import type { CellStyle } from '../../../../core/settings'
import { AlignGrid, alignName } from '../../components/AlignGrid'
import { CompactInput } from '../../components/CompactInput'
import type { DraftProps } from '../../useSettingsDraft'

const CELL_ROWS = [
  { key: 'textCell', label: 'Chữ', sub: 'Giải, tên giải, tên đài' },
  { key: 'numberCell', label: 'Số kết quả', sub: 'Các số trúng thưởng' }
] as const

/** Padding và căn lề của chữ / số trong ô bảng kết quả. */
export function CellStylesField({ draft, setDraft }: DraftProps) {
  return (
    <div className="cell-styles" role="group" aria-labelledby="l-cells">
      <span id="l-cells" className="field-label">Chữ trong bảng</span>
      <div className="cell-styles-grid">
        <span className="cell-col-blank" />
        <span className="cell-col-head">Padding</span>
        <span className="cell-col-head">Align</span>
        {CELL_ROWS.map((r) => {
          const c = draft.print[r.key]
          const name = r.label.toLowerCase()
          const set = (patch: Partial<CellStyle>) => setDraft((d) => { Object.assign(d.print[r.key], patch) })
          return (
            <Fragment key={r.key}>
              <div className="cell-row-label">
                <span>{r.label}</span>
                <span className="hint">{r.sub}</span>
              </div>
              <div className="row">
                <CompactInput id={`${r.key}-px`} kind="pad-x" label={`padding ngang của ${name}`}
                  title={`Khoảng cách ngang từ mép ô tới ${name}, ở phía được căn`}
                  value={c.padXCm} min={0} max={1.5} step={0.05} onChange={(v) => set({ padXCm: v ?? 0 })} />
                <CompactInput id={`${r.key}-py`} kind="pad-y" label={`padding dọc của ${name}`}
                  title={`Khoảng cách dọc từ mép ô tới ${name}, ở phía được căn`}
                  value={c.padYCm} min={0} max={1} step={0.05} onChange={(v) => set({ padYCm: v ?? 0 })} />
              </div>
              <div className="cell-align">
                <AlignGrid label={`Căn ${name} trong ô`} x={c.alignX} y={c.alignY}
                  onChange={(x, y) => set({ alignX: x, alignY: y })} />
                <span className="hint">{alignName(c.alignX, c.alignY)}</span>
              </div>
            </Fragment>
          )
        })}
      </div>
      <span className="hint">
        Padding tính từ mép ô tới chữ, ở phía chữ được căn (căn giữa: cả hai bên). Hàng “Giải” và tên đài
        luôn nằm giữa ô theo chiều dọc.
      </span>
    </div>
  )
}
