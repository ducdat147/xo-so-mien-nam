import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { parseDate } from '../../../core/dates'
import { TWIPS_PER_CM, viNumber } from '../../../core/layout'
import type { DayResult } from '../../../core/parse'
import { renderHtml } from '../../../core/render-html'
import type { Settings } from '../../../core/settings'
import { buildSheet } from '../../../core/sheet'
import { PRIZES, type PrizeKey } from '../../../core/stations'
import { IconRedo, IconUndo } from '../components/icons'
import { SheetPreview } from '../components/SheetPreview'
import { measureFontScale } from '../fonts'
import { SAMPLE_DATE, SAMPLE_DAY } from '../sample'
import type { DraftHistory, SetDraft } from '../useSettingsDraft'
import { Inspector } from './settings/editor/Inspector'
import { LayerTree } from './settings/editor/LayerTree'
import { buildTree, findNode, nodeName, nodeOfPart, partOf, type NodeId } from './settings/editor/nodes'
import { OutputSection } from './settings/OutputSection'
import { PrinterSection } from './settings/PrinterSection'
import { SettingsBar } from './settings/SettingsBar'
import { SettingsCard, useCollapsedCards } from './settings/SettingsCard'
import { StationsSection } from './settings/StationsSection'

const CARD_IDS = ['h-dai', 'h-mayin', 'h-luu'] as const

type Tab = 'card' | 'general'
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'card', label: 'Phiếu' },
  { id: 'general', label: 'Chung' }
]
const TAB_KEY = 'xsmn.settings.tab'

export interface SettingsScreenProps {
  draft: Settings
  setDraft: SetDraft
  replaceDraft: (s: Settings) => void
  dirty: boolean
  saving: boolean
  /** Trả chuỗi lỗi, rỗng nếu lưu được. */
  onSave: () => Promise<string>
  /** Kết quả tải gần nhất (đủ hoặc đang quay); null = dùng dữ liệu mẫu. */
  lastResult: DayResult | null
  /** Phiên bản app (package.json). */
  version: string
  history: DraftHistory
  /** Màn đang mở và không có hộp hỏi: mới nhận phím tắt hoàn tác. */
  active: boolean
}

/** Gõ trong ô nhập thì để phím tắt cho ô nhập. */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

