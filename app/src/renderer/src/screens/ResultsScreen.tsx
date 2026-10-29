import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays, compareDate, defaultDrawDate, formatDate, isBeforeDraw, parseDate, sameDate, todayVN, toIsoDate, weekday, weekdayName, type DateVN
} from '../../../core/dates'
import { PAPER_SPECS, TWIPS_PER_CM, viNumber, type SheetLayout } from '../../../core/layout'
import { renderHtml } from '../../../core/render-html'
import { selectStations } from '../../../core/select'
import type { OutputFormat, Paper, Settings } from '../../../core/settings'
import { buildSheet, outputBaseName } from '../../../core/sheet'
import type { LoadedResult } from '../../../core/source'
import { fullName, scheduleFor } from '../../../core/stations'
import type { SettingsPatch } from '../../../shared/api'
import { api } from '../api'
import { measureFontScale } from '../fonts'
import { useOnline, usePrinters } from '../hooks'
import { Segmented } from '../components/controls'
import { CompactInput } from '../components/CompactInput'
import { PrintDialog } from '../components/PrintDialog'
import { PrinterSelect } from '../components/PrinterSelect'
import { Download, Printer, Refresh } from '../components/icons'
import { ResultTable } from '../components/ResultTable'
import { SheetPreview } from '../components/SheetPreview'
import { StatusCard } from '../components/StatusCard'
import { Toast, type ToastData } from '../components/Toast'

const PAPER_OPTIONS = [
  { value: 'A4', label: 'A4', sub: '4 bản/tờ' },
  { value: 'A5', label: 'A5', sub: '2 bản/tờ' },
  { value: 'A6', label: 'A6', sub: '1 bản/tờ' }
] as const
const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'both', label: 'Cả hai' }
] as const

const FILE_EXT: Record<OutputFormat, string> = { pdf: '.pdf', docx: '.docx', both: '.pdf + .docx' }
const SAVE_LABEL: Record<OutputFormat, string> = { pdf: 'Lưu PDF', docx: 'Lưu Word', both: 'Lưu PDF và Word' }

const AUTO_REFRESH_MS = 2 * 60 * 1000
/** Trước giờ quay thì đợi tới 16:10 mới bắt đầu hỏi lại. */
const DRAW_START_MIN = 16 * 60 + 10
const MM_TO_PX = 96 / 25.4

function nextRefreshDelay(status: LoadedResult['status']): number {
  if (status !== 'none') return AUTO_REFRESH_MS
  const t = new Date(Date.now() + 7 * 3600 * 1000)
  const left = DRAW_START_MIN * 60 - (t.getUTCHours() * 3600 + t.getUTCMinutes() * 60 + t.getUTCSeconds())
  return left > 0 ? left * 1000 : AUTO_REFRESH_MS
}

const dayLineName = (slug: string) => (slug === 'tp-hcm' ? 'TP.HCM' : fullName(slug))

