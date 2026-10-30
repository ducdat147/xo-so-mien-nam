import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import {
  Chevron, IconCalendar, IconEye, IconEyeOff, IconHash, IconLine, IconLock, IconPanelBottom, IconPanelTop, IconPlus,
  IconReceipt, IconRows, IconTable, IconTag, IconType
} from '../../../components/icons'
import type { DraftProps } from '../../../useSettingsDraft'
import {
  addFreeLine, canAddLine, lineIndex, lineOf, moveLine, parentMap, removeFreeLine, shownOf, toggleShown, visibleNodes,
  type IconKey, type NodeId, type TreeNode
} from './nodes'

/** Thêm / xoá / đổi thứ tự / ẩn hiện: mỗi lần là một bước hoàn tác riêng. */
const STEP = { step: true }

const ICONS: Record<IconKey, () => ReactElement> = {
  receipt: IconReceipt, panelTop: IconPanelTop, panelBottom: IconPanelBottom, line: IconLine, type: IconType,
  calendar: IconCalendar, table: IconTable, rows: IconRows, tag: IconTag, hash: IconHash
}

/**
 * Cột trái tab Phiếu: cây các phần của phiếu, đồng bộ chọn / rê chuột với phiếu ở giữa. Nhóm Dòng kéo
 * thả (hoặc Alt + ↑/↓) để đổi thứ tự trong phần của nó; dấu + thêm dòng tự do, Delete xoá dòng tự do.
 */
