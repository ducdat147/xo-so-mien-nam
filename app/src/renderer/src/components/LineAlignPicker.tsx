import { useRef, type KeyboardEvent } from 'react'
import type { Align } from '../../../core/settings'

const XS: readonly Align[] = ['left', 'center', 'right']
const NAME: Record<Align, string> = { left: 'Căn trái', center: 'Căn giữa', right: 'Căn phải' }
/** Ba vạch ngắn dài (kiểu Figma) cho từng cách căn. */
const PATH: Record<Align, string> = {
  left: 'M4 7h14M4 12h9M4 17h12',
  center: 'M5 7h14M7.5 12h9M6 17h12',
  right: 'M6 7h14M11 12h9M8 17h12'
}

/** Căn trái / giữa / phải một dòng chữ: ba ô cạnh nhau, cùng kiểu ô căn 3×3. Phím ← / → để đổi. */
export function LineAlignPicker(props: { label: string; value: Align; onChange: (a: Align) => void }) {
  const { label, value, onChange } = props
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (!d) return
    e.preventDefault()
    const n = Math.min(2, Math.max(0, i + d))
    onChange(XS[n])
    refs.current[n]?.focus()
  }

  return (
    <div className="line-align" role="radiogroup" aria-label={label}>
      {XS.map((x, i) => {
        const on = x === value
        return (
          <button
            key={x}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={NAME[x]}
            title={NAME[x]}
            tabIndex={on ? 0 : -1}
            className={on ? 'on' : undefined}
            onClick={() => onChange(x)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d={PATH[x]} />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
