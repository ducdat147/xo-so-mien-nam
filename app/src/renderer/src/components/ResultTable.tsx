import type { SheetStation } from '../../../core/select'
import { formatTicketCode, PRIZES, PRIZE_COUNT, PRIZE_LABEL } from '../../../core/stations'

const rowLabel = (k: (typeof PRIZES)[number]) => (k === 'db' ? 'Đặc biệt' : `Giải ${PRIZE_LABEL[k].toLowerCase()}`)

/** Bảng chữ lớn để đọc trên màn hình. */
export function ResultTable({ stations }: { stations: SheetStation[] }) {
  const cols = { gridTemplateColumns: `120px repeat(${stations.length}, minmax(0, 1fr))` }
  return (
    <div className="table-box">
      <div className="kq" role="table" aria-label="Bảng kết quả xổ số">
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
                  {nums.map((n, i) => <span key={i} className="kq-num">{n}</span>)}
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
