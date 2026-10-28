// Ghi file PDF / Word vào thư mục lưu. Trùng tên thì ghi đè (cùng ngày, cùng khổ là cùng nội dung).

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { DayResult } from '../core/parse'
import { renderDocx } from '../core/render-docx'
import { renderHtml } from '../core/render-html'
import type { FontName, Settings } from '../core/settings'
import { buildSheet, outputBaseName } from '../core/sheet'
import { formatDate } from '../core/dates'
import type { ExportRequest, ExportResult } from '../shared/api'
import { resolveOutputDir } from './paths'
import { htmlToPdf } from './print'

function writeError(e: unknown, file: string): string {
  const code = (e as NodeJS.ErrnoException)?.code
  const name = basename(file)
  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
    return `Không ghi được ${name}. File có thể đang mở trong chương trình khác, hoặc thư mục không cho ghi.`
  }
  if (code === 'ENOSPC') return 'Ổ đĩa đã đầy, không lưu được file.'
  return `Không lưu được ${name}: ${(e as Error)?.message ?? e}`
}

export async function exportSheet(
  settings: Settings,
  day: DayResult | null,
  req: ExportRequest,
  fontCss: (font: FontName) => string
): Promise<ExportResult> {
  const { layout } = buildSheet(settings, day, req)
  const dir = resolveOutputDir(settings.output.dir)
  try {
    await mkdir(dir, { recursive: true })
  } catch (e) {
    return { ok: false, files: [], warnings: layout.warnings, error: `Không tạo được thư mục lưu ${dir}: ${(e as Error).message}` }
  }

  const base = join(dir, outputBaseName(req))
  const files: string[] = []
  const jobs: [string, () => Promise<Uint8Array>][] = []
  if (req.format !== 'docx') {
    jobs.push([`${base}.pdf`, () => htmlToPdf(renderHtml(layout, { fontCss: fontCss(layout.font) }))])
  }
  if (req.format !== 'pdf') {
    jobs.push([`${base}.docx`, () => renderDocx(layout, { title: `Kết quả XSMN ${formatDate(req.date)}` })])
  }
  for (const [file, make] of jobs) {
    let data: Uint8Array
    try {
      data = await make()
    } catch (e) {
      return { ok: false, files, warnings: layout.warnings, error: `Không tạo được ${basename(file)}: ${(e as Error).message}` }
    }
    try {
      await writeFile(file, data)
    } catch (e) {
      return { ok: false, files, warnings: layout.warnings, error: writeError(e, file) }
    }
    files.push(file)
  }
  return { ok: true, files, warnings: layout.warnings }
}
