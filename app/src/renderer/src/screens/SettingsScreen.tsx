import { useMemo } from 'react'
import { parseDate } from '../../../core/dates'
import type { DayResult } from '../../../core/parse'
import { renderHtml } from '../../../core/render-html'
import type { Settings } from '../../../core/settings'
import { buildSheet } from '../../../core/sheet'
import { measureFontScale } from '../fonts'
import { SAMPLE_DATE, SAMPLE_DAY } from '../sample'
import type { SetDraft } from '../useSettingsDraft'
import { AgentSection } from './settings/AgentSection'
import { OutputSection } from './settings/OutputSection'
import { PrinterSection } from './settings/PrinterSection'
import { PrintSection } from './settings/PrintSection'
import { SettingsBar } from './settings/SettingsBar'
import { SettingsCard, useCollapsedCards } from './settings/SettingsCard'
import { SettingsPreview } from './settings/SettingsPreview'
import { StationsSection } from './settings/StationsSection'

const CARD_IDS = ['h-daily', 'h-dai', 'h-in', 'h-mayin', 'h-luu'] as const

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
}

export function SettingsScreen(props: SettingsScreenProps) {
  const { draft, setDraft, replaceDraft, dirty, saving, onSave, lastResult, version } = props
  const cards = useCollapsedCards(CARD_IDS)
  const edit = { draft, setDraft }

  // Xem trước một phiếu theo bản nháp; các thẻ cũng đọc từ đây (dòng ngày mẫu, cỡ số đang dùng)
  const day = lastResult ?? SAMPLE_DAY
  const date = (lastResult && parseDate(lastResult.date)) || SAMPLE_DATE
  const sheet = useMemo(
    () => buildSheet(draft, day, { date, paper: draft.print.paper, blank: false, fontScale: measureFontScale(draft.print.font) }),
    [draft, day, date.y, date.m, date.d] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const html = useMemo(() => renderHtml(sheet.layout, { mode: 'card' }), [sheet])
  const l = sheet.layout

  return (
    <div className="settings">
      <div className="settings-main">
        <div className="settings-tools">
          <button type="button" className="btn ghost small-btn" onClick={() => cards.setAll(!cards.allCollapsed)}>
            {cards.allCollapsed ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
          </button>
        </div>
        <SettingsCard
          {...cards.card('h-daily')}
          title="Thông tin đại lý"
          desc="Các dòng in ở đầu mỗi phiếu. Bấm biểu tượng con mắt để hiện hoặc ẩn từng dòng, chỉnh cỡ chữ theo pt. Phần đầu phiếu cao lên thì bảng kết quả tự co lại cho vừa."
        >
          <AgentSection {...edit} dateLine={l.title} />
        </SettingsCard>

        <SettingsCard
          {...cards.card('h-dai')}
          title="Đài cần in"
          desc="Kéo thả để đổi thứ tự; thứ tự từ trái sang phải là thứ tự cột trên phiếu. Bỏ chọn hết các đài của một thứ thì ngày đó in đủ các đài."
        >
          <StationsSection {...edit} />
        </SettingsCard>

        <SettingsCard {...cards.card('h-in')} title="Bản in">
          <PrintSection {...edit} numberSizePt={l.table.numberSize / 2} />
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

      <SettingsPreview
        layout={l}
        html={html}
        autoNumberSize={draft.print.numberFontPt === null}
        resultDate={lastResult?.date ?? null}
      />

      <SettingsBar draft={draft} replaceDraft={replaceDraft} dirty={dirty} saving={saving} onSave={onSave} version={version} />
    </div>
  )
}
