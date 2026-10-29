import { useCallback, useEffect, useState } from 'react'
import type { PrinterItem } from '../../shared/api'
import { api } from './api'
import { listLocalFonts } from './fonts'

/** Font đã cài trên máy (null = đang đọc; rỗng = không đọc được). */
export function useLocalFonts(): string[] | null {
  const [fonts, setFonts] = useState<string[] | null>(null)
  useEffect(() => {
    let alive = true
    listLocalFonts().then((f) => alive && setFonts(f))
    return () => { alive = false }
  }, [])
  return fonts
}

/** Trạng thái mạng theo hệ điều hành (navigator.onLine + sự kiện online/offline). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

/** Danh sách máy in của máy (null = đang tìm lần đầu). refresh() để tìm lại khi vừa cắm máy in. */
export function usePrinters(): { printers: PrinterItem[] | null; loading: boolean; refresh: () => void } {
  const [printers, setPrinters] = useState<PrinterItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const refresh = useCallback(() => {
    setLoading(true)
    api.listPrinters().then(setPrinters, () => setPrinters([])).finally(() => setLoading(false))
  }, [])
  useEffect(refresh, [refresh])
  return { printers, loading, refresh }
}
