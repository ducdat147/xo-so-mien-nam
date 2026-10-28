import { useEffect, useState, type KeyboardEvent } from 'react'
import { viNumber } from '../../../core/layout'

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

/** Ô số có nút − / +. Gõ được dấu phẩy thập phân; mũi tên lên/xuống để tăng giảm. */
export function NumberStepper(props: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  label: string
  unit?: string
  disabled?: boolean
  id?: string
}) {
  const { value, onChange, min, max, step = 1, label, unit, disabled, id } = props
  const [text, setText] = useState(viNumber(value, 2))
  useEffect(() => setText(viNumber(value, 2)), [value])

  const clamp = (n: number) => {
    const r = Math.round(n / step) * step
    return Math.min(max, Math.max(min, Number(r.toFixed(4))))
  }
  const commit = () => {
    const n = Number(text.trim().replace(',', '.'))
    if (Number.isFinite(n) && text.trim()) {
      const v = clamp(n)
      onChange(v)
      setText(viNumber(v, 2))
    } else {
      setText(viNumber(value, 2))
    }
  }
  const bump = (dir: 1 | -1) => onChange(clamp(value + dir * step))
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    else if (e.key === 'ArrowUp') { e.preventDefault(); bump(1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1) }
  }

  return (
    <span className="stepper">
      <button type="button" aria-label={`Giảm ${label}`} disabled={disabled || value <= min} onClick={() => bump(-1)}>−</button>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
      />
      <button type="button" aria-label={`Tăng ${label}`} disabled={disabled || value >= max} onClick={() => bump(1)}>+</button>
      {unit && <span className="stepper-unit">{unit}</span>}
    </span>
  )
}
