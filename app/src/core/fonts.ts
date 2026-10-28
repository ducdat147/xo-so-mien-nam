// Nhúng font in (Tinos/Arimo, trùng số đo Times New Roman/Arial) vào HTML bằng data URI
// để PDF tự chứa font (SPEC §6.5). Chỉ dùng ở main process: đọc file trong @fontsource.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FontName } from './settings'

export const PRINT_FONTS: Readonly<Record<FontName, { pkg: string; id: string }>> = {
  'Times New Roman': { pkg: '@fontsource/tinos', id: 'tinos' },
  Arial: { pkg: '@fontsource/arimo', id: 'arimo' }
}

export const FONT_SUBSETS = ['latin', 'latin-ext', 'vietnamese'] as const
/** Mọi chữ trên phiếu đều đậm. */
export const FONT_WEIGHTS = [700] as const

const BLOCK = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g
const prop = (body: string, name: string) => body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim()

/**
 * Lấy CSS của @fontsource (ví dụ 700.css), giữ các subset cần,
 * thay url(./files/…woff2) bằng data URI.
 */
export function inlineFontCss(css: string, id: string, readFont: (file: string) => Uint8Array): string {
  const out: string[] = []
  for (const [, name, body] of css.matchAll(BLOCK)) {
    const subset = name.match(new RegExp(`^${id}-(.+)-\\d+-(?:normal|italic)$`))?.[1]
    if (!subset || !(FONT_SUBSETS as readonly string[]).includes(subset)) continue
    const file = body.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1]
    if (!file) continue
    const data = Buffer.from(readFont(file)).toString('base64')
    const range = prop(body, 'unicode-range')
    out.push(
      `@font-face{font-family:${prop(body, 'font-family')};font-style:${prop(body, 'font-style') ?? 'normal'};` +
        `font-weight:${prop(body, 'font-weight') ?? '400'};font-display:block;` +
        `src:url(data:font/woff2;base64,${data}) format('woff2')${range ? `;unicode-range:${range}` : ''}}`
    )
  }
  return out.join('\n')
}

/** pkgDir: thư mục gói @fontsource tương ứng (main tìm bằng require.resolve). */
export function loadFontCss(font: FontName, pkgDir: string): string {
  const { id } = PRINT_FONTS[font]
  return FONT_WEIGHTS.map((w) =>
    inlineFontCss(readFileSync(join(pkgDir, `${w}.css`), 'utf8'), id, (f) => readFileSync(join(pkgDir, 'files', f)))
  ).join('\n')
}
