import { useCallback, useState } from 'react'
import type { DayResult } from '../../core/parse'
import type { LoadedResult } from '../../core/source'
import { ConfirmLeaveDialog } from './components/ConfirmLeaveDialog'
import { WifiOff } from './components/icons'
import { TopBar } from './components/TopBar'
import { useOnline } from './hooks'
import { ResultsScreen } from './screens/ResultsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { useSettingsDraft } from './useSettingsDraft'

type Screen = 'results' | 'settings'

export function App() {
  const { settings, draft, version, error, saving, dirty, setDraft, replaceDraft, discardDraft, applyQuick, save } =
    useSettingsDraft()
  const [screen, setScreen] = useState<Screen>('results')
  const [confirmLeave, setConfirmLeave] = useState(false)
  // Kết quả tải gần nhất: màn Cài đặt dùng để xem trước phiếu
  const [lastResult, setLastResult] = useState<DayResult | null>(null)
  const online = useOnline()

  const onResult = useCallback((r: LoadedResult) => {
    if (r.status === 'ok' || r.status === 'partial') setLastResult(r)
  }, [])

  const toResults = () => {
    setConfirmLeave(false)
    setScreen('results')
  }
  const leaveSettings = () => {
    if (dirty) setConfirmLeave(true)
    else setScreen('results')
  }
  const stay = useCallback(() => setConfirmLeave(false), [])

  if (error && !settings) return <div className="placeholder">Không khởi động được: {error}</div>
  if (!settings || !draft) return null

  const inSettings = screen === 'settings'

  return (
    <div className="app">
      <TopBar inSettings={inSettings} onBack={leaveSettings} onOpenSettings={() => setScreen('settings')} />
      {!online && (
        <div className="netbar" role="status">
          <WifiOff size={16} />
          Mất kết nối mạng. Đang chờ kết nối lại…
        </div>
      )}

      {/* Giữ cả hai màn trong cây để không mất trạng thái khi chuyển qua lại */}
      <div className="screen" hidden={inSettings}>
        <ResultsScreen settings={settings} active={!inSettings} onResult={onResult} onSettingsChange={applyQuick} />
      </div>
      <div className="screen" hidden={!inSettings}>
        <SettingsScreen
          draft={draft}
          setDraft={setDraft}
          replaceDraft={replaceDraft}
          dirty={dirty}
          saving={saving}
          onSave={save}
          lastResult={lastResult}
          version={version}
        />
      </div>

      {confirmLeave && (
        <ConfirmLeaveDialog
          saving={saving}
          onStay={stay}
          onDiscard={() => {
            discardDraft()
            toResults()
          }}
          onSave={async () => {
            const err = await save()
            if (!err) toResults()
            return err
          }}
        />
      )}
    </div>
  )
}
