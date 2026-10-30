import type { Settings } from '../../../../../core/settings'
import { PRIZE_LABEL, PRIZES, type PrizeKey } from '../../../../../core/stations'

/**
 * Các phần của phiếu trong trình sửa (tab Phiếu ở màn Cài đặt). Đầu phiếu gồm các nhóm Dòng 1–3,
 * mỗi nhóm in Label + Text liền một dòng. Dữ liệu hiện chỉ dòng tên có nhãn (header.label), nên
 * Dòng 2, Dòng 3 chỉ có Text.
 */
export type NodeId =
  | 'card'
  | 'head'
  | 'line1'
  | 'line1.label'
  | 'line1.text'
  | 'line2'
  | 'line2.text'
  | 'line3'
  | 'line3.text'
  | 'date'
  | 'table'
  | 'hdr'
  | 'labels'
  | 'numbers'
  | 'rows'
  | `prize-${PrizeKey}`

export const prizeNode = (k: PrizeKey): NodeId => `prize-${k}`
/** Hàng giải của phần trong cây (null nếu không phải một hàng giải). */
export const prizeOf = (id: NodeId | null): PrizeKey | null => (id?.startsWith('prize-') ? (id.slice(6) as PrizeKey) : null)

export type IconKey = 'receipt' | 'panelTop' | 'line' | 'type' | 'calendar' | 'table' | 'rows' | 'tag' | 'hash'

export interface TreeNode {
  id: NodeId
  name: string
  icon: IconKey
  children?: TreeNode[]
}

export const TREE: TreeNode = {
  id: 'card', name: 'Phiếu', icon: 'receipt', children: [
    {
      id: 'head', name: 'Đầu phiếu', icon: 'panelTop', children: [
        { id: 'line1', name: 'Dòng 1', icon: 'line', children: [
          { id: 'line1.label', name: 'Label', icon: 'type' },
          { id: 'line1.text', name: 'Text', icon: 'type' }
        ] },
        { id: 'line2', name: 'Dòng 2', icon: 'line', children: [{ id: 'line2.text', name: 'Text', icon: 'type' }] },
        { id: 'line3', name: 'Dòng 3', icon: 'line', children: [{ id: 'line3.text', name: 'Text', icon: 'type' }] },
        { id: 'date', name: 'Thứ, ngày', icon: 'calendar' }
      ]
    },
    {
      id: 'table', name: 'Bảng kết quả', icon: 'table', children: [
        { id: 'hdr', name: 'Hàng tiêu đề', icon: 'rows' },
        { id: 'labels', name: 'Tên giải', icon: 'tag' },
        { id: 'numbers', name: 'Số kết quả', icon: 'hash' },
        {
          id: 'rows', name: 'Hàng giải', icon: 'rows',
          children: PRIZES.map((k) => ({ id: prizeNode(k), name: `Giải ${PRIZE_LABEL[k]}`, icon: 'rows' as const }))
        }
      ]
    }
  ]
}

/** Tên hiện trên viền chọn và đầu cột Thuộc tính (Label / Text kèm tên nhóm cho rõ). */
export function nodeName(id: NodeId): string {
  const n = findNode(id)
  if (!n) return ''
  const dot = id.indexOf('.')
  return dot < 0 ? n.name : `${n.name} · ${findNode(id.slice(0, dot) as NodeId)?.name}`
}

export function findNode(id: NodeId, from: TreeNode = TREE): TreeNode | null {
  if (from.id === id) return from
  for (const c of from.children ?? []) {
    const f = findNode(id, c)
    if (f) return f
  }
  return null
}

/** Các phần theo thứ tự hiện trong cây (bỏ phần nằm trong nhóm đang thu gọn), kèm cấp thụt lề. */
export function visibleNodes(collapsed: ReadonlySet<NodeId>): { node: TreeNode; level: number }[] {
  const out: { node: TreeNode; level: number }[] = []
  const walk = (n: TreeNode, level: number) => {
    out.push({ node: n, level })
    if (!collapsed.has(n.id)) for (const c of n.children ?? []) walk(c, level + 1)
  }
  walk(TREE, 0)
  return out
}

/** Phần trên trang HTML (data-part của renderHtml parts) ứng với từng phần trong cây. */
const PART: Record<NodeId, string> = {
  card: 'card',
  head: 'line-*',
  line1: 'line-name',
  'line1.label': 'line-name',
  'line1.text': 'line-name',
  line2: 'line-addr',
  'line2.text': 'line-addr',
  line3: 'line-contact',
  'line3.text': 'line-contact',
  date: 'line-date',
  table: 'table',
  hdr: 'hdr',
  labels: 'labels',
  numbers: 'numbers',
  rows: 'row-*',
  ...(Object.fromEntries(PRIZES.map((k) => [prizeNode(k), `row-${k}`])) as Record<`prize-${PrizeKey}`, string>)
}

export const partOf = (id: NodeId | null): string | null => (id ? PART[id] : null)

/** Bấm trên phiếu: dòng đầu phiếu chọn cả nhóm Dòng, các phần khác chọn đúng phần đó. */
export function nodeOfPart(part: string): NodeId {
  const hit = (Object.keys(PART) as NodeId[]).find((id) => PART[id] === part && !id.includes('.'))
  return hit ?? 'card'
}

/** Khoá trong header của các dòng có con mắt ẩn/hiện. */
type ShowKey = 'label' | 'name' | 'addr' | 'contact'
const SHOW: Partial<Record<NodeId, ShowKey[]>> = {
  line1: ['label', 'name'],
  'line1.label': ['label'],
  'line1.text': ['name'],
  line2: ['addr'],
  'line2.text': ['addr'],
  line3: ['contact'],
  'line3.text': ['contact']
}

/** null = phần này không ẩn được; nhóm Dòng 1 hiện khi còn Label hoặc Text hiện. */
export function shownOf(d: Settings, id: NodeId): boolean | null {
  const keys = SHOW[id]
  return keys ? keys.some((k) => d.header[k].show) : null
}

/** Bật / tắt ẩn hiện; nhóm thì đổi cả Label lẫn Text. */
export function toggleShown(d: Settings, id: NodeId): void {
  const keys = SHOW[id]
  if (!keys) return
  const next = !keys.some((k) => d.header[k].show)
  for (const k of keys) d.header[k].show = next
}
