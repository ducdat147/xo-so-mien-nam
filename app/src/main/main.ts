// Main process: cửa sổ, IPC. Mạng và file chỉ đi qua đây (renderer chạy sandbox).

import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import { formatDate, isValidDate, type DateVN } from '../core/dates'
import { renderHtml } from '../core/render-html'
import { exportConf, importConf } from '../core/conf'
import { FORMATS, normalizeSettings, PAPERS, type Settings } from '../core/settings'
import { readSettingsFile, writeSettingsFile } from '../core/settings-file'
import type { FontScale } from '../core/layout'
import { buildSheet, type SheetRequest } from '../core/sheet'
import { loadResults, type LoadedResult } from '../core/source'
import { IPC, type ExportRequest, type InitialData, type PrintRequest, type PrintResult, type SettingsPatch } from '../shared/api'
import { exportSheet } from './export'
import { httpFetch } from './http'
import { cacheDir, resolveOutputDir, settingsFile } from './paths'
import { listPrinters, printSheet } from './print'
import { showSplash } from './splash'
import { APP_NAME } from '../shared/brand'

// Ô chọn ngày và các hộp thoại hệ thống hiện tiếng Việt
app.commandLine.appendSwitch('lang', 'vi')
// Chạy thử với thư mục dữ liệu riêng (cài đặt, cache) mà không đụng dữ liệu thật
// Thư mục dữ liệu giữ tên "XSMN" dù tên app đổi, để cập nhật bản mới không mất cài đặt đã lưu.
// XSMN_USER_DATA: chạy thử với thư mục riêng mà không đụng dữ liệu thật.
app.setName(APP_NAME)
app.setPath('userData', process.env.XSMN_USER_DATA || join(app.getPath('appData'), 'XSMN'))

let mainWindow: BrowserWindow | null = null
let settings: Settings
/** Kết quả đã tải theo ngày (DD-MM-YYYY): xuất file dùng đúng dữ liệu đang hiện trên màn hình. */
const results = new Map<string, LoadedResult>()
/** Chỉ cho mở những file app vừa ghi ra. */
const exportedFiles = new Set<string>()

// ---------------------------------------------------------------- kiểm tra tham số IPC

function checkDate(v: unknown): DateVN {
  const d = v as DateVN
  if (!d || !isValidDate(d.y, d.m, d.d)) throw new Error('Ngày không hợp lệ')
  return { y: d.y, m: d.m, d: d.d }
}

/** Tỉ lệ font renderer đo được; sai kiểu thì bỏ (layout tính như Times). */
function checkFontScale(v: unknown): FontScale | undefined {
  const f = v as FontScale | undefined
  const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 10
  return f && ok(f.digits) && ok(f.text) ? { digits: f.digits, text: f.text } : undefined
}

function checkSheet(v: unknown): SheetRequest {
  const r = (v ?? {}) as SheetRequest
  if (!PAPERS.includes(r.paper)) throw new Error('Khổ giấy không hợp lệ')
  return { date: checkDate(r.date), paper: r.paper, blank: !!r.blank, fontScale: checkFontScale(r.fontScale) }
}

const dayFor = (req: SheetRequest) => results.get(formatDate(req.date)) ?? null

// ---------------------------------------------------------------- IPC

