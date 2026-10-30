import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { normalizeColor } from '../../../core/settings'

/** Màu đậm hợp cho chữ, số, viền; màu nhạt hợp làm nền hàng (bản Figma "Bảng chọn màu"). */
const DARK = ['000000', '4B5563', 'C00000', 'E0441B', 'D97706', '1D4ED8', '15803D', '7E22CE']
const LIGHT = ['F3F4F6', 'E5E7EB', 'FEE2E2', 'FEF3C7', 'DBEAFE', 'DCFCE7', 'F3E8FF']
const POP_W = 244
const POP_H = 230

/**
 * Ô màu kiểu Figma, cùng cỡ ô số gọn: mẫu màu + mã hex (không có #, như file .conf). Bấm mở bảng chọn:
 * màu đậm, màu nhạt, ô mã, "Màu khác…" (bảng màu hệ thống). `emptyLabel`: cho phép bỏ trống (null),
 * ví dụ "Chung" = theo mức chung, "Không" = không tô nền; khi trống mẫu màu là `fallback` (mờ).
 */
export function ColorField(props: {
  label: string
  value: string | null
  onChange: (hex: string | null) => void
  emptyLabel?: string
  fallback?: string
}) {
  const { label, value, onChange, emptyLabel, fallback } = props
  const [open, setOpen] = useState(false)
  /** Bảng đặt cố định theo nút (cột Thuộc tính có thanh cuộn sẽ cắt mất nếu đặt trong cột), né mép cửa sổ. */
  const [at, setAt] = useState<CSSProperties>({})
  const btn = useRef<HTMLButtonElement>(null)
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!open && r) {
      const left = Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8))
      const below = r.bottom + 6 + POP_H < window.innerHeight
      setAt(below ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 })
    }
    setOpen(!open)
  }
  const [code, setCode] = useState(value ?? '')
  const box = useRef<HTMLDivElement>(null)
  const native = useRef<HTMLInputElement>(null)
  useEffect(() => setCode(value ?? ''), [value])

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (hex: string | null) => {
    onChange(hex)
    setOpen(false)
  }
  const commitCode = () => {
    const c = normalizeColor(code, '')
    if (c) onChange(c)
    else if (!code.trim() && emptyLabel) onChange(null)
    else setCode(value ?? '')
  }
  const shown = value ?? fallback
  const swatch = (hex: string) => (
    <button key={hex} type="button" className={`swatch${value === hex ? ' on' : ''}`} style={{ background: `#${hex}` }}
      title={hex} aria-label={`Màu ${hex}`} onClick={() => pick(hex)} />
  )

  return (
    <div className="color-field" ref={box}>
      <button ref={btn} type="button" className="color-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${value ?? emptyLabel}`}
        onClick={toggle}>
        <span className={`color-chip${value ? '' : ' empty'}`} style={shown ? { background: `#${shown}` } : undefined} />
        <span className={value ? '' : 'muted'}>{value ?? emptyLabel}</span>
      </button>
      {open && (
        <div className="color-pop" role="dialog" aria-label={label} style={at}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}>
          {emptyLabel && (
            <button type="button" className={`color-none${value === null ? ' on' : ''}`} onClick={() => pick(null)}>
              <span className="color-chip empty" style={fallback ? { background: `#${fallback}` } : undefined} />
              {emptyLabel}
            </button>
          )}
          <span className="hint">Màu đậm · chữ, số, viền</span>
          <div className="swatches">{DARK.map(swatch)}</div>
          <span className="hint">Màu nhạt · hợp làm nền hàng</span>
          <div className="swatches">{LIGHT.map(swatch)}</div>
          <div className="row">
            <input className="input small" value={code} aria-label="Mã màu (hex)" maxLength={7}
              onChange={(e) => setCode(e.target.value)} onBlur={commitCode}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCode() }} />
            <button type="button" className="link-btn" onClick={() => native.current?.click()}>Màu khác…</button>
            <input ref={native} type="color" className="sr-only" tabIndex={-1} aria-hidden="true"
              value={`#${shown ?? '000000'}`} onChange={(e) => onChange(normalizeColor(e.target.value, '000000'))} />
          </div>
        </div>
      )}
    </div>
  )
}
