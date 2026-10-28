// Chọn & sắp xếp đài in trên phiếu theo cài đặt (SPEC §5).

import type { DayResult } from './parse'
import type { StationSettings } from './settings'
import { emptyPrizes, fullName, scheduleFor, shortName, type Prizes } from './stations'

export interface SheetStation {
  slug: string
  /** Tên đầy đủ (bảng kết quả trên màn hình). */
  name: string
  /** Tên in trên phiếu. */
  short: string
  /** Mã vé, rỗng nếu chưa có kết quả. */
  code: string
  prizes: Prizes
}

export interface SelectInput {
  day: DayResult | null
  weekday: number
  stations: StationSettings
  /** Phiếu trống: giữ danh sách đài, bỏ hết số. */
  blank?: boolean
}

/** Các đài quay trong ngày: theo web nếu đã có, không thì theo lịch cố định. */
function baseStations(day: DayResult | null, weekday: number, overrides: Record<string, string>): SheetStation[] {
  if (day && (day.status === 'ok' || day.status === 'partial') && day.stations.length) {
    return day.stations.map((st) => ({
      slug: st.slug,
      name: fullName(st.slug, st.name),
      short: shortName(st.slug, overrides, st.name),
      code: st.code,
      prizes: st.prizes
    }))
  }
  return scheduleFor(weekday).map((slug) => ({
    slug,
    name: fullName(slug),
    short: shortName(slug, overrides),
    code: '',
    prizes: emptyPrizes()
  }))
}

export function selectStations({ day, weekday, stations, blank = false }: SelectInput): SheetStation[] {
  let list = baseStations(day, weekday, stations.shortNames)
  if (blank) list = list.map((st) => ({ ...st, prizes: emptyPrizes() }))
  if (stations.mode === 'all') return list

  const bySlug = new Map(list.map((st) => [st.slug, st]))
  const picks = stations.byWeekday[weekday] ?? []
  const listed = new Set(picks.map((p) => p.slug))
  const chosen: SheetStation[] = []
  for (const p of picks) {
    const st = bySlug.get(p.slug)
    if (p.on && st) chosen.push(st)
  }
  // Đài có quay hôm đó mà chưa có trong danh sách (đài mới, đổi lịch…) → thêm vào cuối, coi như bật
  for (const st of list) if (!listed.has(st.slug)) chosen.push(st)
  // Tắt hết → in đủ các đài, giống bản bash
  return chosen.length ? chosen : list
}
