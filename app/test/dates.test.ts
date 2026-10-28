import { describe, expect, it } from 'vitest'
import { addDays, defaultDrawDate, isBeforeDraw, formatDate, parseDate, sheetTitle, todayVN, toIsoDate, weekday } from '../src/core/dates'

describe('dates', () => {
  it('hôm nay tính theo giờ Việt Nam, không theo múi giờ máy', () => {
    // 17:30 UTC ngày 26 = 00:30 ngày 27 ở VN
    expect(todayVN(new Date('2026-10-26T17:30:00Z'))).toEqual({ y: 2026, m: 10, d: 27 })
    expect(todayVN(new Date('2026-10-26T16:59:59Z'))).toEqual({ y: 2026, m: 10, d: 26 })
  })

  it('trước 16h giờ VN mặc định lấy ngày hôm qua, từ 16h lấy hôm nay', () => {
    // 08:59 UTC = 15:59 VN ngày 27
    expect(defaultDrawDate(new Date('2026-10-27T08:59:00Z'))).toEqual({ y: 2026, m: 10, d: 26 })
    expect(defaultDrawDate(new Date('2026-10-27T09:00:00Z'))).toEqual({ y: 2026, m: 10, d: 27 })
    // 00:30 VN ngày 1-11 → 31-10
    expect(defaultDrawDate(new Date('2026-10-31T17:30:00Z'))).toEqual({ y: 2026, m: 10, d: 31 })
    expect(isBeforeDraw(new Date('2026-10-27T08:59:59Z'))).toBe(true)
    expect(isBeforeDraw(new Date('2026-10-27T09:00:00Z'))).toBe(false)
  })

  it('thứ trong tuần', () => {
    expect(weekday({ y: 2026, m: 10, d: 26 })).toBe(1)
    expect(weekday({ y: 2026, m: 10, d: 24 })).toBe(6)
    expect(weekday({ y: 2026, m: 10, d: 25 })).toBe(0)
  })

  it('đọc nhiều kiểu ngày, từ chối ngày sai', () => {
    expect(parseDate('26-10-2026')).toEqual({ y: 2026, m: 10, d: 26 })
    expect(parseDate('6/1/2026')).toEqual({ y: 2026, m: 1, d: 6 })
    expect(parseDate('2026-10-26')).toEqual({ y: 2026, m: 10, d: 26 })
    expect(parseDate('31-02-2026')).toBeNull()
    expect(parseDate('29-02-2028')).toEqual({ y: 2028, m: 2, d: 29 })
    expect(parseDate('abc')).toBeNull()
  })

  it('định dạng và cộng ngày qua tháng/năm', () => {
    expect(formatDate({ y: 2026, m: 1, d: 5 })).toBe('05-01-2026')
    expect(formatDate({ y: 2026, m: 1, d: 5 }, '/')).toBe('05/01/2026')
    expect(toIsoDate({ y: 2026, m: 1, d: 5 })).toBe('2026-01-05')
    expect(addDays({ y: 2026, m: 1, d: 1 }, -1)).toEqual({ y: 2025, m: 12, d: 31 })
    expect(sheetTitle({ y: 2026, m: 10, d: 26 })).toBe('Thứ Hai (26-10-2026)')
    expect(sheetTitle({ y: 2026, m: 10, d: 25 })).toBe('Chủ Nhật (25-10-2026)')
  })
})
