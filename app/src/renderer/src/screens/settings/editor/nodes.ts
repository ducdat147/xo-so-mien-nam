import type { Settings } from '../../../../../core/settings'
import { FREE_LINES_MAX, lineParts, newFreeLine } from '../../../../../core/settings'
import { PRIZE_LABEL, PRIZES, type PrizeKey } from '../../../../../core/stations'

/**
 * Các phần của phiếu trong trình sửa (tab Phiếu ở màn Cài đặt). Mỗi dòng chữ (đầu hoặc cuối phiếu)
 * là một nhóm `line:<id>` gồm `line:<id>.label` và `line:<id>.text`; id là "name" | "addr" | "contact"
 * (dòng có sẵn) hoặc id dòng tự do. Phần còn lại có id cố định.
 */
export type NodeId = string

export type IconKey = 'receipt' | 'panelTop' | 'panelBottom' | 'line' | 'type' | 'calendar' | 'table' | 'rows' | 'tag' | 'hash'

export interface TreeNode {
  id: NodeId
  name: string
  icon: IconKey
  children?: TreeNode[]
  /** Nhóm dòng kéo đổi thứ tự được trong phần của nó. */
  section?: 'head' | 'foot'
  /** Dòng tự do (xoá được). */
  free?: boolean
}

export const prizeNode = (k: PrizeKey): NodeId => `prize-${k}`
/** Hàng giải của phần trong cây (null nếu không phải một hàng giải). */
export const prizeOf = (id: NodeId | null): PrizeKey | null => (id?.startsWith('prize-') ? (id.slice(6) as PrizeKey) : null)

/** Phần trong cây thuộc dòng chữ nào: id dòng và Label / Text (null = cả nhóm). */
export function lineOf(id: NodeId | null): { line: string; part: 'label' | 'text' | null } | null {
  const m = id?.match(/^line:([^.]+)(?:\.(label|text))?$/)
  return m ? { line: m[1], part: (m[2] as 'label' | 'text' | undefined) ?? null } : null
}

const isFooter = (d: Settings, line: string) => d.header.footer.some((f) => f.id === line)
const isFree = (d: Settings, line: string) => isFooter(d, line) || d.header.extra.some((f) => f.id === line)

