import { StationPicker } from '../../components/StationPicker'
import type { DraftProps } from '../../useSettingsDraft'

/** Thẻ Đài cần in: tất cả đài hay chọn theo thứ (tên viết tắt sửa ở tab Phiếu, Hàng tiêu đề). */
export function StationsSection({ draft, setDraft }: DraftProps) {
  return (
    <>
      <div role="radiogroup" aria-label="Cách chọn đài" className="radios">
        <label className="check">
          <input
            type="radio"
            name="che-do-dai"
            checked={draft.stations.mode === 'all'}
            onChange={() => setDraft((d) => { d.stations.mode = 'all' })}
          />
          <span>Tất cả đài quay trong ngày</span>
        </label>
        <label className="check">
          <input
            type="radio"
            name="che-do-dai"
            checked={draft.stations.mode === 'pick'}
            onChange={() => setDraft((d) => { d.stations.mode = 'pick' })}
          />
          <span>Chọn đài theo thứ</span>
        </label>
      </div>
      <StationPicker
        byWeekday={draft.stations.byWeekday}
        locked={draft.stations.mode === 'all'}
        onChange={(day, list) => setDraft((d) => { d.stations.byWeekday[day] = list })}
      />
      <p className="hint">Tên viết tắt in trên phiếu sửa ở tab Phiếu: chọn Hàng tiêu đề trong cây thành phần.</p>
    </>
  )
}

