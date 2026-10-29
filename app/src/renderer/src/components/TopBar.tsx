import { APP_NAME, APP_TAGLINE } from '../../../shared/brand'
import { ArrowLeft, Gear, Globe, Logo } from './icons'

/** Thanh trên cùng: tên app, nút quay lại (ở màn Cài đặt), nguồn dữ liệu, nút bánh răng. */
export function TopBar(props: { inSettings: boolean; onBack: () => void; onOpenSettings: () => void }) {
  const { inSettings, onBack, onOpenSettings } = props
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <span className="brand-name">{APP_NAME}</span>
          <span className="brand-sub">{APP_TAGLINE}</span>
        </div>
      </div>
      {inSettings && (
        <button type="button" className="btn back" onClick={onBack}>
          <ArrowLeft />
          Quay lại Kết quả
        </button>
      )}
      <div className="topbar-right">
        <span className="source">
          <Globe />
          Nguồn: minhngoc.net.vn
        </span>
        <button
          type="button"
          className="icon-btn tip tip-below tip-end"
          aria-label="Cài đặt"
          data-tip={inSettings ? 'Đóng Cài đặt' : 'Cài đặt'}
          aria-pressed={inSettings}
          onClick={inSettings ? onBack : onOpenSettings}
        >
          <Gear />
        </button>
      </div>
    </header>
  )
}
