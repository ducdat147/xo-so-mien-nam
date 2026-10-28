import { useState, type DragEvent, type KeyboardEvent } from 'react'
import { WEEKDAY_NAMES } from '../../../core/dates'
import type { StationPick } from '../../../core/settings'
import { fullName } from '../../../core/stations'

/** Thứ Hai trước, Chủ Nhật cuối, như lịch quay đọc từ trên xuống. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const Grip = () => (
  <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true">
    {[3, 9, 15].flatMap((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />))}
  </svg>
)

type Pos = { day: number; idx: number }

/**
 * Bảng đài theo thứ: mỗi thứ một hàng thẻ, thứ tự từ trái sang phải = thứ tự cột trên phiếu.
 * Kéo thả (chỉ trong cùng một thứ) hoặc Tab tới tay nắm rồi bấm ← / →.
 */
export function StationPicker(props: {
  byWeekday: Record<string, StationPick[]>
  locked: boolean
  onChange: (day: number, list: StationPick[]) => void
}) {
  const { byWeekday, locked, onChange } = props
  const [drag, setDrag] = useState<Pos | null>(null)
  const [over, setOver] = useState<Pos | null>(null)

  const move = (day: number, from: number, to: number) => {
    const list = [...byWeekday[day]]
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    onChange(day, list)
  }
  const toggle = (day: number, idx: number) =>
    onChange(day, byWeekday[day].map((p, i) => (i === idx ? { ...p, on: !p.on } : p)))

  const endDrag = () => {
    setDrag(null)
    setOver(null)
  }

  return (
    <div className={`days${locked ? ' locked' : ''}`}>
      {DAY_ORDER.map((day) => {
        const list = byWeekday[day] ?? []
        const dayName = WEEKDAY_NAMES[day]
        return (
          <fieldset key={day} className="day-row" disabled={locked}>
            <legend>{dayName}</legend>
            <ol className="chips">
              {list.map((p, idx) => {
                const name = fullName(p.slug)
                const sameDay = drag?.day === day
                const isDragging = sameDay && drag?.idx === idx
                const isOver = sameDay && over?.day === day && over.idx === idx && drag?.idx !== idx
                const allow = (e: DragEvent) => {
                  if (!sameDay) return false
                  e.preventDefault()
                  return true
                }
                return (
                  <li
                    key={p.slug}
                    className={`chip${p.on ? '' : ' off'}${isDragging ? ' dragging' : ''}${isOver ? ' over' : ''}`}
                    draggable={!locked}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', p.slug)
                      setDrag({ day, idx })
                      setOver(null)
                    }}
                    onDragEnter={(e) => {
                      if (allow(e) && (over?.day !== day || over.idx !== idx)) setOver({ day, idx })
                    }}
                    onDragOver={(e) => {
                      if (allow(e)) e.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (drag && drag.day === day && drag.idx !== idx) move(day, drag.idx, idx)
                      endDrag()
                    }}
                    onDragEnd={endDrag}
                  >
                    <button
                      type="button"
                      className="grip"
                      aria-label={`Đổi thứ tự ${name} (${dayName}): kéo thả, hoặc bấm phím mũi tên trái/phải`}
                      title="Kéo để đổi thứ tự"
                      onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'ArrowLeft' && idx > 0) {
                          e.preventDefault()
                          move(day, idx, idx - 1)
                        } else if (e.key === 'ArrowRight' && idx < list.length - 1) {
                          e.preventDefault()
                          move(day, idx, idx + 1)
                        }
                      }}
                    >
                      <Grip />
                    </button>
                    <span className="chip-pos" aria-hidden="true">{idx + 1}</span>
                    <label className="chip-label">
                      <input type="checkbox" checked={p.on} onChange={() => toggle(day, idx)} />
                      <span>{name}</span>
                    </label>
                  </li>
                )
              })}
            </ol>
          </fieldset>
        )
      })}
    </div>
  )
}
