// Màn hình chào khi mở app: hiện ngay, đóng khi cửa sổ chính đã vẽ xong (tối thiểu ~1,2 giây
// để không nháy qua quá nhanh). Chỉ dùng font hệ thống vì bản đóng gói không mang font giao diện.

import { BrowserWindow } from 'electron'
import { APP_NAME, APP_TAGLINE, LOGO_SVG } from '../shared/brand'

const MIN_SHOW_MS = 1200

function splashHtml(version: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${APP_NAME}</title><style>
html,body{margin:0;height:100%;background:#FFFFFF;color:#16181D;overflow:hidden;user-select:none;-webkit-app-region:drag;
font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif}
.wrap{height:100%;box-sizing:border-box;border:1px solid #DDE0E6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.logo svg{width:104px;height:104px;display:block;filter:drop-shadow(0 6px 14px rgba(194,65,12,.28))}
h1{margin:6px 0 0;font-size:26px;font-weight:700;letter-spacing:.2px}
p{margin:0;font-size:14px;color:#5B6270}
.dots{display:flex;gap:7px;margin-top:10px}
.dots span{width:8px;height:8px;border-radius:50%;background:#C2410C;opacity:.25;animation:b 1.2s infinite}
.dots span:nth-child(2){animation-delay:.15s}.dots span:nth-child(3){animation-delay:.3s}
@keyframes b{40%{opacity:1}}
.ver{position:absolute;bottom:12px;font-size:11px;color:#9AA1AD}
</style></head><body><div class="wrap">
<div class="logo">${LOGO_SVG}</div><h1>${APP_NAME}</h1><p>${APP_TAGLINE}</p>
<div class="dots"><span></span><span></span><span></span></div>
<div class="ver">Phiên bản ${version}</div></div></body></html>`
}

export function showSplash(version: string): { close: (then: () => void) => void } {
  const started = Date.now()
  const win = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    center: true,
    backgroundColor: '#FFFFFF',
    title: APP_NAME,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false }
  })
  win.once('ready-to-show', () => win.show())
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml(version))}`)
  return {
    /** Đợi đủ thời gian tối thiểu rồi chạy `then` (hiện cửa sổ chính) và đóng màn hình chào. */
    close(then) {
      setTimeout(() => {
        then()
        if (!win.isDestroyed()) win.destroy()
      }, Math.max(0, MIN_SHOW_MS - (Date.now() - started)))
    }
  }
}
