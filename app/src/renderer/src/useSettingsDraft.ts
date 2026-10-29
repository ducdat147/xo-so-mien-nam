import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeSettings, type Settings } from '../../core/settings'
import { api } from './api'

/** Sửa bản nháp: hàm nhận một bản sao, cứ sửa thẳng trên đó. */
export type SetDraft = (fn: (d: Settings) => void) => void

/** Props chung của các phần trong màn Cài đặt. */
export interface DraftProps {
  draft: Settings
  setDraft: SetDraft
}

const same = (a: Settings, b: Settings) => JSON.stringify(normalizeSettings(a)) === JSON.stringify(normalizeSettings(b))

/** Cài đặt đã lưu (màn Kết quả dùng) và bản nháp đang sửa ở màn Cài đặt. Nạp từ main lúc mở app. */
export function useSettingsDraft() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraftState] = useState<Settings | null>(null)
  const [version, setVersion] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

  const setDraft: SetDraft = useCallback((fn) => {
    setDraftState((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])

  const replaceDraft = useCallback((s: Settings) => setDraftState(s), [])
  const discardDraft = useCallback(() => setDraftState(settings), [settings])

  // Máy in / thư mục lưu đổi ở màn Kết quả: đã lưu ngay, cập nhật luôn bản nháp ở màn Cài đặt
  const applyQuick = useCallback((s: Settings) => {
    setSettings(s)
    setDraftState((d) => (d ? { ...d, printer: s.printer, output: s.output } : s))
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

  return { settings, draft, version, error, saving, dirty, setDraft, replaceDraft, discardDraft, applyQuick, save }
}
