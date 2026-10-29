export interface SegOption<T extends string> {
  value: T
  label: string
  sub?: string
}

/** Nhóm nút chọn một (aria-pressed), như Khổ giấy / Định dạng. */
export function Segmented<T extends string>(props: {
  id: string
  label: string
  options: readonly SegOption<T>[]
  value: T
  onChange: (v: T) => void
  variant?: 'tall' | 'plain'
}) {
  const { id, label, options, value, onChange, variant } = props
  return (
    <div className="field">
      <span id={id} className="field-label">{label}</span>
      <div role="group" aria-labelledby={id} className={`seg ${variant ?? ''}`}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            <span className="seg-main">{o.label}</span>
            {o.sub && <span className="seg-sub">{o.sub}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
