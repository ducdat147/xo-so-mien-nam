import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDate, isLiveWindow, sameDate, todayVN, type DateVN } from '../../../../core/dates'
import type { LoadedResult } from '../../../../core/source'
import { api } from '../../api'

const AUTO_REFRESH_MS = 2 * 60 * 1000
/** Đang quay trực tiếp: 5 giây hỏi lại một lần (mỗi lần vài trăm byte; trang minhngoc hỏi mỗi 1,2 giây). */
const LIVE_REFRESH_MS = 5000
/** Trước giờ quay thì đợi tới 16:10 mới bắt đầu hỏi lại. */
const DRAW_START_MIN = 16 * 60 + 10
/** Hệ điều hành báo có mạng mà vẫn chưa ra được Internet: 15 giây thử một lần. */
const OFFLINE_RETRY_MS = 15000

/** Đang lấy từ bảng trực tiếp và còn trong khung 16h–17h: hỏi dồn. */
const liveNow = (r: LoadedResult) => !!r.live && isLiveWindow()

function nextRefreshDelay(r: LoadedResult): number {
  if (liveNow(r)) return LIVE_REFRESH_MS
  if (r.status !== 'none') return AUTO_REFRESH_MS
  const t = new Date(Date.now() + 7 * 3600 * 1000)
  const left = DRAW_START_MIN * 60 - (t.getUTCHours() * 3600 + t.getUTCMinutes() * 60 + t.getUTCSeconds())
  return left > 0 ? left * 1000 : AUTO_REFRESH_MS
}

/**
 * Kết quả của ngày đang xem. Tự lấy khi mở app và khi đổi ngày (dùng cache nếu đã đủ số), rồi tự
 * lấy lại: hôm nay chưa đủ số thì theo nhịp quay (khi bật `autoRefresh`), máy chủ lỗi thì 2 phút
 * một lần, mất mạng thì lấy ngay khi có mạng lại.
 */
export function useDayResult(
  date: DateVN,
  opts: {
    autoRefresh: boolean
    /** Đang xem trước khi in / đang in / đang lưu: không tự lấy lại, bản in đúng bản vừa xem. */
    paused: boolean
    online: boolean
    onResult: (r: LoadedResult) => void
  }
) {
  const { autoRefresh, paused, online, onResult } = opts
  const [result, setResult] = useState<LoadedResult | null>(null)
  const [loading, setLoading] = useState(false)
  const key = formatDate(date)
  const reqId = useRef(0)

  /** `quiet`: lần hỏi lại lúc đang quay trực tiếp, không bật trạng thái "Đang làm mới…" của nút. */
  const load = useCallback(async (d: DateVN, force: boolean, quiet = false) => {
    const id = ++reqId.current
    if (!quiet) setLoading(true)
    try {
      const r = await api.fetchResults(d, force)
      if (id !== reqId.current) return
      setResult(r)
      onResult(r)
    } catch (e) {
      if (id !== reqId.current) return
      setResult({
        date: formatDate(d), status: 'error', pageDate: null, stations: [], filled: 0, total: 0,
        message: (e as Error).message, fromCache: false, fetchedAt: new Date().toISOString()
      })
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [onResult])

  useEffect(() => { load(date, false) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Kết quả đúng ngày đang chọn; null = đang tải lần đầu. */
  const current = result && result.date === key ? result : null
  const isToday = sameDate(date, todayVN())
  const waiting = !!current && (current.status === 'partial' || current.status === 'none')

  useEffect(() => {
    if (!autoRefresh || !waiting || !isToday || !current || paused) return
    const t = setTimeout(() => load(date, true, liveNow(current)), nextRefreshDelay(current))
    return () => clearTimeout(t)
  }, [autoRefresh, waiting, isToday, current, date, load, paused])

  // Cửa sổ thu nhỏ lâu thì Chromium giãn hẹn giờ: mở lại lúc đang quay là lấy số mới ngay
  useEffect(() => {
    if (!autoRefresh || !current || !liveNow(current) || paused) return
    const onShow = () => { if (document.visibilityState === 'visible') load(date, true, true) }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [autoRefresh, current, date, load, paused])

  // Máy chủ minhngoc lỗi: 2 phút thử lại một lần, ngày nào cũng vậy
  const serverDown = current?.status === 'error' && current.errorKind === 'server'
  useEffect(() => {
    if (!serverDown || !online) return
    const t = setTimeout(() => load(date, true), AUTO_REFRESH_MS)
    return () => clearTimeout(t)
  }, [serverDown, online, current, date, load])

  // Mất mạng: có mạng lại thì lấy ngay; hệ điều hành báo có mạng mà vẫn chưa ra được Internet
  // (cắm mạng nội bộ, wifi chưa đăng nhập…) thì thử lại đều đặn
  const netDown = current?.status === 'error' && current.errorKind === 'offline'
  const wasOnline = useRef(online)
  useEffect(() => {
    if (online && !wasOnline.current && (!current || current.status === 'error')) load(date, false)
    wasOnline.current = online
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!netDown || !online) return
    const t = setTimeout(() => load(date, false), OFFLINE_RETRY_MS)
    return () => clearTimeout(t)
  }, [netDown, online, current, date, load])

  /** Ép tải lại (nút Làm mới, Thử lại). */
  const reload = useCallback(() => load(date, true), [load, date])

  return { current, loading, reload }
}
