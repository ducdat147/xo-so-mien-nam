import { useRef, type KeyboardEvent } from 'react'
import type { Align, VAlign } from '../../../core/settings'

const XS: readonly Align[] = ['left', 'center', 'right']
const YS: readonly VAlign[] = ['top', 'center', 'bottom']
const X_NAME: Record<Align, string> = { left: 'trái', center: 'giữa', right: 'phải' }
const Y_NAME: Record<VAlign, string> = { top: 'Trên', center: 'Giữa', bottom: 'Dưới' }

export function alignName(x: Align, y: VAlign): string {
  return x === 'center' && y === 'center' ? 'Chính giữa' : `${Y_NAME[y]} ${X_NAME[x]}`
}

/** Ba vạch ngắn dài căn theo x: hình nhỏ cho ô đang chọn (kiểu Figma). */
const Bars = ({ x }: { x: Align }) => {
  const anchor = x === 'left' ? 4 : x === 'right' ? 20 : 12
  const line = (y: number, w: number) => {
    const x1 = x === 'left' ? anchor : x === 'right' ? anchor - w : anchor - w / 2
    return <path key={y} d={`M${x1} ${y}h${w}`} />
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      {[line(7, 14), line(12, 9), line(17, 12)]}
    </svg>
  )
}

/** Ô chọn 1 trong 9 vị trí căn (3 × 3). Phím mũi tên để di chuyển, giống nhóm radio. */
export function AlignGrid(props: {
  label: string
  x: Align
  y: VAlign
  onChange: (x: Align, y: VAlign) => void
}) {
  const { label, x, y, onChange } = props
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent, xi: number, yi: number) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!d) return
    e.preventDefault()
    const nx = Math.min(2, Math.max(0, xi + d[0]))
    const ny = Math.min(2, Math.max(0, yi + d[1]))
    onChange(XS[nx], YS[ny])
    refs.current[ny * 3 + nx]?.focus()
  }

  return (
    <div className="align-grid" role="radiogroup" aria-label={label}>
      {YS.map((yy, yi) =>
        XS.map((xx, xi) => {
          const on = xx === x && yy === y
          return (
            <button
              key={`${yy}-${xx}`}
              ref={(el) => { refs.current[yi * 3 + xi] = el }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={alignName(xx, yy)}
              title={alignName(xx, yy)}
              tabIndex={on ? 0 : -1}
              className={on ? 'on' : undefined}
              onClick={() => onChange(xx, yy)}
              onKeyDown={(e) => onKey(e, xi, yi)}
            >
              {on ? <Bars x={xx} /> : <span className="dot" />}
            </button>
          )
        })
      )}
    </div>
  )
}
