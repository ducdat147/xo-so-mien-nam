import { useRef, type KeyboardEvent } from 'react'
import { PAPER_SPECS } from '../../../core/layout'
import type { Align, Paper } from '../../../core/settings'

const OPTIONS: readonly { value: Align; label: string }[] = [
  { value: 'left', label: 'Trái' },
  { value: 'center', label: 'Giữa' },
  { value: 'right', label: 'Phải' }
]

/** Hình trang giấy nhỏ: cụm phiếu (vẽ hẹp hơn thật cho dễ thấy phần trống) lệch theo `align`. */
function PageThumb({ paper, align }: { paper: Paper; align: Align }) {
  const spec = PAPER_SPECS[paper]
  const landscape = spec.orient === 'landscape'
  const w = landscape ? 60 : 42
  const h = landscape ? 42 : 60
  const m = 4
  const gap = 2
  const usableW = w - 2 * m
  const usableH = h - 2 * m
  // Cụm phiếu chiếm ~70% bề ngang để phần trống hiện rõ
  const blockW = usableW * (spec.ncol === 1 ? 0.6 : 0.72)
  const cardW = (blockW - (spec.ncol - 1) * gap) / spec.ncol
  const cardH = (usableH - (spec.nrow - 1) * gap) / spec.nrow
  const left = align === 'left' ? m : align === 'right' ? w - m - blockW : (w - blockW) / 2
  const cards = []
  for (let c = 0; c < spec.ncol; c++) {
    for (let r = 0; r < spec.nrow; r++) {
      const x = left + c * (cardW + gap)
      const y = m + r * (cardH + gap)
      cards.push(
        <g key={`${c}-${r}`}>
          <rect x={x} y={y} width={cardW} height={cardH} rx="1" className="pp-card" />
          {/* vài vạch tượng trưng bảng kết quả */}
          <path d={`M${x + 1.5} ${y + 3}h${cardW - 3}M${x + 1.5} ${y + 6}h${cardW - 3}M${x + 1.5} ${y + 9}h${cardW - 3}`} className="pp-line" />
        </g>
      )
    }
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx="2" className="pp-page" />
      {cards}
    </svg>
  )
}

/** Chọn vị trí cụm phiếu trên trang bằng hình (thay cho ô chọn chữ). */
export function PagePositionPicker(props: { id: string; paper: Paper; value: Align; onChange: (a: Align) => void }) {
  const { id, paper, value, onChange } = props
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0
    if (!d) return
    e.preventDefault()
    const n = Math.min(OPTIONS.length - 1, Math.max(0, i + d))
    onChange(OPTIONS[n].value)
    refs.current[n]?.focus()
  }
  return (
    <div className="page-pos" role="radiogroup" aria-labelledby={id}>
      {OPTIONS.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={on ? 'on' : undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <PageThumb paper={paper} align={o.value} />
            <span>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
