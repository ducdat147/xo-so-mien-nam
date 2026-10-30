import type { ReactElement } from 'react'
import { IconBold, IconItalic, IconUnderline } from './icons'

export interface TextStyleValue {
  bold: boolean
  italic?: boolean
  underline?: boolean
}

const BUTTONS: readonly { key: keyof TextStyleValue; name: string; Icon: () => ReactElement }[] = [
  { key: 'bold', name: 'Đậm', Icon: IconBold },
  { key: 'italic', name: 'Nghiêng', Icon: IconItalic },
  { key: 'underline', name: 'Gạch chân', Icon: IconUnderline }
]

/**
 * Đậm / Nghiêng / Gạch chân: ba nút bật tắt độc lập, cùng khung với Căn lề dòng. Thiếu `italic` /
 * `underline` thì không có nút đó (dòng chữ đầu phiếu không gạch chân, tên giải chỉ có Đậm).
 */
export function TextStyleToggles(props: { label: string; value: TextStyleValue; onChange: (v: Partial<TextStyleValue>) => void }) {
  const { label, value, onChange } = props
  return (
    <div className="line-align" role="group" aria-label={label}>
      {BUTTONS.filter((b) => value[b.key] !== undefined).map(({ key, name, Icon }) => {
        const on = !!value[key]
        return (
          <button key={key} type="button" className={on ? 'on' : ''} aria-pressed={on} title={name} aria-label={name}
            onClick={() => onChange({ [key]: !on })}>
            <Icon />
          </button>
        )
      })}
    </div>
  )
}
