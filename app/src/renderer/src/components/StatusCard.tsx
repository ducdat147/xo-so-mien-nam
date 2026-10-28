import type { ReactNode } from 'react'
import { formatDate, weekdayName, type DateVN } from '../../../core/dates'
import type { LoadedResult } from '../../../core/source'
import { PRIZES, PRIZE_COUNT, PRIZE_LABEL } from '../../../core/stations'
import { Alert, CheckCircle, Clock, Live, ServerAlert, WifiOff } from './icons'

/** "16:42" theo giờ Việt Nam. */
export function vnClock(iso: string): string {
  const t = new Date(new Date(iso).getTime() + 7 * 3600 * 1000)
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
}

/** Số giải đã quay xong liên tiếp từ giải Tám (giải quay theo thứ tự từ Tám tới ĐB). */
function drawnPrizes(r: LoadedResult): number {
  let n = 0
  while (n < PRIZES.length && r.stations.every((st) => st.prizes[PRIZES[n]].length >= PRIZE_COUNT[PRIZES[n]])) n++
  return n
}

const prizeName = (i: number) => (PRIZES[i] === 'db' ? 'giải Đặc biệt' : `giải ${PRIZE_LABEL[PRIZES[i]]}`)

export function StatusCard(props: {
  date: DateVN
  /** Kết quả đúng ngày đang chọn; null = đang tải lần đầu. */
  result: LoadedResult | null
  autoRefresh: boolean
  onAutoRefresh: (on: boolean) => void
  /** Chỉ hiện tuỳ chọn tự lấy lại với ngày hôm nay. */
  canAutoRefresh: boolean
  onRetry: () => void
  retrying: boolean
  /** Hệ điều hành báo đang có mạng. */
  online: boolean
}) {
  const { date, result, autoRefresh, onAutoRefresh, canAutoRefresh, onRetry, retrying, online } = props
  const retryBtn = (label = 'Thử lại') => (
    <button type="button" className="btn" onClick={onRetry} disabled={retrying}>
      {retrying ? 'Đang thử lại…' : label}
    </button>
  )

  const auto = canAutoRefresh && (
    <label className="check small">
      <input type="checkbox" checked={autoRefresh} onChange={(e) => onAutoRefresh(e.target.checked)} />
      <span>Tự lấy lại mỗi 2 phút đến khi đủ</span>
    </label>
  )

  let kind: string
  let icon: ReactNode
  let title: string
  let desc: string
  let extra: ReactNode = null

  const waitingNet = (!online && (!result || result.status === 'error')) || result?.errorKind === 'offline'
  if (waitingNet) {
    kind = 'offline'
    icon = <WifiOff />
    title = 'Đang chờ kết nối mạng…'
    desc = 'Máy chưa vào được Internet. Có mạng lại là app tự lấy kết quả. Trong lúc chờ vẫn in được phiếu trống.'
    extra = (
      <>
        <div className="waiting" aria-hidden="true"><span /><span /><span /></div>
        {retryBtn('Thử lại ngay')}
      </>
    )
  } else if (!result) {
    kind = 'loading'
    icon = <Clock />
    title = 'Đang lấy kết quả…'
    desc = `${weekdayName(date)} ${formatDate(date)} · từ minhngoc.net.vn`
  } else if (result.status === 'ok') {
    kind = 'ok'
    icon = <CheckCircle />
    title = 'Đã có kết quả đầy đủ'
    desc =
      `${weekdayName(date)} ${formatDate(date)} · ${result.stations.length} đài · ${result.filled} số · ` +
      (result.fromCache ? 'đã lưu trên máy' : `cập nhật ${vnClock(result.fetchedAt)}`)
  } else if (result.status === 'partial') {
    const n = drawnPrizes(result)
    kind = 'live'
    icon = <Live />
    title = 'Đang quay trực tiếp'
    desc =
      `Đã có ${n}/${PRIZES.length} giải` +
      (n > 0 ? ` (từ ${prizeName(0)} đến ${prizeName(n - 1)})` : '') +
      `. Ô chưa quay sẽ để trống. Cập nhật ${vnClock(result.fetchedAt)}.`
    const pct = result.total ? Math.round((result.filled / result.total) * 100) : 0
    extra = (
      <>
        <div
          className="progress"
          role="progressbar"
          aria-label="Số con số đã quay"
          aria-valuemin={0}
          aria-valuemax={result.total}
          aria-valuenow={result.filled}
        >
          <div style={{ width: `${pct}%` }} />
        </div>
        {auto}
      </>
    )
  } else if (result.status === 'none') {
    kind = 'none'
    icon = <Clock />
    title = `Chưa có kết quả ngày ${formatDate(date)}`
    desc = 'Xổ số miền Nam quay lúc 16h15 – 16h35. Vẫn in được phiếu trống.'
    extra = auto
  } else if (result.errorKind === 'server') {
    kind = 'error'
    icon = <ServerAlert />
    title = 'Máy chủ minhngoc.net.vn đang gặp sự cố'
    desc = `${result.message ?? ''} App tự thử lại sau 2 phút. Trong lúc chờ vẫn in được phiếu trống.`
    extra = retryBtn()
  } else {
    kind = 'error'
    icon = <Alert />
    title = 'Không đọc được trang kết quả'
    desc = `${result.message ?? 'Lỗi không rõ.'} Thử lại sau ít phút; nếu vẫn lỗi, báo người làm app.`
    extra = retryBtn()
  }

  return (
    <section className={`status ${kind}`} aria-live="polite">
      <div className="status-head">
        {icon}
        <div className="status-text">
          <strong className="status-title">{title}</strong>
          <span className="status-desc">{desc}</span>
        </div>
      </div>
      {extra}
    </section>
  )
}
