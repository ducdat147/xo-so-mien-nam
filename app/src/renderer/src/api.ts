import type { FontName } from '../../core/settings'
import type { XsmnApi } from '../../shared/api'

declare global {
  interface Window {
    xsmn: XsmnApi
  }
}

export const api: XsmnApi = window.xsmn

const fontCssCache = new Map<FontName, Promise<string>>()

/** @font-face của font in (lấy một lần từ main rồi giữ lại). */
export function loadFontCss(font: FontName): Promise<string> {
  let p = fontCssCache.get(font)
  if (!p) {
    p = api.fontCss(font).catch(() => '')
    fontCssCache.set(font, p)
  }
  return p
}
