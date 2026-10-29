// Font in lấy từ máy (không nhúng sẵn): danh sách font đã cài, và bề rộng chữ của font đang chọn
// so với Times New Roman để layout biết đường hạ cỡ số khi font rộng hơn.

import type { FontScale } from '../../core/layout'
import { fontFamilyCss } from '../../core/render-html'

/** Times New Roman đậm: chữ số rộng 0,5 em; câu mẫu trung bình 0,434 em mỗi ký tự. */
const TIMES = { digits: 0.5, text: 0.434 }
const SAMPLE = 'Đại lý vé số Minh Phát - 123 Lê Lợi, P.1, TP. Tân An - ĐT 0909 123 456 - Thứ Hai (26-10-2026)'
const SIZE = 1000

const scaleCache = new Map<string, FontScale>()

/** Đo bằng canvas với đúng font-family của trang in (máy thiếu font thì đo font dự phòng). */
export function measureFontScale(font: string): FontScale | undefined {
  const hit = scaleCache.get(font)
  if (hit) return hit
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return undefined
  ctx.font = `700 ${SIZE}px ${fontFamilyCss(font)}`
  const digits = ctx.measureText('0123456789').width / 10 / SIZE
  const text = ctx.measureText(SAMPLE).width / [...SAMPLE].length / SIZE
  if (!(digits > 0 && text > 0)) return undefined
  const scale = { digits: digits / TIMES.digits, text: text / TIMES.text }
  scaleCache.set(font, scale)
  return scale
}

type LocalFont = { family: string }
let fontList: Promise<string[]> | null = null

/** queryLocalFonts báo lỗi khi cửa sổ đang ẩn hoặc thu nhỏ: chờ hiện ra rồi mới hỏi. */
function whenVisible(): Promise<void> {
  if (document.visibilityState === 'visible') return Promise.resolve()
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', onChange)
      resolve()
    }
    document.addEventListener('visibilitychange', onChange)
  })
}

/** Tên các họ font đã cài, xếp theo ABC. Rỗng nếu không đọc được (API thiếu hoặc bị chặn). */
export function listLocalFonts(): Promise<string[]> {
  const query = (window as unknown as { queryLocalFonts?: () => Promise<LocalFont[]> }).queryLocalFonts
  if (!query) return Promise.resolve([])
  if (!fontList) {
    fontList = whenVisible()
      .then(() => query.call(window))
      .then(
        (fonts) =>
          [...new Set(fonts.map((f) => f.family))]
            .filter((f) => f && !f.startsWith('.')) // font ẩn của macOS (.SF NS…)
            .sort((a, b) => a.localeCompare(b, 'vi')),
        () => {
          fontList = null // lần mở Cài đặt sau thử lại
          return []
        }
      )
  }
  return fontList
}
