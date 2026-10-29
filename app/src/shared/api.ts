// Hợp đồng IPC giữa renderer và main (window.xsmn). Chỉ chứa kiểu, không có mã chạy.

import type { DateVN } from '../core/dates'
import type { LoadedResult } from '../core/source'
import type { OutputFormat, PrinterSettings, Settings } from '../core/settings'
import type { SheetRequest } from '../core/sheet'

export interface InitialData {
  settings: Settings
  version: string
  platform: string
}

export interface ExportRequest extends SheetRequest {
  format: OutputFormat
}

export interface ExportResult {
  ok: boolean
  /** Đường dẫn các file đã ghi. */
  files: string[]
  warnings: string[]
  error?: string
}

export interface PrintRequest extends SheetRequest {
  copies: number
  /** Tên máy in; null = để hộp thoại in của hệ thống hỏi. */
  deviceName: string | null
  /** In thẳng không hiện hộp thoại (chỉ khi đã chọn máy in). */
  silent: boolean
}

export interface PrinterItem {
  /** Tên hệ thống, dùng để gửi lệnh in. */
  name: string
  /** Tên hiện cho người dùng. */
  displayName: string
  isDefault: boolean
}

/** Phần cài đặt sửa thẳng từ màn Kết quả (lưu ngay, không qua nút Lưu cài đặt). */
export interface SettingsPatch {
  printer?: Partial<PrinterSettings>
  output?: { dir: string }
}

export interface PrintResult {
  ok: boolean
  /** Người dùng bấm Huỷ ở hộp thoại in. */
  cancelled?: boolean
  error?: string
}

export interface ConfImportResult {
  settings: Settings
  imported: number
  ignored: string[]
  file: string
}

export interface XsmnApi {
  init(): Promise<InitialData>
  fetchResults(date: DateVN, force: boolean): Promise<LoadedResult>
  exportSheet(req: ExportRequest): Promise<ExportResult>
  print(req: PrintRequest): Promise<PrintResult>
  /** Mở file vừa xuất bằng ứng dụng mặc định. Trả chuỗi lỗi, rỗng nếu thành công. */
  openFile(path: string): Promise<string>
  showInFolder(path: string): Promise<void>
  openOutputDir(): Promise<string>
  /** Lưu cài đặt; trả về bản đã chuẩn hoá. */
  saveSettings(s: Settings): Promise<Settings>
  /** Chọn file xsmn.conf rồi nhập đè lên `base`. null = người dùng huỷ. */
  importConf(base: Settings): Promise<ConfImportResult | null>
  /** Hộp thoại "Lưu thành" rồi ghi cài đặt ra file .conf. Trả đường dẫn, null = huỷ. */
  exportConf(settings: Settings): Promise<string | null>
  /** Hộp thoại chọn thư mục lưu. null = huỷ. */
  chooseOutputDir(current: string): Promise<string | null>
  /** Máy in đang cài trên máy. */
  listPrinters(): Promise<PrinterItem[]>
  /** Sửa và lưu ngay một phần cài đặt; trả về cài đặt đầy đủ sau khi lưu. */
  updateSettings(patch: SettingsPatch): Promise<Settings>
}

export const IPC = {
  init: 'xsmn:init',
  fetchResults: 'xsmn:fetch-results',
  exportSheet: 'xsmn:export-sheet',
  print: 'xsmn:print',
  openFile: 'xsmn:open-file',
  showInFolder: 'xsmn:show-in-folder',
  openOutputDir: 'xsmn:open-output-dir',
  saveSettings: 'xsmn:save-settings',
  importConf: 'xsmn:import-conf',
  exportConf: 'xsmn:export-conf',
  chooseOutputDir: 'xsmn:choose-output-dir',
  listPrinters: 'xsmn:list-printers',
  updateSettings: 'xsmn:update-settings'
} as const