/** Cây theo dữ liệu đang sửa: Dòng 1…n theo thứ tự in, Dòng cuối 1…n dưới bảng. */
export function buildTree(d: Settings): TreeNode {
  const group = (line: string, name: string, section: 'head' | 'foot'): TreeNode => ({
    id: `line:${line}`, name, icon: 'line', section, free: isFree(d, line),
    children: [
      { id: `line:${line}.label`, name: 'Label', icon: 'type' },
      { id: `line:${line}.text`, name: 'Text', icon: 'type' }
    ]
  })
  return {
    id: 'card', name: 'Phiếu', icon: 'receipt', children: [
      {
        id: 'head', name: 'Đầu phiếu', icon: 'panelTop', children: [
          ...d.header.order.map((line, i) => group(line, `Dòng ${i + 1}`, 'head')),
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
      },
      { id: 'foot', name: 'Cuối phiếu', icon: 'panelBottom', children: d.header.footer.map((f, i) => group(f.id, `Dòng cuối ${i + 1}`, 'foot')) }
    ]
  }
}

export function findNode(tree: TreeNode, id: NodeId): TreeNode | null {
  if (tree.id === id) return tree
  for (const c of tree.children ?? []) {
    const f = findNode(c, id)
    if (f) return f
  }
  return null
}

/** Nhóm cha của từng phần. */
export function parentMap(tree: TreeNode): Map<NodeId, NodeId> {
  const out = new Map<NodeId, NodeId>()
  const walk = (n: TreeNode) => {
    for (const c of n.children ?? []) {
      out.set(c.id, n.id)
      walk(c)
    }
  }
  walk(tree)
  return out
}

/** Tên hiện trên viền chọn: Label / Text kèm tên nhóm cho rõ. */
export function nodeName(tree: TreeNode, id: NodeId): string {
  const n = findNode(tree, id)
  const l = lineOf(id)
  if (!n || !l?.part) return n?.name ?? ''
  return `${n.name} · ${findNode(tree, `line:${l.line}`)?.name ?? ''}`
}

/** Các phần theo thứ tự hiện trong cây (bỏ phần nằm trong nhóm đang thu gọn), kèm cấp thụt lề. */
export function visibleNodes(tree: TreeNode, collapsed: ReadonlySet<NodeId>): { node: TreeNode; level: number }[] {
  const out: { node: TreeNode; level: number }[] = []
  const walk = (n: TreeNode, level: number) => {
    out.push({ node: n, level })
    if (!collapsed.has(n.id)) for (const c of n.children ?? []) walk(c, level + 1)
  }
  walk(tree, 0)
  return out
}

/** Phần trên trang HTML (data-part của renderHtml parts) ứng với từng phần trong cây; "x-*" khớp mọi "x-…". */
export function partOf(d: Settings, id: NodeId | null): string | null {
  if (!id) return null
  const l = lineOf(id)
  if (l) return `${isFooter(d, l.line) ? 'foot' : 'line'}-${l.line}`
  const k = prizeOf(id)
  if (k) return `row-${k}`
  return { head: 'line-*', foot: 'foot-*', date: 'line-date', rows: 'row-*' }[id] ?? id
}

/** Bấm trên phiếu: dòng chữ chọn cả nhóm Dòng, các phần khác chọn đúng phần đó. */
export function nodeOfPart(part: string): NodeId {
  if (part === 'line-date') return 'date'
  const m = part.match(/^(?:line|foot)-(.+)$/)
  if (m) return `line:${m[1]}`
  if (part.startsWith('row-')) return prizeNode(part.slice(4) as PrizeKey)
  return part
}

/** null = phần này không ẩn được; nhóm Dòng hiện khi còn Label hoặc Text hiện. */
export function shownOf(d: Settings, id: NodeId): boolean | null {
  const l = lineOf(id)
  const p = l && lineParts(d.header, l.line)
  if (!l || !p) return null
  return l.part ? p[l.part].show : p.label.show || p.text.show
}

/** Bật / tắt ẩn hiện; nhóm thì đổi cả Label lẫn Text. */
export function toggleShown(d: Settings, id: NodeId): void {
  const l = lineOf(id)
  const p = l && lineParts(d.header, l.line)
  if (!l || !p) return
  const parts = l.part ? [p[l.part]] : [p.label, p.text]
  const next = !parts.some((t) => t.show)
  for (const t of parts) t.show = next
}

/** Còn thêm được dòng tự do vào phần này không. */
export const canAddLine = (d: Settings, section: 'head' | 'foot') =>
  (section === 'head' ? d.header.extra : d.header.footer).length < FREE_LINES_MAX

/** Thêm dòng tự do vào cuối phần (đầu: trước Thứ, ngày); trả id nhóm mới. */
export function addFreeLine(d: Settings, section: 'head' | 'foot'): NodeId | null {
  if (!canAddLine(d, section)) return null
  const used = new Set([...d.header.extra, ...d.header.footer].map((f) => f.id))
  let n = 1
  while (used.has(`${section === 'head' ? 'h' : 'f'}${n}`)) n++
  const id = `${section === 'head' ? 'h' : 'f'}${n}`
  if (section === 'head') {
    d.header.extra.push(newFreeLine(id))
    d.header.order.push(id)
  } else {
    d.header.footer.push(newFreeLine(id))
  }
  return `line:${id}`
}

export function removeFreeLine(d: Settings, line: string): void {
  d.header.extra = d.header.extra.filter((f) => f.id !== line)
  d.header.order = d.header.order.filter((id) => id !== line)
  d.header.footer = d.header.footer.filter((f) => f.id !== line)
}

/** Đưa dòng `line` tới vị trí `index` trong phần của nó (đầu: thứ tự in; cuối: danh sách dòng cuối). */
export function moveLine(d: Settings, line: string, index: number): void {
  const move = <T,>(list: T[], at: number) => {
    const [x] = list.splice(at, 1)
    list.splice(Math.max(0, Math.min(list.length, index)), 0, x)
  }
  const i = d.header.order.indexOf(line)
  if (i >= 0) return move(d.header.order, i)
  const j = d.header.footer.findIndex((f) => f.id === line)
  if (j >= 0) move(d.header.footer, j)
}

/** Vị trí hiện tại của dòng trong phần của nó. */
export function lineIndex(d: Settings, line: string): number {
  const i = d.header.order.indexOf(line)
  return i >= 0 ? i : d.header.footer.findIndex((f) => f.id === line)
}
