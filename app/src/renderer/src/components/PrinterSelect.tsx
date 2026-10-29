import type { PrinterList } from '../hooks'
import { Refresh } from './icons'

/** Ô chọn máy in + nút tìm lại. Giá trị rỗng = để hộp thoại in của hệ thống hỏi khi in. */
export function PrinterSelect(props: {
  id: string
  label: string
  value: string | null
  onChange: (name: string | null) => void
  list: PrinterList
  /** Không hiện dòng "chưa thấy máy in" (khi chỗ dùng đã báo riêng). */
  quietWhenEmpty?: boolean
}) {
  const { id, label, value, onChange, list, quietWhenEmpty } = props
  const { printers, loading, refresh } = list
  const missing = !!value && !!printers && !printers.some((p) => p.name === value)

  let hint: string | null = null
  if (printers && printers.length === 0 && !quietWhenEmpty) hint = 'Chưa thấy máy in nào. Bật hoặc cắm máy in rồi bấm nút tìm lại bên cạnh.'
  else if (missing) hint = 'Không thấy máy in này. Kiểm tra máy in đã bật và cắm cáp chưa, hoặc chọn máy in khác.'

  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="row">
        <select
          id={id}
          className="input grow"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">Hộp thoại in của hệ thống (chọn máy in khi in)</option>
          {printers?.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
              {p.isDefault ? ' (mặc định)' : ''}
            </option>
          ))}
          {missing && <option value={value!}>{value} (không thấy)</option>}
        </select>
        <button
          type="button"
          className="btn square"
          aria-label="Tìm lại máy in"
          title="Tìm lại máy in"
          onClick={refresh}
          disabled={loading}
        >
          <Refresh spinning={loading} />
        </button>
      </div>
      {hint && <span className={`hint${missing ? ' warn' : ''}`}>{hint}</span>}
    </div>
  )
}

/** Tên máy in để hiện cho người dùng (chưa thấy trong danh sách thì dùng tên kỹ thuật). */
export const printerLabel = (list: PrinterList, name: string | null) =>
  list.printers?.find((p) => p.name === name)?.displayName ?? name ?? ''
