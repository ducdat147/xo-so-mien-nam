import type { PrinterItem } from '../../../shared/api'
import { Refresh } from './icons'

/** Ô chọn máy in + nút tìm lại. Giá trị rỗng = để hộp thoại in của hệ thống hỏi khi in. */
export function PrinterSelect(props: {
  id: string
  label: string
  value: string | null
  onChange: (name: string | null) => void
  printers: PrinterItem[] | null
  loading: boolean
  onRefresh: () => void
  /** Không hiện dòng "chưa thấy máy in" (khi chỗ dùng đã báo riêng). */
  quietWhenEmpty?: boolean
}) {
  const { id, label, value, onChange, printers, loading, onRefresh, quietWhenEmpty } = props
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
          onClick={onRefresh}
          disabled={loading}
        >
          <Refresh spinning={loading} />
        </button>
      </div>
      {hint && <span className={`hint${missing ? ' warn' : ''}`}>{hint}</span>}
    </div>
  )
}