function registerIpc(): void {
  ipcMain.handle(IPC.init, (): InitialData => ({ settings, version: app.getVersion(), platform: process.platform }))

  ipcMain.handle(IPC.fetchResults, async (_e, date: unknown, force: unknown) => {
    const r = await loadResults(checkDate(date), {
      fetch: httpFetch,
      cacheDir: cacheDir(),
      force: !!force
    })
    results.set(r.date, r)
    return r
  })

  ipcMain.handle(IPC.exportSheet, async (_e, raw: unknown) => {
    const req: ExportRequest = { ...checkSheet(raw), format: (raw as ExportRequest).format }
    if (!FORMATS.includes(req.format)) throw new Error('Định dạng không hợp lệ')
    const r = await exportSheet(settings, dayFor(req), req)
    r.files.forEach((f) => exportedFiles.add(f))
    return r
  })

  ipcMain.handle(IPC.print, async (_e, raw: unknown): Promise<PrintResult> => {
    const req = checkSheet(raw)
    const r = raw as PrintRequest
    const copies = Math.min(99, Math.max(1, Math.round(Number(r.copies) || 1)))
    const deviceName = typeof r.deviceName === 'string' && r.deviceName ? r.deviceName : null
    // In thẳng chỉ khi đã chọn máy in cụ thể; không thì luôn hiện hộp thoại của hệ thống
    const silent = !!r.silent && !!deviceName
    if (deviceName && !(await listPrinters()).some((p) => p.name === deviceName)) {
      return {
        ok: false,
        error: `Không thấy máy in “${deviceName}”. Kiểm tra máy in đã bật và cắm cáp chưa, hoặc chọn máy in khác.`
      }
    }
    const { layout } = buildSheet(settings, dayFor(req), req)
    try {
      const out = await printSheet(renderHtml(layout), {
        paper: req.paper,
        copies,
        deviceName: deviceName ?? undefined,
        silent,
        parent: mainWindow
      })
      return { ok: out.ok, cancelled: out.cancelled, error: out.reason }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IPC.openFile, (_e, path: unknown) => {
    if (typeof path !== 'string' || !exportedFiles.has(path)) return 'Không mở được file này.'
    return shell.openPath(path)
  })

  ipcMain.handle(IPC.showInFolder, (_e, path: unknown) => {
    if (typeof path === 'string' && exportedFiles.has(path)) shell.showItemInFolder(path)
  })

  ipcMain.handle(IPC.openOutputDir, async () => {
    const dir = resolveOutputDir(settings.output.dir)
    try {
      await mkdir(dir, { recursive: true })
    } catch (e) {
      return `Không tạo được thư mục ${dir}: ${(e as Error).message}`
    }
    return shell.openPath(dir)
  })

  ipcMain.handle(IPC.listPrinters, () => listPrinters().catch(() => []))

  ipcMain.handle(IPC.updateSettings, async (_e, raw: unknown) => {
    const patch = (raw ?? {}) as SettingsPatch
    const next = normalizeSettings({
      ...settings,
      printer: { ...settings.printer, ...(patch.printer ?? {}) },
      output: patch.output ? { dir: patch.output.dir } : settings.output
    })
    settings = await writeSettingsFile(settingsFile(), next)
    return settings
  })

  ipcMain.handle(IPC.saveSettings, async (_e, raw: unknown) => {
    settings = await writeSettingsFile(settingsFile(), normalizeSettings(raw))
    return settings
  })

  ipcMain.handle(IPC.importConf, async (e, base: unknown) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts = {
      title: 'Nhập cài đặt từ file .conf',
      properties: ['openFile' as const],
      filters: [{ name: 'File cấu hình (.conf)', extensions: ['conf', 'txt', 'example'] }, { name: 'Mọi file', extensions: ['*'] }]
    }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || !r.filePaths[0]) return null
    const file = r.filePaths[0]
    const out = importConf(await readFile(file, 'utf8'), normalizeSettings(base))
    return { ...out, file }
  })

  ipcMain.handle(IPC.exportConf, async (e, raw: unknown) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts = {
      title: 'Xuất cài đặt ra file .conf',
      defaultPath: join(app.getPath('documents'), 'xo-so-dai-ly.conf'),
      filters: [{ name: 'File cấu hình (.conf)', extensions: ['conf'] }]
    }
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (r.canceled || !r.filePath) return null
    const now = new Date(Date.now() + 7 * 3600 * 1000) // giờ Việt Nam
    const when =
      `${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${now.getUTCFullYear()} ` +
      `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
    await writeFile(r.filePath, exportConf(normalizeSettings(raw), { appName: APP_NAME, version: app.getVersion(), when }), 'utf8')
    exportedFiles.add(r.filePath)
    return r.filePath
  })

  ipcMain.handle(IPC.chooseOutputDir, async (e, current: unknown) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts = {
      title: 'Chọn thư mục lưu file',
      defaultPath: resolveOutputDir(typeof current === 'string' ? current : settings.output.dir),
      properties: ['openDirectory' as const, 'createDirectory' as const]
    }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || !r.filePaths[0]) return null
    // Trong thư mục nhà thì ghi gọn dạng ~/… cho dễ đọc
    const p = r.filePaths[0]
    const home = homedir()
    return p === home ? '~' : p.startsWith(home + sep) ? '~' + p.slice(home.length) : p
  })
}

// ---------------------------------------------------------------- cửa sổ & menu

function buildMenu(): void {
  const dev = !app.isPackaged
  if (process.platform !== 'darwin') {
    // Windows/Linux: không cần thanh menu; bản dev giữ menu mặc định để có DevTools
    if (!dev) Menu.setApplicationMenu(null)
    return
  }
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    ...(dev ? [{ role: 'viewMenu' } as MenuItemConstructorOptions] : []),
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(onReady?: (show: () => void) => void): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    backgroundColor: '#F3F4F6',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  mainWindow = win
  win.once('ready-to-show', () => (onReady ? onReady(() => win.show()) : win.show()))
  win.on('closed', () => { mainWindow = null })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// Không cho trang tự mở cửa sổ mới hay điều hướng đi nơi khác; link http mở bằng trình duyệt
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (e, url) => {
    if (url !== contents.getURL()) e.preventDefault()
  })
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    settings = await readSettingsFile(settingsFile())
    registerIpc()
    buildMenu()
    const splash = showSplash(app.getVersion())
    createWindow((show) => splash.close(show))
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
