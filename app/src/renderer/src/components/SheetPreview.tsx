import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'

const PAD = 28
/** Thanh phóng to nằm cách mép trên / phải của khung (khớp .zoombar trong CSS). */
const BAR_INSET = 10
const BAR_GAP = 8
/** Cỡ "vừa khung" không phóng quá mức này (khổ nhỏ như một phiếu sẽ to quá). */
const FIT_MAX = 1.6
const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]

const clamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v))

/**
 * Hiện trang HTML in (render-html) trong một iframe, thu nhỏ cho vừa khung, phóng to được.
 * width/height: kích thước thật của tài liệu, tính bằng CSS px (96 dpi; 100% = cỡ thật).
 *
 * Không dùng srcdoc: mỗi lần đổi nội dung là nạp lại trang, khung trắng một nhịp. iframe chỉ
 * `allow-same-origin` (không cho script) nên chạy chung tiến trình với giao diện; nội dung mới
 * được ghi thẳng vào document của iframe, hình cũ giữ nguyên tới khi hình mới vẽ xong.
 * (sandbox="" khiến Chromium tách iframe sang tiến trình riêng và có lúc không vẽ lại → trắng.)
 *
 * Phóng to: nút − / + / Vừa khung, Ctrl/⌘ + con lăn (hoặc chụm hai ngón trên touchpad),
 * nhấp đúp để phóng to tại chỗ trỏ chuột / trở về vừa khung.
 */
