import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import {
  Chevron, IconCalendar, IconEye, IconEyeOff, IconHash, IconLine, IconLock, IconPanelTop, IconReceipt, IconRows,
  IconTable, IconTag, IconType
} from '../../../components/icons'
import type { DraftProps } from '../../../useSettingsDraft'
import { findNode, shownOf, toggleShown, visibleNodes, type IconKey, type NodeId } from './nodes'

const ICONS: Record<IconKey, () => ReactElement> = {
  receipt: IconReceipt, panelTop: IconPanelTop, line: IconLine, type: IconType, calendar: IconCalendar,
  table: IconTable, rows: IconRows, tag: IconTag, hash: IconHash
}

const parentOf = (id: NodeId): NodeId | null => {
  if (id === 'card') return null
  if (id.includes('.')) return id.slice(0, id.indexOf('.')) as NodeId
  if (id.startsWith('prize-')) return 'rows'
  if (id.startsWith('line') || id === 'date') return 'head'
  if (id === 'head' || id === 'table') return 'card'
  return 'table'
}

/** Cột trái tab Phiếu: cây các phần của phiếu, đồng bộ chọn / rê chuột với phiếu ở giữa. */
export function LayerTree(props: DraftProps & {
  selected: NodeId | null
  hovered: NodeId | null
  onSelect: (id: NodeId | null) => void
  onHover: (id: NodeId | null) => void
}) {
  const { draft, setDraft, selected, hovered, onSelect, onHover } = props
  // Hàng giải thu gọn sẵn cho cây gọn; chọn một hàng trên phiếu thì tự mở
  const [collapsed, setCollapsed] = useState<Set<NodeId>>(() => new Set<NodeId>(['rows']))
  const rows = visibleNodes(collapsed)
  const refs = useRef(new Map<NodeId, HTMLDivElement>())
  const focusSel = useRef(false)

  // Chọn trên phiếu mà phần đó đang nằm trong nhóm thu gọn: mở nhóm ra
  useEffect(() => {
    if (!selected) return
    let p = parentOf(selected)
    const closed: NodeId[] = []
    while (p) {
      if (collapsed.has(p)) closed.push(p)
      p = parentOf(p)
    }
    if (closed.length) setCollapsed((c) => new Set([...c].filter((x) => !closed.includes(x))))
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Đổi chọn bằng bàn phím thì đưa focus theo
  useEffect(() => {
    if (focusSel.current && selected) refs.current.get(selected)?.focus()
    focusSel.current = false
  }, [selected])

  const toggle = (id: NodeId, open?: boolean) =>
    setCollapsed((c) => {
      const next = new Set(c)
      if (open ?? next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onKey = (e: KeyboardEvent, id: NodeId) => {
    const i = rows.findIndex((r) => r.node.id === id)
    const node = findNode(id)
    let next: NodeId | null = null
    if (e.key === 'ArrowDown') next = rows[Math.min(rows.length - 1, i + 1)].node.id
    else if (e.key === 'ArrowUp') next = rows[Math.max(0, i - 1)].node.id
    else if (e.key === 'Home') next = rows[0].node.id
    else if (e.key === 'End') next = rows[rows.length - 1].node.id
    else if (e.key === 'ArrowRight' && node?.children) {
      if (collapsed.has(id)) toggle(id, true)
      else next = node.children[0].id
    } else if (e.key === 'ArrowLeft') {
      if (node?.children && !collapsed.has(id)) toggle(id, false)
      else next = parentOf(id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onSelect(null)
      return
    } else return
    e.preventDefault()
    if (next) {
      focusSel.current = true
      onSelect(next)
    }
  }

  const tabStop = selected && rows.some((r) => r.node.id === selected) ? selected : 'card'

  return (
    <div className="layers">
      <h2 id="h-layers" className="layers-title">Thành phần</h2>
      <div role="tree" aria-labelledby="h-layers" className="layer-list" onMouseLeave={() => onHover(null)}>
        {rows.map(({ node, level }) => {
          const Icon = ICONS[node.icon]
          const open = node.children ? !collapsed.has(node.id) : undefined
          const shown = shownOf(draft, node.id)
          const cls = ['layer']
          if (node.id === selected) cls.push('selected')
          else if (node.id === hovered) cls.push('hovered')
          if (shown === false) cls.push('is-hidden')
          const stop = (e: MouseEvent) => e.stopPropagation()
          return (
            <div
              key={node.id}
              ref={(el) => { if (el) refs.current.set(node.id, el); else refs.current.delete(node.id) }}
              role="treeitem"
              aria-level={level + 1}
              aria-selected={node.id === selected}
              aria-expanded={open}
              tabIndex={node.id === tabStop ? 0 : -1}
              className={cls.join(' ')}
              style={{ paddingLeft: 8 + 14 * level }}
              onClick={() => onSelect(node.id)}
              onMouseEnter={() => onHover(node.id)}
              onKeyDown={(e) => onKey(e, node.id)}
            >
              <span className="layer-arrow">
                {node.children && (
                  <button type="button" tabIndex={-1} aria-label={open ? 'Thu gọn' : 'Mở ra'} className={open ? '' : 'closed'}
                    onClick={(e) => { stop(e); toggle(node.id) }}>
                    <Chevron />
                  </button>
                )}
              </span>
              <span className="layer-icon"><Icon /></span>
              <span className="layer-name">{node.name}</span>
              {shown !== null && (
                <button type="button" tabIndex={-1} className="layer-tail"
                  aria-label={`${shown ? 'Ẩn' : 'Hiện'} ${node.name} trên phiếu`}
                  title={shown ? 'Đang hiện – bấm để ẩn' : 'Đang ẩn – bấm để hiện'}
                  onClick={(e) => { stop(e); setDraft((d) => toggleShown(d, node.id)) }}>
                  {shown ? <IconEye /> : <IconEyeOff />}
                </button>
              )}
              {node.id === 'date' && <span className="layer-tail fixed" title="Dòng thứ, ngày luôn in"><IconLock /></span>}
            </div>
          )
        })}
      </div>
      <p className="hint layers-foot">Bấm vào phiếu hoặc vào cây để chọn phần cần sửa. Esc để bỏ chọn.</p>
    </div>
  )
}
