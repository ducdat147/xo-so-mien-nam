import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DayResult } from '../../core/parse'
import { normalizeSettings, type Settings } from '../../core/settings'
import type { LoadedResult } from '../../core/source'
import { APP_NAME, APP_TAGLINE } from '../../shared/brand'
import { api } from './api'
import { ArrowLeft, Gear, Globe, Logo, WifiOff } from './components/icons'
import { useOnline } from './hooks'
import { ResultsScreen } from './screens/ResultsScreen'
import { SettingsScreen } from './screens/SettingsScreen'

type Screen = 'results' | 'settings'

const same = (a: Settings, b: Settings) => JSON.stringify(normalizeSettings(a)) === JSON.stringify(normalizeSettings(b))

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [version, setVersion] = useState('')
  const [draft, setDraftState] = useState<Settings | null>(null)
  const [screen, setScreen] = useState<Screen>('results')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  // Kết quả tải gần nhất: màn Cài đặt dùng để xem trước phiếu
  const [lastResult, setLastResult] = useState<DayResult | null>(null)
  const online = useOnline()

  useEffect(() => {
    api.init().then(
      (d) => {
        setSettings(d.settings)
        setDraftState(d.settings)
        setVersion(d.version)
      },
      (e) => setError(String(e?.message ?? e))
    )
  }, [])

  const onResult = useCallback((r: LoadedResult) => {
    if (r.status === 'ok' || r.status === 'partial') setLastResult(r)
  }, [])

  // Máy in / thư mục lưu đổi ở màn Kết quả: đã lưu ngay, cập nhật luôn bản nháp ở màn Cài đặt
  const onQuickSettings = useCallback((s: Settings) => {
    setSettings(s)
    setDraftState((d) => (d ? { ...d, printer: s.printer, output: s.output } : s))
  }, [])

  const setDraft = useCallback((fn: (d: Settings) => void) => {
    setDraftState((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])

  const dirty = useMemo(() => !!settings && !!draft && !same(settings, draft), [settings, draft])

  /** Trả chuỗi lỗi, rỗng nếu lưu được. */
  const save = useCallback(async (): Promise<string> => {
    if (!draft) return 'Chưa có cài đặt để lưu.'
    setSaving(true)
    try {
      const saved = await api.saveSettings(draft)
      setSettings(saved)
      setDraftState(saved)
      return ''
    } catch (e) {
      return `Không lưu được cài đặt: ${(e as Error).message}`
    } finally {
      setSaving(false)
    }
  }, [draft])

  const leaveSettings = () => {
    if (dirty) setConfirmLeave(true)
    else setScreen('results')
  }

  // Esc trong hộp hỏi = ở lại
  const stayRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!confirmLeave) return
    stayRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmLeave(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmLeave])

  if (error && !settings) return <div className="placeholder">Không khởi động được: {error}</div>
  if (!settings || !draft) return null

  const inSettings = screen === 'settings'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div className="brand-text">
            <span className="brand-name">{APP_NAME}</span>
            <span className="brand-sub">{APP_TAGLINE}</span>
          </div>
        </div>
        {inSettings && (
          <button type="button" className="btn back" onClick={leaveSettings}>
            <ArrowLeft />
            Quay lại Kết quả
          </button>
        )}
        <div className="topbar-right">
          <span className="source">
            <Globe />
            Nguồn: minhngoc.net.vn
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cài đặt"
            title={inSettings ? 'Đóng Cài đặt' : 'Cài đặt'}
            aria-pressed={inSettings}
            onClick={() => (inSettings ? leaveSettings() : setScreen('settings'))}
          >
            <Gear />
          </button>
        </div>
      </header>
      {!online && (
        <div className="netbar" role="status">
          <WifiOff size={16} />
          Mất kết nối mạng. Đang chờ kết nối lại…
        </div>
      )}

      {/* Giữ cả hai màn trong cây để không mất trạng thái khi chuyển qua lại */}
      <div className="screen" hidden={inSettings}>
        <ResultsScreen settings={settings} active={!inSettings} onResult={onResult} onSettingsChange={onQuickSettings} />
      </div>
      <div className="screen" hidden={!inSettings}>
        <SettingsScreen
          draft={draft}
          setDraft={setDraft}
          replaceDraft={setDraftState}
          dirty={dirty}
          saving={saving}
          onSave={save}
          lastResult={lastResult}
          version={version}
        />
      </div>

      {confirmLeave && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-desc">
            <h2 id="leave-title">Cài đặt chưa được lưu</h2>
            <p id="leave-desc">Bạn đã sửa cài đặt nhưng chưa bấm “Lưu cài đặt”. Muốn làm gì với các thay đổi này?</p>
            {leaveError && <p className="modal-error" role="alert">{leaveError}</p>}
            <div className="modal-actions">
              <button ref={stayRef} type="button" className="btn ghost" onClick={() => setConfirmLeave(false)}>Ở lại</button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setDraftState(settings)
                  setConfirmLeave(false)
                  setScreen('results')
                }}
              >
                Bỏ thay đổi
              </button>
              <button
                type="button"
                className="btn accent"
                disabled={saving}
                onClick={async () => {
                  const err = await save()
                  setLeaveError(err)
                  if (!err) {
                    setConfirmLeave(false)
                    setScreen('results')
                  }
                }}
              >
                Lưu rồi quay lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
