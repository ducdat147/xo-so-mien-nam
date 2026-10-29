import { CompactInput } from '../../components/CompactInput'
import { PrinterSelect } from '../../components/PrinterSelect'
import { usePrinters } from '../../hooks'
import type { DraftProps } from '../../useSettingsDraft'

/** Thẻ Máy in: mặc định cho nhóm In phiếu ở màn Kết quả. */
export function PrinterSection({ draft, setDraft }: DraftProps) {
  const printers = usePrinters()
  const { deviceName, copies, silent } = draft.printer

  return (
    <>
      <PrinterSelect
        id="f-printer"
        label="Máy in mặc định"
        value={deviceName}
        onChange={(name) => setDraft((d) => {
          d.printer.deviceName = name
          if (!name) d.printer.silent = false
        })}
        list={printers}
      />
      <div className="grid-2 wide">
        <div className="field">
          <label htmlFor="f-copies" className="field-label">Số bản in mặc định</label>
          <CompactInput id="f-copies" kind="copies" label="số bản in mặc định" title="Số tờ in mỗi lần bấm In"
            unit="tờ" value={copies} min={1} max={99} step={1}
            onChange={(v) => setDraft((d) => { d.printer.copies = v ?? d.printer.copies })} />
          <span className="hint">Mỗi bản là một tờ giấy.</span>
        </div>
        <div className="field">
          <label className={`check${deviceName ? '' : ' disabled'}`}>
            <input
              type="checkbox"
              checked={silent && !!deviceName}
              disabled={!deviceName}
              onChange={(e) => setDraft((d) => { d.printer.silent = e.target.checked })}
            />
            <span>In nhanh, bỏ qua bước xem trước</span>
          </label>
          <span className="hint">
            {deviceName
              ? 'Bật thì nút In ở màn Kết quả in ngay ra máy in đã chọn, đúng khổ giấy và số bản, không mở bước xem trước.'
              : 'Chọn một máy in cụ thể để bật in nhanh.'}
          </span>
        </div>
      </div>
    </>
  )
}