export function LayerTree(props: DraftProps & {
  tree: TreeNode
  selected: NodeId | null
  hovered: NodeId | null
  onSelect: (id: NodeId | null) => void
  onHover: (id: NodeId | null) => void
}) {
  const { draft, setDraft, tree, selected, hovered, onSelect, onHover } = props
  // Hàng giải thu gọn sẵn cho cây gọn; chọn một hàng trên phiếu thì tự mở
  const [collapsed, setCollapsed] = useState<Set<NodeId>>(() => new Set<NodeId>(['rows']))
  const rows = visibleNodes(tree, collapsed)
  const parents = useMemo(() => parentMap(tree), [tree])
  const refs = useRef(new Map<NodeId, HTMLDivElement>())
  const focusSel = useRef(false)
  const [drag, setDrag] = useState<{ id: NodeId; over: NodeId | null } | null>(null)

  // Chọn trên phiếu mà phần đó đang nằm trong nhóm thu gọn: mở nhóm ra
  useEffect(() => {
    if (!selected) return
    const closed: NodeId[] = []
    for (let p = parents.get(selected); p; p = parents.get(p)) if (collapsed.has(p)) closed.push(p)
    if (closed.length) setCollapsed((c) => new Set([...c].filter((x) => !closed.includes(x))))
  }, [selected, parents]) // eslint-disable-line react-hooks/exhaustive-deps

  // Đổi chọn bằng bàn phím thì đưa focus theo
  useEffect(() => {
    if (focusSel.current && selected) refs.current.get(selected)?.focus()
    focusSel.current = false
  }, [selected, tree])

  const toggle = (id: NodeId, open?: boolean) =>
    setCollapsed((c) => {
      const next = new Set(c)
      if (open ?? next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const select = (id: NodeId | null) => {
    focusSel.current = true
    onSelect(id)
  }
  const add = (section: 'head' | 'foot') => {
    // Tính id mới trên bản hiện tại (cùng cách addFreeLine chọn id), rồi thêm vào bản nháp
    const probe = structuredClone(draft)
    const id = addFreeLine(probe, section)
    if (!id) return
    setDraft((d) => { addFreeLine(d, section) }, STEP)
    setCollapsed((c) => new Set([...c].filter((x) => x !== section)))
    select(`${id}.text`)
  }
  const remove = (node: TreeNode) => {
    const l = lineOf(node.id)
    if (!l || !node.free) return
    setDraft((d) => removeFreeLine(d, l.line), STEP)
    select(parents.get(node.id) ?? null)
  }
  const move = (node: TreeNode, dir: -1 | 1) => {
    const l = lineOf(node.id)
    if (!l) return
    setDraft((d) => moveLine(d, l.line, lineIndex(d, l.line) + dir), STEP)
    select(node.id)
  }

  const onKey = (e: KeyboardEvent, node: TreeNode) => {
    const id = node.id
    const i = rows.findIndex((r) => r.node.id === id)
    let next: NodeId | null = null
    if (e.altKey && node.section && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      return move(node, e.key === 'ArrowUp' ? -1 : 1)
    }
    if (e.key === 'ArrowDown') next = rows[Math.min(rows.length - 1, i + 1)].node.id
    else if (e.key === 'ArrowUp') next = rows[Math.max(0, i - 1)].node.id
    else if (e.key === 'Home') next = rows[0].node.id
    else if (e.key === 'End') next = rows[rows.length - 1].node.id
    else if (e.key === 'ArrowRight' && node.children?.length) {
      if (collapsed.has(id)) toggle(id, true)
      else next = node.children[0].id
    } else if (e.key === 'ArrowLeft') {
      if (node.children?.length && !collapsed.has(id)) toggle(id, false)
      else next = parents.get(id) ?? null
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && node.free) {
      e.preventDefault()
      return remove(node)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onSelect(null)
      return
    } else return
    e.preventDefault()
    if (next) select(next)
  }

  // Kéo thả nhóm Dòng: chỉ thả được lên nhóm cùng phần (đầu hoặc cuối phiếu)
  const sectionOf = (id: NodeId) => rows.find((r) => r.node.id === id)?.node.section
  const onDragOver = (e: DragEvent, node: TreeNode) => {
    if (!drag || drag.id === node.id || !node.section || sectionOf(drag.id) !== node.section) return
    e.preventDefault()
    if (drag.over !== node.id) setDrag({ ...drag, over: node.id })
  }
  const onDrop = (e: DragEvent, node: TreeNode) => {
    e.preventDefault()
    const from = drag && lineOf(drag.id)
    const to = lineOf(node.id)
    setDrag(null)
    if (!from || !to || from.line === to.line) return
    setDraft((d) => moveLine(d, from.line, lineIndex(d, to.line)), STEP)
  }

  const tabStop = selected && rows.some((r) => r.node.id === selected) ? selected : 'card'
  const footEmpty = !tree.children?.find((c) => c.id === 'foot')?.children?.length

  return (
    <div className="layers">
      <h2 id="h-layers" className="layers-title">Thành phần</h2>
      <div role="tree" aria-labelledby="h-layers" className="layer-list" onMouseLeave={() => onHover(null)}>
        {rows.map(({ node, level }) => {
          const Icon = ICONS[node.icon]
          const expandable = !!node.children?.length
          const open = expandable ? !collapsed.has(node.id) : undefined
          const shown = shownOf(draft, node.id)
          const section = node.id === 'head' || node.id === 'foot' ? node.id : null
          const cls = ['layer']
          if (node.id === selected) cls.push('selected')
          else if (node.id === hovered) cls.push('hovered')
          if (shown === false) cls.push('is-hidden')
          if (drag?.id === node.id) cls.push('dragging')
          if (drag?.over === node.id) cls.push('drop-over')
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
              title={node.section ? 'Kéo để đổi thứ tự (hoặc Alt + ↑/↓)' : undefined}
              draggable={!!node.section}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ id: node.id, over: null }) }}
              onDragEnd={() => setDrag(null)}
              onDragOver={(e) => onDragOver(e, node)}
              onDrop={(e) => onDrop(e, node)}
              onClick={() => onSelect(node.id)}
              onMouseEnter={() => onHover(node.id)}
              onKeyDown={(e) => onKey(e, node)}
            >
              <span className="layer-arrow">
                {expandable && (
                  <button type="button" tabIndex={-1} aria-label={open ? 'Thu gọn' : 'Mở ra'} className={open ? '' : 'closed'}
                    onClick={(e) => { stop(e); toggle(node.id) }}>
                    <Chevron />
                  </button>
                )}
              </span>
              <span className="layer-icon"><Icon /></span>
              <span className="layer-name">{node.name}</span>
              {section && (
                <button type="button" tabIndex={-1} className="layer-tail" disabled={!canAddLine(draft, section)}
                  aria-label={`Thêm dòng tự do vào ${node.name}`}
                  title={canAddLine(draft, section) ? 'Thêm dòng tự do' : 'Mỗi phần tối đa 5 dòng tự do'}
                  onClick={(e) => { stop(e); add(section) }}>
                  <IconPlus />
                </button>
              )}
              {shown !== null && (
                <button type="button" tabIndex={-1} className="layer-tail"
                  aria-label={`${shown ? 'Ẩn' : 'Hiện'} ${node.name} trên phiếu`}
                  title={shown ? 'Đang hiện – bấm để ẩn' : 'Đang ẩn – bấm để hiện'}
                  onClick={(e) => { stop(e); setDraft((d) => toggleShown(d, node.id), STEP) }}>
                  {shown ? <IconEye /> : <IconEyeOff />}
                </button>
              )}
              {node.id === 'date' && <span className="layer-tail fixed" title="Dòng thứ, ngày luôn in"><IconLock /></span>}
            </div>
          )
        })}
        {footEmpty && <p className="hint layer-empty">Bấm + ở Cuối phiếu để thêm dòng dưới bảng.</p>}
      </div>
      <p className="hint layers-foot">Bấm vào phiếu hoặc vào cây để chọn phần cần sửa. Kéo nhóm Dòng để đổi thứ tự. Esc để bỏ chọn.</p>
    </div>
  )
}
