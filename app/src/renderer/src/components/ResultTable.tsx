import { useEffect, useRef, type CSSProperties } from 'react'
import { fontFamilyCss } from '../../../core/render-html'
import type { SheetStation } from '../../../core/select'
import { formatTicketCode, PRIZES, PRIZE_COUNT, PRIZE_LABEL } from '../../../core/stations'

const rowLabel = (k: (typeof PRIZES)[number]) => (k === 'db' ? 'Đặc biệt' : `Giải ${PRIZE_LABEL[k].toLowerCase()}`)

/** Số vừa ra được tô sáng trong khoảng này (khớp animation .kq-num.fresh). */
const FRESH_MS = 2500

/**
 * Bảng chữ lớn để đọc trên màn hình.
 * `font`: font phiếu trong Cài đặt; số trong bảng dùng đúng font-family của trang in.
 * `live`: đang quay trực tiếp, số vừa ra được tô sáng một lúc (số có sẵn lúc mở bảng thì không).
 */
export function ResultTable({ stations, font, live = false }: { stations: SheetStation[]; font: string; live?: boolean }) {
  const cols = { gridTemplateColumns: `120px repeat(${stations.length}, minmax(0, 1fr))` }
  /** Lúc thấy mỗi số lần đầu (0 = có sẵn). Giữ qua các lần vẽ lại để tô sáng không bị cắt ngang. */
  const seenAt = useRef(new Map<string, number>())
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true }, [])
  const now = Date.now()
  const fresh = (key: string) => {
    if (!seenAt.current.has(key)) seenAt.current.set(key, live && mounted.current ? now : 0)
    return now - seenAt.current.get(key)! < FRESH_MS
  }
  return (
    <div className="table-box">
      <div className="kq" role="table" aria-label="Bảng kết quả xổ số" style={{ '--kq-font': fontFamilyCss(font) } as CSSProperties}>
        <div className="kq-row head" role="row" style={cols}>
          <div className="kq-label" role="columnheader">Giải</div>
          {stations.map((st) => (
            <div key={st.slug} className="kq-st" role="columnheader">
              <span className="kq-st-name">{st.name}</span>
              {st.code && <span className="kq-st-code">{formatTicketCode(st.code)}</span>}
            </div>
          ))}
        </div>
        {PRIZES.map((k) => (
          <div key={k} className={`kq-row${k === 'db' ? ' db' : ''}`} role="row" style={cols}>
            <div className="kq-label" role="rowheader">{rowLabel(k)}</div>
            {stations.map((st) => {
              const nums = st.prizes[k]
              return (
                <div key={st.slug} className="kq-cell" role="cell">
                  {nums.map((n, i) => {
                    const key = `${st.slug}|${k}|${i}|${n}`
                    return <span key={key} className={fresh(key) ? 'kq-num fresh' : 'kq-num'}>{n}</span>
                  })}
                  {nums.length < PRIZE_COUNT[k] && <span className="kq-pending">Chờ quay…</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
