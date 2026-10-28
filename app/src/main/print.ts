// In và xuất PDF từ HTML trang in (SPEC §8.1, §8.3).
// Bước xem trước khi in nằm ở renderer (PrintDialog); ở đây chỉ gửi lệnh in: có máy in cụ thể thì
// in thẳng (silent), không thì mở hộp thoại in của hệ thống. In lỗi thì báo lỗi, KHÔNG tự xuất file.

import { BrowserWindow, type PrinterInfo } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Paper } from '../core/settings'
import type { PrinterItem } from '../shared/api'
import { tempDir } from './paths'

export interface PrintOptions {
  paper: Paper
  deviceName?: string
  silent?: boolean
  copies?: number
  /** Cửa sổ chính: hộp thoại in của hệ thống cần một cửa sổ đang hiện để gắn vào (macOS). */
  parent?: BrowserWindow | null
}

export interface PrintOutcome {
  ok: boolean
  cancelled?: boolean
  /** Lý do lỗi, đã viết lại bằng tiếng Việt. */
  reason?: string
}

/** Lý do lỗi của Chromium → câu tiếng Việt cho người dùng. */
export function printFailureMessage(reason: string): string {
  if (/no printers/i.test(reason)) return 'Máy chưa cài máy in nào. Cài hoặc cắm máy in rồi thử lại, hoặc lưu PDF để in ở máy khác.'
  if (/invalid device ?name/i.test(reason)) return 'Không thấy máy in đã chọn. Kiểm tra máy in đã bật và cắm cáp chưa, hoặc chọn máy in khác.'
  if (/print job failed|failed/i.test(reason)) return 'Máy in báo lỗi khi nhận lệnh in. Kiểm tra máy in (giấy, mực, kết nối) rồi thử lại.'
  return `Máy in báo lỗi: ${reason || 'không rõ lý do'}.`
}

/** Khổ giấy cho máy in, tính bằng micromet. A5 in ngang. */
const PAGE: Record<Paper, { width: number; height: number; landscape: boolean }> = {
  A4: { width: 210000, height: 297000, landscape: false },
  A5: { width: 148000, height: 210000, landscape: true },
  A6: { width: 105000, height: 148000, landscape: false }
}

/** Khổ trang khi đã xoay, tính bằng mm. */
function pageMm(paper: Paper): { w: number; h: number } {
  const p = PAGE[paper]
  const w = p.width / 1000
  const h = p.height / 1000
  return p.landscape ? { w: h, h: w } : { w, h }
}

const MM_TO_PX = 96 / 25.4
/** Cửa sổ "Đang in" hiện trang ở tỉ lệ này (chỉ trên màn hình, bản in không đổi). */
const SHOWN_ZOOM = 0.55

/**
 * Nạp HTML vào một cửa sổ riêng, chờ font sẵn sàng rồi chạy fn. Mặc định cửa sổ ẩn; `shown` thì
 * hiện một cửa sổ nhỏ "Đang in" (thu nhỏ bằng CSS @media screen) để hộp thoại in gắn vào.
 */
async function withSheetWindow<T>(
  html: string,
  fn: (win: BrowserWindow) => Promise<T>,
  shown?: { paper: Paper; parent?: BrowserWindow | null }
): Promise<T> {
  await mkdir(tempDir(), { recursive: true })
  const file = join(tempDir(), `sheet-${randomUUID()}.html`)
  await writeFile(file, html, 'utf8')
  const size = shown && pageMm(shown.paper)
  const win = new BrowserWindow({
    show: false,
    ...(size && {
      width: Math.round(size.w * MM_TO_PX * SHOWN_ZOOM),
      height: Math.round(size.h * MM_TO_PX * SHOWN_ZOOM),
      useContentSize: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: 'Đang in…',
      parent: shown.parent ?? undefined,
      backgroundColor: '#FFFFFF'
    }),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  try {
    await win.loadFile(file)
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
    if (shown) {
      await win.webContents.insertCSS(`@media screen{html{zoom:${SHOWN_ZOOM}}html,body{overflow:hidden}}`)
      win.show()
    }
    return await fn(win)
  } finally {
    if (!win.isDestroyed()) win.destroy()
    await rm(file, { force: true })
  }
}

/** Mỗi file đúng 1 trang, khổ lấy từ @page của HTML. */
export function htmlToPdf(html: string): Promise<Buffer> {
  return withSheetWindow(html, (win) =>
    win.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      pageRanges: '1'
    })
  )
}

export async function printSheet(html: string, opts: PrintOptions): Promise<PrintOutcome> {
  const page = PAGE[opts.paper]
  const silent = !!opts.silent && !!opts.deviceName
  return withSheetWindow(
    html,
    (win) =>
      new Promise<PrintOutcome>((resolve) => {
        win.webContents.print(
          {
            silent,
            printBackground: true,
            deviceName: opts.deviceName || undefined,
            copies: Math.min(99, Math.max(1, Math.round(opts.copies ?? 1))),
            margins: { marginType: 'none' },
            pageSize: { width: page.width, height: page.height },
            landscape: page.landscape
          },
          (success, failureReason) => {
            if (success) resolve({ ok: true })
            else if (/cancel/i.test(failureReason)) resolve({ ok: false, cancelled: true })
            else resolve({ ok: false, reason: printFailureMessage(failureReason) })
          }
        )
      }),
    // In thẳng thì cửa sổ ẩn; mở hộp thoại hệ thống thì cần cửa sổ đang hiện
    silent ? undefined : { paper: opts.paper, parent: opts.parent }
  )
}

/** Máy in mặc định: Electron ≤ 22 có cờ isDefault, bản mới chỉ còn trong options (CUPS). */
function isDefaultPrinter(p: PrinterInfo): boolean {
  const o = (p.options ?? {}) as Record<string, string>
  return (p as PrinterInfo & { isDefault?: boolean }).isDefault === true || o['is-default'] === 'true' || o['printer-is-default'] === 'true'
}

export async function listPrinters(): Promise<PrinterItem[]> {
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  if (!win) return []
  const list = await win.webContents.getPrintersAsync()
  return list
    .map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: isDefaultPrinter(p) }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.displayName.localeCompare(b.displayName, 'vi'))
}
