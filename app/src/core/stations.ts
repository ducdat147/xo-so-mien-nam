// Danh sách đài, tên viết tắt, lịch quay, cơ cấu giải (SPEC §3, §4)

export type PrizeKey = '8' | '7' | '6' | '5' | '4' | '3' | '2' | '1' | 'db'

/** Thứ tự giải in trên phiếu, từ trên xuống. */
export const PRIZES: readonly PrizeKey[] = ['8', '7', '6', '5', '4', '3', '2', '1', 'db']

/** Số lượng số của mỗi giải. */
export const PRIZE_COUNT: Readonly<Record<PrizeKey, number>> = {
  '8': 1, '7': 1, '6': 3, '5': 1, '4': 7, '3': 2, '2': 1, '1': 1, db: 1
}

export const PRIZE_LABEL: Readonly<Record<PrizeKey, string>> = {
  '8': 'Tám', '7': 'Bảy', '6': 'Sáu', '5': 'Năm', '4': 'Tư', '3': 'Ba', '2': 'Nhì', '1': 'Nhất', db: 'ĐB'
}

/** 18 số mỗi đài. */
export const NUMBERS_PER_STATION = PRIZES.reduce((n, k) => n + PRIZE_COUNT[k], 0)

export type Prizes = Record<PrizeKey, string[]>

export function emptyPrizes(): Prizes {
  return { '8': [], '7': [], '6': [], '5': [], '4': [], '3': [], '2': [], '1': [], db: [] }
}

export interface StationDef {
  slug: string
  name: string
  short: string
}

export const STATIONS: readonly StationDef[] = [
  { slug: 'tp-hcm', name: 'TP. Hồ Chí Minh', short: 'TP.HCM' },
  { slug: 'dong-thap', name: 'Đồng Tháp', short: 'Đ.Tháp' },
  { slug: 'ca-mau', name: 'Cà Mau', short: 'C.Mau' },
  { slug: 'ben-tre', name: 'Bến Tre', short: 'B.Tre' },
  { slug: 'vung-tau', name: 'Vũng Tàu', short: 'V.Tàu' },
  { slug: 'bac-lieu', name: 'Bạc Liêu', short: 'B.Liêu' },
  { slug: 'dong-nai', name: 'Đồng Nai', short: 'Đ.Nai' },
  { slug: 'can-tho', name: 'Cần Thơ', short: 'C.Thơ' },
  { slug: 'soc-trang', name: 'Sóc Trăng', short: 'S.Trăng' },
  { slug: 'tay-ninh', name: 'Tây Ninh', short: 'T.Ninh' },
  { slug: 'an-giang', name: 'An Giang', short: 'A.Giang' },
  { slug: 'binh-thuan', name: 'Bình Thuận', short: 'B.Thuận' },
  { slug: 'vinh-long', name: 'Vĩnh Long', short: 'V.Long' },
  { slug: 'binh-duong', name: 'Bình Dương', short: 'B.Dương' },
  { slug: 'tra-vinh', name: 'Trà Vinh', short: 'T.Vinh' },
  { slug: 'long-an', name: 'Long An', short: 'L.An' },
  { slug: 'binh-phuoc', name: 'Bình Phước', short: 'B.Phước' },
  { slug: 'hau-giang', name: 'Hậu Giang', short: 'H.Giang' },
  { slug: 'tien-giang', name: 'Tiền Giang', short: 'T.Giang' },
  { slug: 'kien-giang', name: 'Kiên Giang', short: 'K.Giang' },
  { slug: 'da-lat', name: 'Đà Lạt', short: 'Đ.Lạt' }
]

/** Lịch quay cố định theo thứ (0 = CN … 6 = T7), đúng thứ tự trên web. */
export const SCHEDULE: Readonly<Record<number, readonly string[]>> = {
  0: ['tien-giang', 'kien-giang', 'da-lat'],
  1: ['tp-hcm', 'dong-thap', 'ca-mau'],
  2: ['ben-tre', 'vung-tau', 'bac-lieu'],
  3: ['dong-nai', 'can-tho', 'soc-trang'],
  4: ['tay-ninh', 'an-giang', 'binh-thuan'],
  5: ['vinh-long', 'binh-duong', 'tra-vinh'],
  6: ['tp-hcm', 'long-an', 'binh-phuoc', 'hau-giang']
}

const BY_SLUG = new Map(STATIONS.map((s) => [s.slug, s]))

export function findStation(slug: string): StationDef | undefined {
  return BY_SLUG.get(slug)
}

export function scheduleFor(weekday: number): readonly string[] {
  return SCHEDULE[weekday] ?? []
}

/** Các thứ (0 = CN) đài có quay. */
export function drawDays(slug: string): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => scheduleFor(d).includes(slug))
}

/** Tên in trên phiếu: cài đặt > mặc định > tên lấy từ web > mã đài. */
export function shortName(slug: string, overrides: Readonly<Record<string, string>> = {}, webName?: string): string {
  const custom = overrides[slug]?.trim()
  if (custom) return custom
  return findStation(slug)?.short ?? (webName?.trim() || slug)
}

/** "XSHCM - 10E2" → "XSHCM · 10E2" để hiện trên bảng kết quả. */
export function formatTicketCode(code: string): string {
  return code.replace(/\s+-\s+/, ' · ')
}

/** Tên đầy đủ: bảng đài > tên lấy từ web > mã đài. */
export function fullName(slug: string, webName?: string): string {
  return findStation(slug)?.name ?? (webName?.trim() || slug)
}
