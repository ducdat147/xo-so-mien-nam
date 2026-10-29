import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultDrawDate, isBeforeDraw, sameDate, type DateVN } from '../../../../core/dates'

/**
 * Ngày đang xem: mở sẵn ngày quay gần nhất (trước 16h là hôm qua). Để app mở qua 16h thì tự
 * chuyển sang hôm nay, trừ khi người dùng đã tự chọn ngày.
 */
export function useDrawDate() {
  const [date, setDateState] = useState<DateVN>(() => defaultDrawDate())
  // Trước 16h hôm nay chưa quay: khoá nút "Hôm nay"
  const [beforeDraw, setBeforeDraw] = useState(() => isBeforeDraw())
  // Người dùng tự chọn ngày thì thôi tự đổi ngày lúc 16h
  const userPicked = useRef(false)

  const setDate = useCallback((d: DateVN) => {
    userPicked.current = true
    setDateState(d)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setBeforeDraw(isBeforeDraw())
      if (userPicked.current) return
      const d = defaultDrawDate()
      setDateState((cur) => (sameDate(cur, d) ? cur : d))
    }, 30000)
    return () => clearInterval(t)
  }, [])

  return { date, setDate, beforeDraw }
}
