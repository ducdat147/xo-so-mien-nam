import { useRef, type KeyboardEvent } from 'react'
import { PAPER_SPECS } from '../../../core/layout'
import type { CardPosX, CardPosY, Paper } from '../../../core/settings'

type Pos = 'start' | 'center' | 'end' | 'between' | 'even'
const X: Record<Pos, CardPosX> = { start: 'left', center: 'center', end: 'right', between: 'between', even: 'even' }
const Y: Record<Pos, CardPosY> = { start: 'top', center: 'center', end: 'bottom', between: 'between', even: 'even' }
const LABEL: Record<'x' | 'y', Record<Pos, string>> = {
  x: { start: 'Trái', center: 'Giữa', end: 'Phải', between: 'Hai bên', even: 'Đều' },
  y: { start: 'Trên', center: 'Giữa', end: 'Dưới', between: 'Hai bên', even: 'Đều' }
}
const POS: readonly Pos[] = ['start', 'center', 'end', 'between', 'even']

/** Vị trí đầu các phiếu dọc theo một chiều (dài `len`, n phiếu cỡ `size`, khoảng tối thiểu `gap`). */
function spread(pos: Pos, len: number, n: number, size: number, gap: number): number[] {
  const free = len - n * size - (n - 1) * gap
  let start = 0
  let step = size + gap
  if (n > 1 && pos === 'between') step = size + gap + free / (n - 1)
  else if (n > 1 && pos === 'even') {
    const g = Math.max(gap, (len - n * size) / (n + 1))
    step = size + g
    start = (len - n * size - (n - 1) * g) / 2
  } else if (pos === 'end') start = free
  else if (pos !== 'start') start = free / 2
  return Array.from({ length: n }, (_, i) => start + i * step)
}

/** Hình trang giấy nhỏ: cụm phiếu vẽ nhỏ hơn thật theo chiều đang chọn cho dễ thấy phần trống. */
function PageThumb({ paper, axis, pos }: { paper: Paper; axis: 'x' | 'y'; pos: Pos }) {
  const spec = PAPER_SPECS[paper]
  const landscape = spec.orient === 'landscape'
  const w = landscape ? 40 : 28
  const h = landscape ? 28 : 40
  const m = 3
  const g = 1.5
  const uw = w - 2 * m
  const uh = h - 2 * m
  const shrink = (u: number, n: number) => (n > 1 ? (u * 0.62 - g) / n : u * 0.55)
  const cw = axis === 'x' ? shrink(uw, spec.ncol) : (uw - (spec.ncol - 1) * g) / spec.ncol
  const ch = axis === 'y' ? shrink(uh, spec.nrow) : (uh - (spec.nrow - 1) * g) / spec.nrow
  const xs = axis === 'x' ? spread(pos, uw, spec.ncol, cw, g) : spread('start', uw, spec.ncol, cw, g)
  const ys = axis === 'y' ? spread(pos, uh, spec.nrow, ch, g) : spread('start', uh, spec.nrow, ch, g)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx="2" className="pp-page" />
      {xs.flatMap((x) => ys.map((y) => <rect key={`${x}-${y}`} x={m + x} y={m + y} width={cw} height={ch} rx="0.8" className="pp-card" />))}
    </svg>
  )
}

/**
 * Dàn cụm phiếu theo một chiều bằng 5 hình trang giấy: sát đầu, giữa, sát cuối, Hai bên (phần trống dồn
 * vào giữa các phiếu), Đều (chia đều cho lề và giữa các phiếu). Phím mũi tên để đổi.
 */
export function CardPosPicker<T extends CardPosX | CardPosY>(props: {
  label: string
  axis: 'x' | 'y'
  paper: Paper
  value: T
  onChange: (v: T) => void
}) {
  const { label, axis, paper, value, onChange } = props
  const map = (axis === 'x' ? X : Y) as Record<Pos, T>
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0
    if (!d) return
    e.preventDefault()
    const n = Math.min(POS.length - 1, Math.max(0, i + d))
    onChange(map[POS[n]])
    refs.current[n]?.focus()
  }
  return (
    <div className="page-pos" role="radiogroup" aria-label={label}>
      {POS.map((p, i) => {
        const on = map[p] === value
        return (
          <button key={p} ref={(el) => { refs.current[i] = el }} type="button" role="radio" aria-checked={on}
            tabIndex={on ? 0 : -1} className={on ? 'on' : undefined}
            onClick={() => onChange(map[p])} onKeyDown={(e) => onKey(e, i)}>
            <PageThumb paper={paper} axis={axis} pos={p} />
            <span>{LABEL[axis][p]}</span>
          </button>
        )
      })}
    </div>
  )
}
