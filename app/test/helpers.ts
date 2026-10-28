import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultSettings, type Settings } from '../src/core/settings'

export const FIXTURES = join(__dirname, 'fixtures')
export const GOLDEN = join(__dirname, 'golden')

export const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8')
export const HTML_26 = fixture('fixture-26-10-2026.html')
export const HTML_24 = fixture('fixture-4dai-24-10-2026.html')

export const D26 = { y: 2026, m: 10, d: 26 } // Thứ Hai, 3 đài
export const D24 = { y: 2026, m: 10, d: 24 } // Thứ Bảy, 4 đài

/**
 * Cài đặt mặc định + thông tin đại lý mẫu (như lúc chụp bản chuẩn test/golden từ bản bash cũ) để so với bản bash.
 * Cỡ chữ đầu phiếu đặt đúng như bản bash (cố định 8 / 14 / 7,5 / 13 pt); mặc định của app có thể
 * khác (chủ dự án chỉnh lên 10 pt ngày 28-10-2026) mà không làm hỏng phép so với bash.
 */
export function agentSettings(): Settings {
  const s = defaultSettings()
  s.header.label.size = 8
  s.header.name.size = 14
  s.header.addr.size = 7.5
  s.header.phones.size = 7.5
  s.header.date.size = 13
  s.header.label.value = 'Đại lý vé số:'
  s.header.name.value = 'ĐỨC QUYẾT'
  s.header.addr.value = 'Chợ Tapao - Đ.Kho - T.Linh – B.Thuận'
  s.header.phones.values = ['01212 019 343', '0983 019 343']
  return s
}
