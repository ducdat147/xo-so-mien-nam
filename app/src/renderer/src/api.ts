import type { XsmnApi } from '../../shared/api'

declare global {
  interface Window {
    xsmn: XsmnApi
  }
}

export const api: XsmnApi = window.xsmn
