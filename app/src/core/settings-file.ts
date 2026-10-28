// Đọc/ghi settings.json (chỉ dùng ở main process).

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { defaultSettings, normalizeSettings, type Settings } from './settings'

/** Không có file hoặc file hỏng → trả mặc định (file hỏng được giữ lại với đuôi .bak). */
export async function readSettingsFile(file: string): Promise<Settings> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch {
    return defaultSettings()
  }
  try {
    return normalizeSettings(JSON.parse(text))
  } catch {
    await rename(file, `${file}.bak`).catch(() => {})
    return defaultSettings()
  }
}

/** Ghi qua file tạm rồi đổi tên để không bao giờ để lại file dở dang. */
export async function writeSettingsFile(file: string, settings: Settings): Promise<Settings> {
  const clean = normalizeSettings(settings)
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await writeFile(tmp, JSON.stringify(clean, null, 2) + '\n', 'utf8')
  await rename(tmp, file)
  return clean
}
