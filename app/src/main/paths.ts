import { app } from 'electron'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

export const settingsFile = () => join(app.getPath('userData'), 'settings.json')
export const cacheDir = () => join(app.getPath('userData'), 'cache')
export const tempDir = () => join(app.getPath('temp'), 'xsmn')

/** "~/Documents/XSMN" → đường dẫn thật. ~/Documents dùng thư mục Tài liệu của hệ điều hành (Windows có thể đã chuyển sang OneDrive). */
export function resolveOutputDir(dir: string): string {
  const d = dir.trim() || '~/Documents/XSMN'
  const home = d.match(/^~(?:[\\/](.*))?$/)
  if (home) {
    const rest = home[1] ?? ''
    const docs = rest.match(/^Documents(?:[\\/](.*))?$/i)
    return docs ? join(app.getPath('documents'), docs[1] ?? '') : join(homedir(), rest)
  }
  return isAbsolute(d) ? d : join(homedir(), d)
}
