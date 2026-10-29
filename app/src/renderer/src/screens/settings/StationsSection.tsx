import { STATIONS } from '../../../../core/stations'
import { StationPicker } from '../../components/StationPicker'
import type { DraftProps } from '../../useSettingsDraft'

/** Thẻ Đài cần in: tất cả đài hay chọn theo thứ, kèm tên viết tắt in trên phiếu. */
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
      <ShortNames draft={draft} setDraft={setDraft} />
    </>
  )
}

/** Tên viết tắt in trên phiếu; gõ lại đúng tên mặc định thì bỏ tên riêng. */
function ShortNames({ draft, setDraft }: DraftProps) {
  return (
    <details className="short-names">
      <summary>Tên viết tắt in trên phiếu ({STATIONS.length} đài)</summary>
      <div className="short-grid">
        {STATIONS.map((st) => (
          <label key={st.slug} className="short-item">
            <span>{st.name}</span>
            <input
              className="input small"
              value={draft.stations.shortNames[st.slug] ?? st.short}
              placeholder={st.short}
              onChange={(e) => setDraft((d) => {
                const v = e.target.value
                if (v.trim() === st.short) delete d.stations.shortNames[st.slug]
                else d.stations.shortNames[st.slug] = v
              })}
            />
          </label>
        ))}
      </div>
      <p className="hint">Để trống thì dùng tên viết tắt mặc định.</p>
    </details>
  )
}
