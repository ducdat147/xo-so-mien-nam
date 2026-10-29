import { todayVN } from '../../../../core/dates'
import { outputBaseName } from '../../../../core/sheet'
import { api } from '../../api'
import { FILE_EXT } from '../../labels'
import type { DraftProps } from '../../useSettingsDraft'

/** Thẻ Lưu file: thư mục lưu và ví dụ tên file. */
export function OutputSection({ draft, setDraft }: DraftProps) {
  const chooseDir = async () => {
    const dir = await api.chooseOutputDir(draft.output.dir)
    if (dir) setDraft((d) => { d.output.dir = dir })
  }

  const exampleName = outputBaseName({ date: todayVN(), paper: draft.print.paper, blank: false })

  return (
    <>
      <div className="field">
        <label htmlFor="f-dir" className="field-label">Thư mục lưu</label>
        <div className="row">
          <input id="f-dir" className="input grow" value={draft.output.dir} readOnly />
          <button type="button" className="btn" onClick={chooseDir}>Chọn…</button>
        </div>
      </div>
      <p className="set-desc">
        Tên file ví dụ: <strong>{exampleName}{FILE_EXT[draft.print.format]}</strong>. Lưu trùng tên thì ghi đè.
      </p>
    </>
  )
}