export function SheetPreview(props: {
  html: string
  width: number
  height: number
  blank?: boolean
  label: string
  /** Lề quanh trang trong khung (px). */
  pad?: number
}) {
  const { html, width, height, blank, label, pad = PAD } = props
  const boxRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState({ w: 0, h: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  /** null = vừa khung (tự co theo cửa sổ); số = tỉ lệ người dùng chọn. */
  const [zoom, setZoom] = useState<number | null>(null)
  /** Điểm cần giữ nguyên dưới con trỏ khi phóng to (toạ độ trên trang ở tỉ lệ 1). */
  const anchor = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)
  /** Tài liệu iframe đang hiện nội dung nào (document mới tinh thì null). */
  const written = useRef<{ doc: Document; html: string } | null>(null)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Đổi khổ giấy thì về lại vừa khung
  useEffect(() => setZoom(null), [width, height])

  // Trang lấn sang dưới thanh phóng to (khung hẹp) thì chừa phía trên cho thanh, không để che đầu phiếu
  const reserve = Math.max(pad, BAR_INSET + bar.h + BAR_GAP)
  const underBar = (s: number) => bar.w > 0 && (box.w + width * s) / 2 > box.w - BAR_INSET - bar.w - BAR_GAP
  const fitFor = (top: number) => Math.max(MIN_ZOOM, Math.min((box.w - 2 * pad) / width, (box.h - top - pad) / height, FIT_MAX))
  const fitTop = box.w > 0 && underBar(fitFor(pad)) ? reserve : pad
  const fit = box.w > 0 ? fitFor(fitTop) : 0
  const scale = zoom ?? fit
  const padTop = zoom === null ? fitTop : underBar(scale) ? reserve : pad
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  /** Đổi tỉ lệ, giữ điểm (cx, cy) trên màn hình đứng yên; không có điểm thì giữ giữa khung. */
  const zoomTo = (next: number, cx?: number, cy?: number) => {
    const wrap = wrapRef.current?.getBoundingClientRect()
    const boxRect = boxRef.current?.getBoundingClientRect()
    if (wrap && boxRect) {
      const x = cx ?? boxRect.left + boxRect.width / 2
      const y = cy ?? boxRect.top + boxRect.height / 2
      anchor.current = { px: (x - wrap.left) / scaleRef.current, py: (y - wrap.top) / scaleRef.current, cx: x, cy: y }
    }
    setZoom(clamp(next))
  }
  const step = (dir: 1 | -1) => {
    const cur = scaleRef.current
    const next = dir > 0 ? STEPS.find((s) => s > cur + 0.001) ?? MAX_ZOOM : [...STEPS].reverse().find((s) => s < cur - 0.001) ?? MIN_ZOOM
    zoomTo(next)
  }

  // Sau khi đổi tỉ lệ: cuộn để điểm neo nằm lại đúng chỗ con trỏ
  useLayoutEffect(() => {
    const a = anchor.current
    const el = boxRef.current
    const wrap = wrapRef.current?.getBoundingClientRect()
    if (!a || !el || !wrap) return
    anchor.current = null
    el.scrollLeft += wrap.left + a.px * scale - a.cx
    el.scrollTop += wrap.top + a.py * scale - a.cy
  }, [scale])

  // Ctrl/⌘ + con lăn, chụm hai ngón trên touchpad (Chromium gửi wheel kèm ctrlKey)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      // Chuột: mỗi nấc ~100–120 → phóng ~25%; chụm ngón trên touchpad: delta nhỏ, cần nhạy hơn
      const k = Math.abs(e.deltaY) >= 50 ? 0.002 : 0.01
      zoomTo(scaleRef.current * Math.exp(-e.deltaY * k), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Đang phóng to: kéo chuột để di chuyển trang
  const onMouseDown = (e: MouseEvent) => {
    const el = boxRef.current
    if (!el || e.button !== 0 || !(zoom !== null && zoom > fit + 0.01)) return
    const start = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.classList.add('panning')
    const move = (ev: globalThis.MouseEvent) => {
      el.scrollLeft = start.sl - (ev.clientX - start.x)
      el.scrollTop = start.st - (ev.clientY - start.y)
    }
    const up = () => {
      el.classList.remove('panning')
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onDoubleClick = (e: MouseEvent) => {
    if (zoom !== null && zoom > fit + 0.01) setZoom(null)
    else zoomTo(Math.max(fit * 2, 1), e.clientX, e.clientY)
  }

  const paint = () => {
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    // document.close() có thể kích lại onLoad: cùng document, cùng nội dung thì thôi
    if (written.current?.doc === doc && written.current.html === html) return
    written.current = { doc, html }
    doc.open()
    doc.write(html)
    doc.close()
  }

  // Ghi nội dung mỗi khi html đổi; iframe vừa gắn vào trang thì ghi ở onLoad
  useEffect(paint, [html, scale > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Đo thanh phóng to (rộng hẹp tuỳ màn: Cài đặt không có nút Cỡ thật)
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBar({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [scale > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const pct = Math.round(scale * 100)
  return (
    <div className="preview-shell">
      <div className={`preview${zoom !== null && zoom > fit + 0.01 ? ' zoomed' : ''}`} ref={boxRef} onMouseDown={onMouseDown}>
        {scale > 0 && (
          <div className="preview-inner" style={{ padding: `${padTop}px ${pad}px ${pad}px` }}>
            <div
              className="sheet-wrap"
              ref={wrapRef}
              style={{ width: width * scale, height: height * scale }}
              onDoubleClick={onDoubleClick}
              title="Nhấp đúp để phóng to / thu nhỏ"
            >
              <iframe
                ref={frameRef}
                title={label}
                sandbox="allow-same-origin"
                tabIndex={-1}
                onLoad={paint}
                style={{ width, height, transform: `scale(${scale})` }}
              />
              {blank && <div className="blank-tag">Phiếu trống</div>}
            </div>
          </div>
        )}
      </div>
      {scale > 0 && (
        <div className="zoombar" ref={barRef} role="group" aria-label="Phóng to thu nhỏ bản xem trước">
          <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ (Ctrl/⌘ + con lăn)" onClick={() => step(-1)} disabled={scale <= MIN_ZOOM + 0.001}>−</button>
          <span className="zoom-pct" aria-live="polite">{pct}%</span>
          <button type="button" aria-label="Phóng to" title="Phóng to (Ctrl/⌘ + con lăn)" onClick={() => step(1)} disabled={scale >= MAX_ZOOM - 0.001}>+</button>
          <button type="button" className="zoom-fit" onClick={() => setZoom(null)} aria-pressed={zoom === null}>Vừa khung</button>
          <button type="button" className="zoom-fit" onClick={() => zoomTo(1)} aria-pressed={zoom !== null && Math.abs(zoom - 1) < 0.001}>Cỡ thật</button>
        </div>
      )}
    </div>
  )
}