/** "A4 đứng · 4 bản · mỗi phiếu 8 × 13,7 cm · cách nhau 0,6 cm" */
function paperCaption(l: SheetLayout): string {
  const cm = (tw: number) => viNumber(tw / TWIPS_PER_CM)
  const size = `${cm(l.cardW)} × ${cm(l.cardH)} cm`
  const orient = l.page.orient === 'portrait' ? 'đứng' : 'ngang'
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
  const [date, setDateState] = useState<DateVN>(() => defaultDrawDate())
  // Người dùng tự chọn ngày thì thôi tự đổi ngày lúc 16h
  const userPicked = useRef(false)
  const setDate = (d: DateVN) => {
    userPicked.current = true
    setDateState(d)
  }
  const online = useOnline()
  // Trước 16h hôm nay chưa quay: khoá nút "Hôm nay"
  const [beforeDraw, setBeforeDraw] = useState(() => isBeforeDraw())
  const [paper, setPaper] = useState<Paper>(settings.print.paper)
  const [format, setFormat] = useState<OutputFormat>(settings.print.format)
  const [blank, setBlank] = useState(false)
  const [copies, setCopies] = useState(settings.printer.copies)
  const [view, setView] = useState<'preview' | 'table'>('preview')
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh)
  const [result, setResult] = useState<LoadedResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const { printers, loading: findingPrinters, refresh: refreshPrinters } = usePrinters()
  const deviceName = settings.printer.deviceName
  const silent = settings.printer.silent && !!deviceName
  const printerLabel = printers?.find((p) => p.name === deviceName)?.displayName ?? deviceName ?? ''

  const patchSettings = useCallback(async (patch: SettingsPatch) => {
    try {
      onSettingsChange(await api.updateSettings(patch))
    } catch (e) {
      setToast({ kind: 'error', title: 'Không lưu được lựa chọn', text: (e as Error).message })
    }
  }, [onSettingsChange])

  // Đổi mặc định trong Cài đặt thì màn này theo
  useEffect(() => setPaper(settings.print.paper), [settings.print.paper])
  useEffect(() => setFormat(settings.print.format), [settings.print.format])
  useEffect(() => setCopies(settings.printer.copies), [settings.printer.copies])
  useEffect(() => setAutoRefresh(settings.autoRefresh), [settings.autoRefresh])

  // ------------------------------------------------------------ lấy kết quả
  const key = formatDate(date)
  const reqId = useRef(0)
  const load = useCallback(async (d: DateVN, force: boolean) => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const r = await api.fetchResults(d, force)
      if (id !== reqId.current) return
      setResult(r)
      onResult(r)
    } catch (e) {
      if (id !== reqId.current) return
      setResult({
        date: formatDate(d), status: 'error', pageDate: null, stations: [], filled: 0, total: 0,
        message: (e as Error).message, fromCache: false, fetchedAt: new Date().toISOString()
      })
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [onResult])

  // Tự lấy khi mở app và khi đổi ngày (dùng cache nếu đã đủ số)
  useEffect(() => { load(date, false) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = result && result.date === key ? result : null
  const isToday = sameDate(date, todayVN())
  const waiting = !!current && (current.status === 'partial' || current.status === 'none')

  useEffect(() => {
    if (!autoRefresh || !waiting || !isToday || !current) return
    const t = setTimeout(() => load(date, true), nextRefreshDelay(current.status))
    return () => clearTimeout(t)
  }, [autoRefresh, waiting, isToday, current, date, load])

  // Máy chủ minhngoc lỗi: 2 phút thử lại một lần, ngày nào cũng vậy
  const serverDown = current?.status === 'error' && current.errorKind === 'server'
  useEffect(() => {
    if (!serverDown || !online) return
    const t = setTimeout(() => load(date, true), AUTO_REFRESH_MS)
    return () => clearTimeout(t)
  }, [serverDown, online, current, date, load])

  // Mất mạng: có mạng lại thì lấy ngay; hệ điều hành báo có mạng mà vẫn chưa ra được Internet
  // (cắm mạng nội bộ, wifi chưa đăng nhập…) thì 15 giây thử một lần
  const netDown = current?.status === 'error' && current.errorKind === 'offline'
  const wasOnline = useRef(online)
  useEffect(() => {
    if (online && !wasOnline.current && (!current || current.status === 'error')) load(date, false)
    wasOnline.current = online
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!netDown || !online) return
    const t = setTimeout(() => load(date, false), 15000)
    return () => clearTimeout(t)
  }, [netDown, online, current, date, load])

  // Để app mở qua 16h: tự chuyển sang ngày hôm nay nếu người dùng chưa tự chọn ngày
  useEffect(() => {
    const t = setInterval(() => {
      setBeforeDraw(isBeforeDraw())
      if (userPicked.current) return
      const d = defaultDrawDate()
      setDateState((cur) => (sameDate(cur, d) ? cur : d))
    }, 30000)
    return () => clearInterval(t)
  }, [])

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

  const [showPrint, setShowPrint] = useState(false)

  /** Gửi lệnh in. Có máy in cụ thể thì in thẳng; không thì mở hộp thoại in của hệ thống. */
  const doPrint = useCallback(async (): Promise<boolean> => {
    setBusy('print')
    try {
      const r = await api.print({ ...sheetReq, copies, deviceName, silent: !!deviceName })
      if (r.ok) {
        setToast({ kind: 'printed', copies, printer: deviceName ? printerLabel : undefined })
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
  }, [sheetReq, copies, deviceName, printerLabel, save])

  /** Nút In ở cột trái / Ctrl+P: mặc định mở bước xem trước; "In nhanh" thì in luôn. */
  const print = useCallback(() => {
    if (silent) doPrint()
    else setShowPrint(true)
  }, [silent, doPrint])

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
        <section className="card">
          <div className="field">
            <label htmlFor="ngay" className="field-label">Ngày xổ</label>
            <input
              id="ngay"
              type="date"
              className="input"
              value={toIsoDate(date)}
              // Chỉ chọn tới hôm nay (giờ VN); gõ tay ngày sau đó thì đưa về hôm nay
              max={toIsoDate(todayVN())}
              onChange={(e) => {
                const d = parseDate(e.target.value)
                if (!d) return
                const today = todayVN()
                setDate(compareDate(d, today) > 0 ? today : d)
              }}
            />
            <div className="row">
              <button
                type="button"
                className="btn grow"
                onClick={() => setDate(todayVN())}
                disabled={beforeDraw}
                title={beforeDraw ? 'Kết quả hôm nay có từ 16h' : undefined}
              >
                Hôm nay
              </button>
              <button type="button" className="btn grow" onClick={() => setDate(addDays(todayVN(), -1))}>Hôm qua</button>
            </div>
            <p className="hint">{weekdayName(date)} · {scheduleFor(weekday(date)).map(dayLineName).join(', ')}</p>
            {beforeDraw && <p className="hint">Chưa tới 16h nên chưa có kết quả hôm nay.</p>}
          </div>

          <Segmented id="kho-label" label="Khổ giấy" options={PAPER_OPTIONS} value={paper} onChange={setPaper} variant="tall" />

          <label className="check">
            <input type="checkbox" checked={blank} onChange={(e) => setBlank(e.target.checked)} />
            <span>In phiếu trống (chưa có số)</span>
          </label>

          <button type="button" className="btn primary" onClick={() => load(date, true)} disabled={loading}>
            <Refresh spinning={loading} />
            {loading ? 'Đang lấy kết quả…' : 'Lấy kết quả'}
          </button>
        </section>

        <StatusCard
          date={date}
          result={current}
          autoRefresh={autoRefresh}
          onAutoRefresh={setAutoRefresh}
          canAutoRefresh={isToday}
          onRetry={() => load(date, true)}
          retrying={loading}
          online={online}
        />

        <section className="card tight" aria-labelledby="h-in-phieu">
          <h2 id="h-in-phieu" className="card-title"><Printer /> In phiếu</h2>
          <PrinterSelect
            id="may-in"
            label="Máy in"
            value={deviceName}
            onChange={(name) => patchSettings({ printer: { deviceName: name } })}
            printers={printers}
            loading={findingPrinters}
            onRefresh={refreshPrinters}
          />
          <div className="copies">
            <div className="copies-text">
              <label htmlFor="so-ban" className="field-label">Số bản in</label>
              <span className="hint">
                {copies} tờ {paper} = {copies * perSheet} phiếu
              </span>
            </div>
            <CompactInput id="so-ban" kind="copies" label="số bản in" title="Số tờ in" unit="tờ"
              value={copies} min={1} max={99} step={1} onChange={(v) => v !== null && setCopies(v)} />
          </div>
          <label className={`check small${deviceName ? '' : ' disabled'}`}>
            <input
              type="checkbox"
              checked={silent}
              disabled={!deviceName}
              onChange={(e) => patchSettings({ printer: { silent: e.target.checked } })}
            />
            <span>In nhanh, bỏ qua bước xem trước</span>
          </label>
          {!deviceName && <span className="hint">Chọn một máy in cụ thể để bật in nhanh.</span>}
          <button type="button" className="btn accent" onClick={print} disabled={!!busy}>
            <Printer />
            {busy === 'print' ? 'Đang gửi lệnh in…' : silent ? `In ngay ${copies} tờ` : 'Xem trước và in…'}
          </button>
          {silent && <span className="hint">Bấm là in ngay ra “{printerLabel}”, không xem trước.</span>}
        </section>

        <section className="card tight" aria-labelledby="h-luu-file">
          <h2 id="h-luu-file" className="card-title"><Download /> Lưu file</h2>
          <Segmented id="dd-label" label="Loại file" options={FORMAT_OPTIONS} value={format} onChange={setFormat} variant="plain" />
          <div className="field">
            <label htmlFor="noi-luu" className="field-label">Vị trí lưu</label>
            <div className="row">
              <input id="noi-luu" className="input grow" value={settings.output.dir} title={settings.output.dir} readOnly />
              <button type="button" className="btn" onClick={chooseDir}>Chọn…</button>
            </div>
            <button type="button" className="btn ghost small-btn" onClick={openDir}>Mở thư mục</button>
          </div>
          <p className="hint">
            Tên file: <strong>{outputBaseName(sheetReq)}{FILE_EXT[format]}</strong>. Lưu trùng tên thì ghi đè.
          </p>
          <button type="button" className="btn primary" onClick={() => save(format)} disabled={!!busy}>
            <Download />
            {busy && busy !== 'print' ? 'Đang lưu…' : SAVE_LABEL[format]}
          </button>
        </section>
      </aside>

      <main className="results-main">
        <div className="viewbar">
          <div role="group" aria-label="Chế độ xem" className="viewtoggle">
            <button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Xem trước bản in</button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Bảng kết quả</button>
          </div>
          <span className="caption">{paperCaption(sheet.layout)}</span>
        </div>
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
          <ResultTable stations={tableStations} />
        )}
      </main>

      {showPrint && (
        <PrintDialog
          html={html}
          width={spec.widthMm * MM_TO_PX}
          height={spec.heightMm * MM_TO_PX}
          blank={effectiveBlank}
          summary={
            `${weekdayName(date)} ${formatDate(date)} · ${paper} ${spec.orient === 'portrait' ? 'đứng' : 'ngang'} · ` +
            `${perSheet} phiếu/tờ${effectiveBlank ? ' · phiếu trống' : ''}`
          }
          perSheet={perSheet}
          paperName={paper}
          copies={copies}
          onCopies={setCopies}
          printers={printers}
          findingPrinters={findingPrinters}
          onRefreshPrinters={refreshPrinters}
          deviceName={deviceName}
          onDeviceName={(name) => patchSettings({ printer: { deviceName: name } })}
          busy={busy === 'print'}
          onPrint={async () => { if (await doPrint()) setShowPrint(false) }}
          onSavePdf={() => { setShowPrint(false); save('pdf') }}
          onClose={() => setShowPrint(false)}
        />
      )}

      {toast && <Toast toast={toast} onClose={closeToast} />}
    </div>
  )
}
