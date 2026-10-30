import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeSettings, type Settings } from '../../core/settings'
import { api } from './api'

/**
 * Sửa bản nháp: hàm nhận một bản sao, cứ sửa thẳng trên đó. `step`: luôn là một bước hoàn tác riêng
 * (thêm / xoá / đổi thứ tự dòng, ẩn hiện…), không gộp với lần gõ ngay trước.
 */
export type SetDraft = (fn: (d: Settings) => void, opts?: { step?: boolean }) => void

/** Props chung của các phần trong màn Cài đặt. */
export interface DraftProps {
  draft: Settings
  setDraft: SetDraft
}

const same = (a: Settings, b: Settings) => JSON.stringify(normalizeSettings(a)) === JSON.stringify(normalizeSettings(b))

/** Sửa liền nhau trong khoảng này (gõ chữ, kéo số) tính là một bước hoàn tác. */
const MERGE_MS = 600
const HISTORY_MAX = 100

/** Bản nháp kèm lịch sử hoàn tác: past cũ → mới, future gần → xa. */
interface DraftState {
  cur: Settings | null
  past: Settings[]
  future: Settings[]
}

const fresh = (s: Settings | null): DraftState => ({ cur: s, past: [], future: [] })

/** Cài đặt đã lưu (màn Kết quả dùng) và bản nháp đang sửa ở màn Cài đặt. Nạp từ main lúc mở app. */
export function useSettingsDraft() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [state, setState] = useState<DraftState>(fresh(null))
  const [version, setVersion] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const lastEdit = useRef(0)
  const draft = state.cur

  useEffect(() => {
    api.init().then(
      (d) => {
        setSettings(d.settings)
        setState(fresh(d.settings))
        setVersion(d.version)
      },
      (e) => setError(String(e?.message ?? e))
    )
  }, [])

  /** Đổi bản nháp, ghi bản cũ vào lịch sử (gộp với bước trước nếu sửa liền tay). */
  const commit = useCallback((make: (prev: Settings) => Settings, mergeable: boolean) => {
    const now = Date.now()
    const merge = mergeable && now - lastEdit.current < MERGE_MS
    lastEdit.current = mergeable ? now : 0
    setState((s) => {
      if (!s.cur) return s
      const next = make(s.cur)
      const past = merge && s.past.length ? s.past : [...s.past, s.cur].slice(-HISTORY_MAX)
      return { cur: next, past, future: [] }
    })
  }, [])

  const setDraft: SetDraft = useCallback(
    (fn, opts) =>
      commit((prev) => {
        const next = structuredClone(prev)
        fn(next)
        return next
      }, !opts?.step),
    [commit]
  )

  const replaceDraft = useCallback((s: Settings) => commit(() => s, false), [commit])
  const discardDraft = useCallback(() => setState(fresh(settings)), [settings])

  const undo = useCallback(() => {
    lastEdit.current = 0
    setState((s) => (s.cur && s.past.length ? { cur: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.cur, ...s.future] } : s))
  }, [])
  const redo = useCallback(() => {
    lastEdit.current = 0
    setState((s) => (s.cur && s.future.length ? { cur: s.future[0], past: [...s.past, s.cur], future: s.future.slice(1) } : s))
  }, [])

  // Máy in / thư mục lưu đổi ở màn Kết quả: đã lưu ngay, cập nhật luôn bản nháp (và lịch sử, để hoàn tác không lấy lại máy in cũ)
  const applyQuick = useCallback((s: Settings) => {
    setSettings(s)
    const patch = (d: Settings): Settings => ({ ...d, printer: s.printer, output: s.output })
    setState((st) => (st.cur ? { cur: patch(st.cur), past: st.past.map(patch), future: st.future.map(patch) } : fresh(s)))
  }, [])

  const dirty = useMemo(() => !!settings && !!draft && !same(settings, draft), [settings, draft])

  /** Trả chuỗi lỗi, rỗng nếu lưu được. */
  const save = useCallback(async (): Promise<string> => {
    if (!draft) return 'Chưa có cài đặt để lưu.'
    setSaving(true)
    try {
      const saved = await api.saveSettings(draft)
      setSettings(saved)
      setState(fresh(saved))
      return ''
    } catch (e) {
      return `Không lưu được cài đặt: ${(e as Error).message}`
    } finally {
      setSaving(false)
    }
  }, [draft])

  const history = { canUndo: state.past.length > 0, canRedo: state.future.length > 0, undo, redo }

  return { settings, draft, version, error, saving, dirty, setDraft, replaceDraft, discardDraft, applyQuick, save, history }
}

export type DraftHistory = ReturnType<typeof useSettingsDraft>['history']
