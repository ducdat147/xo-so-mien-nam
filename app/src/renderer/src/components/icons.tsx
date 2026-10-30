// Biểu tượng lấy từ bản thiết kế (design/Main.dc.html); logo lấy từ shared/brand.

import { LOGO_SVG } from '../../../shared/brand'

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

export const Logo = () => <span className="logo" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />

export const Globe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
)

export const Refresh = ({ spinning = false }: { spinning?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} className={spinning ? 'spin' : undefined}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v6h-6" />
  </svg>
)

export const Printer = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...base}>
    <path d="M6 9V3h12v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M6 14h12v7H6z" />
  </svg>
)

export const Download = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
)

export const CheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.7L16 10" />
  </svg>
)

export const Clock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const Live = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="3" />
    <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" />
  </svg>
)

export const Gear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const ArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)

export const WifiOff = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
    <path d="M2 2l20 20" />
    <path d="M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5" />
    <path d="M12 20h.01" />
  </svg>
)

export const ServerAlert = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01M12 15v3" />
  </svg>
)

export const Alert = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </svg>
)

export const Eye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const EyeOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base}>
    <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </svg>
)

/** Nhập: mũi tên đi vào tờ giấy. */
export const FileImport = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...base}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 11v6M9 14l3 3 3-3" />
  </svg>
)

/** Xuất: mũi tên đi ra khỏi tờ giấy. */
export const FileExport = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...base}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 17v-6M9 14l3-3 3 3" />
  </svg>
)

export const Calendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
)

export const Close = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

// Trình sửa phiếu (cây thành phần, cột Thuộc tính): 16 px, cùng nét với bản Figma "Trình sửa phiếu"

const icon16 = (d: string) => {
  const Icon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" {...base}>
      <path d={d} />
    </svg>
  )
  return Icon
}

export const IconReceipt = icon16('M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6')
export const IconPanelTop = icon16('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 9h18')
export const IconTable = icon16('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 9h18M3 15h18M9 3v18')
export const IconRows = icon16('M4 8h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM3 4h18M3 20h18')
export const IconTag = icon16('M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01')
export const IconHash = icon16('M4 9h16M4 15h16M10 3 8 21M16 3l-2 18')
export const IconType = icon16('M4 7V4h16v3M9 20h6M12 4v16')
export const IconPage = icon16('M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6')
export const IconLine = icon16('M4 7h14M4 12h9M4 17h12')
export const IconLock = icon16('M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4')
export const IconCalendar = icon16('M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM16 3v4M8 3v4M3 10h18')
export const IconUndo = icon16('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11')
export const IconRedo = icon16('m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13')
export const IconEye = icon16('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z')
export const IconEyeOff = icon16('M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18')
export const IconBold = icon16('M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z')
export const IconItalic = icon16('M19 4h-9M14 20H5M15 4 9 20')
export const IconUnderline = icon16('M6 4v6a6 6 0 0 0 12 0V4M4 20h16')
