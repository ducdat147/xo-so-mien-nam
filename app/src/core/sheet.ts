// Ghép các bước: kết quả + cài đặt → danh sách đài → layout. Dùng chung cho xem trước (renderer)
// và xuất file / in (main) để hai bên luôn ra cùng một phiếu.

import type { DateVN } from './dates'
import { formatDate, sheetTitle, weekday } from './dates'
import { computeLayout, type SheetLayout } from './layout'
import type { DayResult } from './parse'
import { selectStations, type SheetStation } from './select'
import type { Paper, Settings } from './settings'

export interface SheetRequest {
  date: DateVN
  paper: Paper
  /** In phiếu trống (chưa có số). */
  blank: boolean
}

export interface Sheet {
  layout: SheetLayout
  stations: SheetStation[]
}

export function buildSheet(settings: Settings, day: DayResult | null, req: SheetRequest): Sheet {
  // Kết quả của ngày khác (người dùng vừa đổi ngày) thì coi như chưa có
  const sameDay = day && day.date === formatDate(req.date) ? day : null
  const stations = selectStations({
    day: sameDay,
    weekday: weekday(req.date),
    stations: settings.stations,
    blank: req.blank
  })
  const layout = computeLayout({
    header: settings.header,
    print: settings.print,
    paper: req.paper,
    title: sheetTitle(req.date),
    stations: stations.map((s) => ({ short: s.short, prizes: s.prizes })),
    blank: req.blank
  })
  return { layout, stations }
}

/** xsmn_26-10-2026_A4 (phiếu trống thêm _trong), chưa có đuôi. */
export function outputBaseName(req: SheetRequest): string {
  return `xsmn_${formatDate(req.date)}_${req.paper}${req.blank ? '_trong' : ''}`
}
