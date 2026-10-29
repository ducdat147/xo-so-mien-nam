import {
  addDays, compareDate, parseDate, sameDate, todayVN, toIsoDate, weekday, weekdayName, type DateVN
} from '../../../../core/dates'
import { fullName, scheduleFor } from '../../../../core/stations'
import { Refresh } from '../../components/icons'

const dayLineName = (slug: string) => (slug === 'tp-hcm' ? 'TP.HCM' : fullName(slug))

/** Thẻ đầu cột trái: chọn ngày xổ, chọn nhanh Hôm nay / Hôm qua, ép tải lại kết quả. */
export function DateCard(props: {
  date: DateVN
  onDate: (d: DateVN) => void
  /** Trước 16h hôm nay: khoá nút "Hôm nay". */
  beforeDraw: boolean
  loading: boolean
  onReload: () => void
}) {
  const { date, onDate, beforeDraw, loading, onReload } = props
  const today = todayVN()
  const yesterday = addDays(today, -1)

  return (
    <section className="card">
      <div className="field">
        <label htmlFor="ngay" className="field-label">Ngày xổ</label>
        <input
          id="ngay"
          type="date"
          className="input"
          value={toIsoDate(date)}
          // Chỉ chọn tới hôm nay (giờ VN); gõ tay ngày sau đó thì đưa về hôm nay
          max={toIsoDate(today)}
          onChange={(e) => {
            const d = parseDate(e.target.value)
            if (!d) return
            const now = todayVN()
            onDate(compareDate(d, now) > 0 ? now : d)
          }}
        />
        {/* Nút của ngày đang xem tô đậm như Khổ giấy; chọn ngày khác trong lịch thì cả hai bỏ chọn */}
        <div className="row" role="group" aria-label="Chọn nhanh ngày">
          <button
            type="button"
            className="btn grow quick"
            aria-pressed={sameDate(date, today)}
            onClick={() => onDate(todayVN())}
            disabled={beforeDraw}
            title={beforeDraw ? 'Kết quả hôm nay có từ 16h' : undefined}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className="btn grow quick"
            aria-pressed={sameDate(date, yesterday)}
            onClick={() => onDate(addDays(todayVN(), -1))}
          >
            Hôm qua
          </button>
        </div>
        <p className="hint">{weekdayName(date)} · {scheduleFor(weekday(date)).map(dayLineName).join(', ')}</p>
        {beforeDraw && <p className="hint">Chưa tới 16h nên chưa có kết quả hôm nay.</p>}
      </div>

      {/* App tự lấy khi mở và khi đổi ngày, nút này chỉ để ép tải lại: để chìm (chủ dự án chỉnh 29-10-2026) */}
      <button type="button" className="btn subtle" onClick={onReload} disabled={loading}>
        <Refresh spinning={loading} />
        {loading ? 'Đang làm mới…' : 'Làm mới kết quả'}
      </button>
    </section>
  )
}