export function SettingsScreen(props: SettingsScreenProps) {
  const { draft, setDraft, replaceDraft, dirty, saving, onSave, version, history, active } = props
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return localStorage.getItem(TAB_KEY) === 'general' ? 'general' : 'card'
    } catch {
      return 'card'
    }
  })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const openTab = (t: Tab) => {
    setTab(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      // không nhớ được tab thì lần sau mở tab Phiếu
    }
  }
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + TABS.length) % TABS.length
    openTab(TABS[n].id)
    tabRefs.current[n]?.focus()
  }

  // Ctrl/⌘+Z hoàn tác, Ctrl/⌘+Shift+Z hoặc Ctrl+Y làm lại
  const historyRef = useRef(history)
  historyRef.current = history
  useEffect(() => {
    if (!active) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || typing(e.target)) return
      const k = e.key.toLowerCase()
      const h = historyRef.current
      if (k === 'z' && !e.shiftKey) h.undo()
      else if ((k === 'z' && e.shiftKey) || k === 'y') h.redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  return (
    <div className="settings">
      <div className="settings-tabs">
        <div role="tablist" aria-label="Phần cài đặt" className="tabs">
          {TABS.map((t, i) => (
            <button key={t.id} ref={(el) => { tabRefs.current[i] = el }} type="button" role="tab" id={`tab-${t.id}`}
              aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
              onClick={() => openTab(t.id)} onKeyDown={(e) => onTabKey(e, i)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="history" role="group" aria-label="Hoàn tác">
          <button type="button" className="icon-btn small tip" onClick={history.undo} disabled={!history.canUndo}
            aria-label="Hoàn tác" data-tip="Hoàn tác (Ctrl+Z)"><IconUndo /></button>
          <button type="button" className="icon-btn small tip" onClick={history.redo} disabled={!history.canRedo}
            aria-label="Làm lại" data-tip="Làm lại (Ctrl+Shift+Z)"><IconRedo /></button>
        </div>
      </div>

      <div role="tabpanel" id="panel-card" aria-labelledby="tab-card" className="settings-panel" hidden={tab !== 'card'}>
        <CardEditor {...props} />
      </div>
      <div role="tabpanel" id="panel-general" aria-labelledby="tab-general" className="settings-panel general" hidden={tab !== 'general'}>
        <GeneralTab draft={draft} setDraft={setDraft} />
      </div>

      <SettingsBar draft={draft} replaceDraft={replaceDraft} dirty={dirty} saving={saving} onSave={onSave} version={version} />
    </div>
  )
}

/** Tab Phiếu: cây thành phần | phiếu bấm chọn được | thuộc tính phần đang chọn. */
function CardEditor(props: SettingsScreenProps) {
  const { draft, setDraft, lastResult, active } = props
  const [selected, setSelected] = useState<NodeId | null>(null)
  const [hovered, setHovered] = useState<NodeId | null>(null)
  const edit = { draft, setDraft }

  // Xem trước một phiếu theo bản nháp; cột Thuộc tính cũng đọc từ đây (dòng ngày, cỡ số, các đài)
  const day = lastResult ?? SAMPLE_DAY
  const date = (lastResult && parseDate(lastResult.date)) || SAMPLE_DATE
  const sheet = useMemo(
    () => buildSheet(draft, day, { date, paper: draft.print.paper, blank: false, fontScale: measureFontScale(draft.print.font) }),
    [draft, day, date.y, date.m, date.d] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const html = useMemo(() => renderHtml(sheet.layout, { mode: 'card', parts: true }), [sheet])
  const l = sheet.layout
  const numberSizePt = l.table.numberSize / 2
  const tree = useMemo(() => buildTree(draft), [draft])
  // Phần đang chọn không còn (xoá dòng tự do, hoàn tác): bỏ chọn
  useEffect(() => {
    if (selected && !findNode(tree, selected)) setSelected(null)
    if (hovered && !findNode(tree, hovered)) setHovered(null)
  }, [tree]) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc (ngoài ô nhập) bỏ chọn, như bấm ra nền
  useEffect(() => {
    if (!active) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !typing(e.target)) setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  return (
    <div className="editor">
      <LayerTree {...edit} tree={tree} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
      <div className="editor-canvas">
        <SheetPreview
          html={html}
          width={l.cardW / 15}
          height={l.cardH / 15}
          label="Phiếu đang sửa"
          pad={24}
          pick={{
            selected: partOf(draft, selected),
            hovered: partOf(draft, hovered),
            label: selected ? nodeName(tree, selected) : '',
            onPick: (part) => setSelected(part ? nodeOfPart(part) : null),
            onHover: (part) => setHovered(part ? nodeOfPart(part) : null)
          }}
        />
        <p className="hint editor-caption">
          Khổ {l.paper} · phiếu {viNumber(l.cardW / TWIPS_PER_CM)} × {viNumber(l.cardH / TWIPS_PER_CM)} cm · cỡ số{' '}
          {viNumber(numberSizePt)} pt{draft.print.numberFontPt === null ? ' (tự chỉnh để vừa phiếu)' : ''} ·{' '}
          {lastResult ? `số ngày ${lastResult.date}` : `số mẫu ngày ${SAMPLE_DAY.date}`}
        </p>
        {l.warnings.length > 0 && <ul className="warnings editor-caption">{l.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      </div>
      <Inspector {...edit} tree={tree} onSelect={setSelected} selected={selected} numberSizePt={numberSizePt} dateLine={l.title} stations={sheet.stations}
        rowSizePt={Object.fromEntries(PRIZES.map((k) => [k, l.table.prizeRows[k].size / 2])) as Record<PrizeKey, number>} />
    </div>
  )
}

/** Tab Chung: những gì không thuộc phiếu. */
function GeneralTab(edit: { draft: Settings; setDraft: SetDraft }) {
  const cards = useCollapsedCards(CARD_IDS)
  return (
    <div className="general-col">
      <div className="settings-tools">
        <button type="button" className="btn ghost small-btn" onClick={() => cards.setAll(!cards.allCollapsed)}>
          {cards.allCollapsed ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
        </button>
      </div>
      <SettingsCard
        {...cards.card('h-dai')}
        title="Đài cần in"
        desc="Kéo thả để đổi thứ tự; thứ tự từ trái sang phải là thứ tự cột trên phiếu. Bỏ chọn hết các đài của một thứ thì ngày đó in đủ các đài."
      >
        <StationsSection {...edit} />
      </SettingsCard>
      <SettingsCard
        {...cards.card('h-mayin')}
        title="Máy in"
        desc="Lựa chọn mặc định cho nhóm In phiếu ở màn Kết quả. Chọn máy in ở màn Kết quả cũng được lưu lại. Mặc định bấm In sẽ mở bước xem trước khi in."
      >
        <PrinterSection {...edit} />
      </SettingsCard>
      <SettingsCard {...cards.card('h-luu')} title="Lưu file">
        <OutputSection {...edit} />
      </SettingsCard>
    </div>
  )
}
