import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDate, sameDate, todayVN, weekday, weekdayName } from '../../../core/dates'
import { PAPER_SPECS, TWIPS_PER_CM, viNumber, type SheetLayout } from '../../../core/layout'
import { renderHtml } from '../../../core/render-html'
import { selectStations } from '../../../core/select'
import type { OutputFormat, Paper, Settings } from '../../../core/settings'
import { buildSheet, outputBaseName } from '../../../core/sheet'
import type { LoadedResult } from '../../../core/source'
import type { SettingsPatch } from '../../../shared/api'
import { api } from '../api'
import { PrintDialog } from '../components/PrintDialog'
import { printerLabel } from '../components/PrinterSelect'
import { ResultTable } from '../components/ResultTable'
import { SheetPreview } from '../components/SheetPreview'
import { StatusCard } from '../components/StatusCard'
import { Toast, type ToastData } from '../components/Toast'
import { measureFontScale } from '../fonts'
import { useOnline, usePrinters } from '../hooks'
import { ORIENT_LABEL } from '../labels'
import { DateCard } from './results/DateCard'
import { PrintCard } from './results/PrintCard'
import { SaveCard } from './results/SaveCard'
import { useDayResult } from './results/useDayResult'
import { useDrawDate } from './results/useDrawDate'

const MM_TO_PX = 96 / 25.4

/** "A4 đứng · 4 bản · mỗi phiếu 8 × 13,7 cm · cách nhau 0,6 cm" */
function paperCaption(l: SheetLayout): string {
  const cm = (tw: number) => viNumber(tw / TWIPS_PER_CM)
  const size = `${cm(l.cardW)} × ${cm(l.cardH)} cm`
  const orient = ORIENT_LABEL[l.page.orient]
  if (l.copies === 1) return `${l.paper} ${orient} · 1 bản · phiếu ${size}`
  // Chỉ nói tới chiều có nhiều phiếu: A5 chỉ có 2 cột, A4 có cả cột lẫn hàng
  const gaps =
    l.nrow > 1 && l.ncol > 1 && l.gapX !== l.gapY
      ? `cách ngang ${cm(l.gapX)} cm, dọc ${cm(l.gapY)} cm`
      : `cách nhau ${cm(l.ncol > 1 ? l.gapX : l.gapY)} cm`
  return `${l.paper} ${orient} · ${l.copies} bản · mỗi phiếu ${size} · ${gaps}`
}

type Busy = null | 'print' | OutputFormat

