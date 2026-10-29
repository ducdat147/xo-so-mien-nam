// Lựa chọn và nhãn hiển thị dùng chung giữa màn Kết quả và màn Cài đặt.

import type { PaperSpec } from '../../core/layout'
import type { OutputFormat, Paper } from '../../core/settings'
import type { SegOption } from './components/controls'

export const PAPER_OPTIONS: readonly SegOption<Paper>[] = [
  { value: 'A4', label: 'A4', sub: '4 bản/tờ' },
  { value: 'A5', label: 'A5', sub: '2 bản/tờ' },
  { value: 'A6', label: 'A6', sub: '1 bản/tờ' }
]

export const FORMAT_OPTIONS: readonly SegOption<OutputFormat>[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'both', label: 'Cả hai' }
]

/** Đuôi file hiện trong ví dụ tên file. */
export const FILE_EXT: Record<OutputFormat, string> = { pdf: '.pdf', docx: '.docx', both: '.pdf + .docx' }

export const ORIENT_LABEL: Record<PaperSpec['orient'], string> = { portrait: 'đứng', landscape: 'ngang' }

/** Tên file trong đường dẫn (cả kiểu Windows lẫn macOS/Linux). */
export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path
