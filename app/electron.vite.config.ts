import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// CSP của trang giao diện. Bản dev cần thêm inline script (react-refresh) và websocket (HMR).
function csp(): Plugin {
  return {
    name: 'xsmn-csp',
    transformIndexHtml(html, ctx) {
      const dev = !!ctx.server
      const policy = [
        "default-src 'self'",
        `script-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        "img-src 'self' data:",
        `connect-src 'self'${dev ? ' ws: http://localhost:*' : ''}`,
        "frame-src 'self' about:",
        "object-src 'none'",
        "base-uri 'none'"
      ].join('; ')
      return html.replace('%CSP%', policy)
    }
  }
}

// Build cho Electron 22 (bản cuối chạy Windows 7) — Node 16, Chromium 108. Bật bằng XSMN_TARGET=win7
// hoặc chạy qua `npm run dist:win7` (npm truyền tên script; cách này chạy được cả trên Windows/cmd).
const win7 = process.env.XSMN_TARGET === 'win7' || process.env.npm_lifecycle_event === 'dist:win7'

export default defineConfig({
  main: { build: win7 ? { target: 'node16' } : {} },
  preload: { build: win7 ? { target: 'node16' } : {} },
  renderer: {
    plugins: [react(), csp()],
    build: win7 ? { target: 'chrome108' } : {}
  }
})
