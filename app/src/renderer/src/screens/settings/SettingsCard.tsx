import { useState, type ReactNode } from 'react'
import { Chevron } from '../../components/icons'

/** Thẻ cài đặt thu gọn / mở rộng được: bấm tiêu đề (hoặc Tab + Enter) để đổi. */
export function SettingsCard(props: {
  id: string
  title: string
  desc?: string
  badge?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { id, title, desc, badge, open, onToggle, children } = props
  return (
    <section className={`card set-card${open ? '' : ' collapsed'}`} aria-labelledby={id}>
      <h2 className="set-h2">
        <button type="button" className="set-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <Chevron />
          <span id={id}>{title}</span>
          {badge && <span className="badge">{badge}</span>}
        </button>
      </h2>
      <div id={`${id}-body`} className="set-body" hidden={!open}>
        {desc && <p className="set-desc">{desc}</p>}
        {children}
      </div>
    </section>
  )
}

const COLLAPSED_KEY = 'xsmn.settings.collapsed'

/** Thẻ nào đang thu gọn; nhớ trong máy cho lần mở sau (lỗi bộ nhớ thì coi như mở hết). */
export function useCollapsedCards<Id extends string>(ids: readonly Id[]) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'))
    } catch {
      return new Set()
    }
  })
  /** Cập nhật từ trạng thái mới nhất (bấm nhanh nhiều thẻ liền nhau không ghi đè nhau) rồi lưu lại. */
  const update = (fn: (prev: Set<string>) => Set<string>) =>
    setCollapsed((prev) => {
      const next = fn(prev)
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      } catch {
        // không lưu được thì thôi, chỉ mất trạng thái lần sau
      }
      return next
    })
  const toggle = (id: Id) =>
    update((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return {
    card: (id: Id) => ({ id, open: !collapsed.has(id), onToggle: () => toggle(id) }),
    // So từng thẻ, không so số lượng: bộ nhớ còn id của thẻ cũ đã bỏ thì vẫn đúng
    allCollapsed: ids.every((id) => collapsed.has(id)),
    setAll: (collapse: boolean) => update(() => new Set<string>(collapse ? ids : []))
  }
}