export function ResultsScreen(props: {
  settings: Settings
  active: boolean
  onResult: (r: LoadedResult) => void
  /** Máy in / thư mục lưu đổi ở màn này được lưu ngay; báo App cập nhật cài đặt. */
  onSettingsChange: (s: Settings) => void
}) {
  const { settings, active, onResult, onSettingsChange } = props
  const { date, setDate, beforeDraw } = useDrawDate()
  const online = useOnline()
  const [paper, setPaper] = useState<Paper>(settings.print.paper)
  const [format, setFormat] = useState<OutputFormat>(settings.print.format)
  const [blank, setBlank] = useState(false)
  const [copies, setCopies] = useState(settings.printer.copies)
  const [view, setView] = useState<'preview' | 'table'>('preview')
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh)
  const [busy, setBusy] = useState<Busy>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [showPrint, setShowPrint] = useState(false)
  const printers = usePrinters()
  const deviceName = settings.printer.deviceName
  const silent = settings.printer.silent && !!deviceName

  // Đang xem trước khi in / đang in / đang lưu thì tạm dừng: bản in đúng bản vừa xem, số không nhảy giữa chừng
  const { current, loading, reload } = useDayResult(date, { autoRefresh, paused: showPrint || !!busy, online, onResult })
  const isToday = sameDate(date, todayVN())

  const patchSettings = useCallback(async (patch: SettingsPatch) => {
    try {
      onSettingsChange(await api.updateSettings(patch))
    } catch (e) {
      setToast({ kind: 'error', title: 'Không lưu được lựa chọn', text: (e as Error).message })
    }
  }, [onSettingsChange])
  const setDeviceName = useCallback((name: string | null) => patchSettings({ printer: { deviceName: name } }), [patchSettings])

  // Đổi mặc định trong Cài đặt thì màn này theo
  useEffect(() => setPaper(settings.print.paper), [settings.print.paper])
  useEffect(() => setFormat(settings.print.format), [settings.print.format])
  useEffect(() => setCopies(settings.printer.copies), [settings.printer.copies])
  useEffect(() => setAutoRefresh(settings.autoRefresh), [settings.autoRefresh])

  // ------------------------------------------------------------ phiếu
  const hasNumbers = !!current && (current.status === 'ok' || current.status === 'partial')
  const effectiveBlank = blank || !hasNumbers
  const font = settings.print.font
  const sheetReq = useMemo(
    () => ({ date, paper, blank: effectiveBlank, fontScale: measureFontScale(font) }),
    [date, paper, effectiveBlank, font]
  )
  const sheet = useMemo(() => buildSheet(settings, current, sheetReq), [settings, current, sheetReq])
  const html = useMemo(() => renderHtml(sheet.layout), [sheet])
  const tableStations = useMemo(
    () => selectStations({ day: current, weekday: weekday(date), stations: settings.stations }),
    [current, date, settings.stations]
  )
  const spec = PAPER_SPECS[paper]
  const perSheet = spec.ncol * spec.nrow

  // ------------------------------------------------------------ in & lưu
  const save = useCallback(async (fmt: OutputFormat) => {
    setBusy(fmt)
    try {
      const r = await api.exportSheet({ ...sheetReq, format: fmt })
      setToast(r.ok ? { kind: 'saved', files: r.files } : { kind: 'error', title: 'Không lưu được file', text: r.error ?? '' })
    } catch (e) {
      setToast({ kind: 'error', title: 'Không lưu được file', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }, [sheetReq])

  const deviceLabel = printerLabel(printers, deviceName)
  /** Gửi lệnh in. Có máy in cụ thể thì in thẳng; không thì mở hộp thoại in của hệ thống. */
  const doPrint = useCallback(async (): Promise<boolean> => {
    setBusy('print')
    try {
      const r = await api.print({ ...sheetReq, copies, deviceName, silent: !!deviceName })
      if (r.ok) {
        setToast({ kind: 'printed', copies, printer: deviceName ? deviceLabel : undefined })
        return true
      }
      if (!r.cancelled) {
        setToast({
          kind: 'error',
          title: 'Không in được',
          text: r.error ?? '',
          action: { label: 'Lưu PDF', run: () => save('pdf') }
        })
      }
      return false
    } catch (e) {
      setToast({ kind: 'error', title: 'Không in được', text: (e as Error).message })
      return false
    } finally {
      setBusy(null)
    }
  }, [sheetReq, copies, deviceName, deviceLabel, save])

  /** Nút In ở cột trái / Ctrl+P: mặc định mở bước xem trước; "In nhanh" thì in luôn. */
  const print = useCallback(() => {
    if (silent) doPrint()
    else setShowPrint(true)
  }, [silent, doPrint])
  const closePrint = useCallback(() => setShowPrint(false), [])

  const chooseDir = async () => {
    const dir = await api.chooseOutputDir(settings.output.dir)
    if (dir) await patchSettings({ output: { dir } })
  }

  const openDir = async () => {
    const err = await api.openOutputDir()
    if (err) setToast({ kind: 'error', title: 'Không mở được thư mục', text: err })
  }

  // Ctrl/⌘+P: In…; Ctrl/⌘+S: lưu theo "Loại file"
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || busy) return
      const k = e.key.toLowerCase()
      if (k === 'p') { e.preventDefault(); if (!showPrint) print() }
      else if (k === 's') { e.preventDefault(); save(format) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, busy, print, save, format, showPrint])

  const closeToast = useCallback(() => setToast(null), [])

  return (
    <div className="results">
      <aside className="results-side" aria-label="Chọn ngày và in">
        <DateCard date={date} onDate={setDate} beforeDraw={beforeDraw} loading={loading} onReload={reload} />
        <PrintCard
          paper={paper}
          onPaper={setPaper}
          blank={blank}
          onBlank={setBlank}
          printers={printers}
          deviceName={deviceName}
          onDeviceName={setDeviceName}
          copies={copies}
          onCopies={setCopies}
          perSheet={perSheet}
          silent={silent}
          onSilent={(on) => patchSettings({ printer: { silent: on } })}
          busy={!!busy}
          printing={busy === 'print'}
          onPrint={print}
        />
        <SaveCard
          format={format}
          onFormat={setFormat}
          dir={settings.output.dir}
          onChooseDir={chooseDir}
          onOpenDir={openDir}
          baseName={outputBaseName(sheetReq)}
          busy={!!busy}
          saving={!!busy && busy !== 'print'}
          onSave={() => save(format)}
        />
      </aside>

      <main className="results-main">
        <div className="viewbar">
          <div role="group" aria-label="Chế độ xem" className="viewtoggle">
            <button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Xem trước bản in</button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Bảng kết quả</button>
          </div>
          <span className="caption">{paperCaption(sheet.layout)}</span>
        </div>
        {/* Dải thông báo trên khung xem trước: nói về đúng nội dung đang xem (chủ dự án chọn 29-10-2026) */}
        <StatusCard
          date={date}
          result={current}
          autoRefresh={autoRefresh}
          onAutoRefresh={setAutoRefresh}
          canAutoRefresh={isToday}
          onRetry={reload}
          retrying={loading}
          online={online}
        />
        {sheet.layout.warnings.length > 0 && (
          <ul className="warnings">{sheet.layout.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        )}
        {view === 'preview' ? (
          <SheetPreview
            html={html}
            width={spec.widthMm * MM_TO_PX}
            height={spec.heightMm * MM_TO_PX}
            blank={effectiveBlank}
            label={`Xem trước bản in khổ ${paper}`}
          />
        ) : (
          <ResultTable stations={tableStations} font={font} live={!!current?.live} />
        )}
      </main>

      {showPrint && (
        <PrintDialog
          html={html}
          width={spec.widthMm * MM_TO_PX}
          height={spec.heightMm * MM_TO_PX}
          blank={effectiveBlank}
          summary={
            `${weekdayName(date)} ${formatDate(date)} · ${paper} ${ORIENT_LABEL[spec.orient]} · ` +
            `${perSheet} phiếu/tờ${effectiveBlank ? ' · phiếu trống' : ''}`
          }
          perSheet={perSheet}
          paperName={paper}
          copies={copies}
          onCopies={setCopies}
          printers={printers}
          deviceName={deviceName}
          onDeviceName={setDeviceName}
          busy={busy === 'print'}
          onPrint={async () => { if (await doPrint()) setShowPrint(false) }}
          onClose={closePrint}
        />
      )}

      {toast && <Toast toast={toast} onClose={closeToast} />}
    </div>
  )
}
