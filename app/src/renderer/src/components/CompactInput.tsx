import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { viNumber } from '../../../core/layout'

const GapX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="2.5" y="4" width="5" height="16" rx="1.5" />
    <rect x="16.5" y="4" width="5" height="16" rx="1.5" />
    <path d="M12 8v8" />
  </svg>
)

const GapY = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="2.5" width="16" height="5" rx="1.5" />
    <rect x="4" y="16.5" width="16" height="5" rx="1.5" />
    <path d="M8 12h8" />
  </svg>
)

const PadX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M3 4v16M21 4v16" />
    <rect x="8" y="8" width="8" height="8" rx="1.5" />
  </svg>
)

const PadY = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 3h16M4 21h16" />
    <rect x="8" y="8" width="8" height="8" rx="1.5" />
  </svg>
)

/** Hai tờ giấy chồng nhau: số bản (tờ) in. */
const Copies = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 7V4.5A1.5 1.5 0 0 1 9.5 3h9A1.5 1.5 0 0 1 20 4.5v11a1.5 1.5 0 0 1-1.5 1.5H16" />
    <rect x="4" y="7" width="12" height="14" rx="1.5" />
  </svg>
)

/** Phần đầu ô: biểu tượng (khoảng cách, padding, số bản) hoặc chữ ngắn "Rộng" / "Cao" / "Cỡ". */
const PREFIX = {
  'gap-x': { node: <GapX />, axis: 'x' },
  'gap-y': { node: <GapY />, axis: 'y' },
  'pad-x': { node: <PadX />, axis: 'x' },
  'pad-y': { node: <PadY />, axis: 'y' },
  width: { node: 'Rộng', axis: 'x' },
  height: { node: 'Cao', axis: 'y' },
  size: { node: 'Cỡ', axis: 'x' },
  copies: { node: <Copies />, axis: 'x' }
} as const

/** Chữ hiện ở chỗ con số khi đang tự động. */
const AUTO_TEXT = 'Auto'
const isAutoText = (t: string) => ['', 'auto', 'a', 'tự động', 'tu dong'].includes(t.trim().toLowerCase())

/**
 * Ô nhập số gọn kiểu Figma, cao 36px (chuẩn chung của các ô nhập): biểu tượng (hoặc chữ ngắn) + số + đơn vị.
 * Dùng cho mọi ô số trong app, thay cho ô có nút − / +.
 * Gõ số (chấp nhận dấu phẩy), ↑/↓ để tăng giảm (Shift: ×10), kéo chuột trên phần đầu ô để chỉnh nhanh.
 * `allowAuto`: giá trị null hiện chữ "Auto" thay cho số; để trống hoặc gõ "auto" là về tự động;
 * đang Auto mà bấm ↑/↓ hay kéo chuột thì bắt đầu từ `autoValue` (kích thước đang dùng thật).
 */
export function CompactInput(props: {
  id: string
  kind: keyof typeof PREFIX
  /** Nhãn đọc cho trình đọc màn hình, ví dụ "khoảng cách ngang giữa các phiếu". */
  label: string
  title: string
  value: number | null
  onChange: (v: number | null) => void
  allowAuto?: boolean
  /** Giá trị đang dùng thật khi Auto (để ↑/↓ / kéo chuột bắt đầu từ đó). */
  autoValue?: number
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
}) {
  const { id, kind, label, title, value, onChange, min = 0, max = 3, step = 0.1, unit = 'cm', disabled, allowAuto, autoValue } = props
  const { node, axis } = PREFIX[kind]
  const isAuto = value === null
  const shown = (v: number | null) => (v === null ? AUTO_TEXT : viNumber(v, 2))
  /** Số làm mốc khi tăng giảm: giá trị đang đặt, hoặc kích thước thật khi đang Auto. */
  const base = value ?? autoValue ?? min
  const [text, setText] = useState(shown(value))
  useEffect(() => setText(shown(value)), [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = (n: number) => Math.min(max, Math.max(min, Number((Math.round(n / step) * step).toFixed(4))))
  const commit = () => {
    if (allowAuto && isAutoText(text)) {
      if (!isAuto) onChange(null)
      setText(AUTO_TEXT)
      return
    }
    const n = Number(text.trim().replace(',', '.'))
    if (text.trim() && Number.isFinite(n)) onChange(clamp(n))
    setText(shown(value))
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(clamp(base + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)))
    }
  }

  // Kéo trên biểu tượng: mỗi 4px = một bước
  const onScrub = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0 || disabled) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const start = { x: e.clientX, y: e.clientY, v: base }
    let lastSteps = 0
    const move = (ev: globalThis.PointerEvent) => {
      const d = axis === 'x' ? ev.clientX - start.x : start.y - ev.clientY
      const steps = Math.round(d / 4)
      // Chưa kéo đủ một bước thì không đổi gì (nhấp/nhấp đúp hơi rung tay không làm mất Auto)
      if (steps === lastSteps) return
      lastSteps = steps
      onChange(clamp(start.v + steps * step))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <label className={`spacing${disabled ? ' disabled' : ''}${isAuto ? ' auto' : ''}`} htmlFor={id} title={title}>
      <span
        className={`spacing-icon ${axis}${typeof node === 'string' ? ' text' : ''}`}
        onPointerDown={onScrub}
        onDoubleClick={allowAuto && !disabled ? () => onChange(null) : undefined}
        title={allowAuto ? 'Kéo để chỉnh nhanh, nhấp đúp để về Auto' : 'Kéo để chỉnh nhanh'}
        aria-hidden="true"
      >
        {node}
      </span>
      <input
        id={id}
        disabled={disabled}
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={onKey}
      />
      {!isAuto && <span className="spacing-unit">{unit}</span>}
    </label>
  )
}
