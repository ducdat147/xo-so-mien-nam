// Tải trang minhngoc + cache (SPEC §3). Không import electron: main truyền net.fetch vào.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DateVN } from './dates'
import { formatDate, isLiveWindow, sameDate, todayVN } from './dates'
import type { LiveSource } from './live'
import { errorResult, parseResults, type DayResult } from './parse'

export const SOURCE_BASE = 'https://www.minhngoc.net.vn/ket-qua-xo-so/mien-nam'
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** Tối thiểu cần dùng của fetch. Bản Win7 (Electron 22, Node 16) không có fetch/Response sẵn. */
export interface FetchInit {
  signal: AbortSignal
  headers: Record<string, string>
}
export interface FetchResponse {
  ok: boolean
  status: number
  text(): Promise<string>
}
export type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponse>

export interface FetchPageOptions {
  fetch?: FetchLike
  timeoutMs?: number
  /** Số lần thử lại sau lần đầu. */
  retries?: number
  retryDelayMs?: number
  signal?: AbortSignal
}

export interface LoadOptions extends FetchPageOptions {
  /** Thư mục cache; bỏ trống = không cache. */
  cacheDir?: string
  /** Bỏ qua cache, tải lại. */
  force?: boolean
  /** Nguồn trực tiếp (chỉ hỏi khi lấy ngày hôm nay, trong khung 16h–17h); bỏ trống = chỉ đọc trang kết quả. */
  live?: LiveSource
}

export interface LoadedResult extends DayResult {
  fromCache: boolean
  /** Thời điểm tải (ISO). */
  fetchedAt: string
  /** Lấy từ bảng trực tiếp lúc đang quay: vài giây sau hỏi lại là có số mới. */
  live?: boolean
  /** Đang quay mà lần hỏi gần nhất lỗi: đây là bảng của lần trước. */
  stale?: boolean
}

export function sourceUrl(date: DateVN): string {
  return `${SOURCE_BASE}/${formatDate(date)}.html`
}

export class FetchError extends Error {
  constructor(message: string, readonly kind: 'offline' | 'server', readonly status?: number) {
    super(message)
    this.name = 'FetchError'
  }
}

/** Mã lỗi cho biết máy không ra được Internet (Chromium net::ERR_… hoặc Node). */
const OFFLINE_CODES = [
  'ERR_INTERNET_DISCONNECTED', 'ERR_NAME_NOT_RESOLVED', 'ERR_NAME_RESOLUTION_FAILED', 'ERR_NETWORK_CHANGED',
  'ERR_ADDRESS_UNREACHABLE', 'ERR_NETWORK_ACCESS_DENIED', 'ERR_PROXY_CONNECTION_FAILED',
  'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'ENETDOWN', 'EHOSTUNREACH'
]

/** Phân loại lỗi mạng: mất mạng hay máy chủ minhngoc có vấn đề. */
export function classifyNetworkError(e: unknown): FetchError {
  if (e instanceof FetchError) return e
  const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } }
  const text = [err?.code, err?.message, err?.cause?.code, err?.cause?.message].filter(Boolean).join(' ')
  if (OFFLINE_CODES.some((c) => text.includes(c))) return new FetchError('Không có kết nối mạng.', 'offline')
  return new FetchError('Không kết nối được tới máy chủ minhngoc.net.vn.', 'server')
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason)
    }, { once: true })
  })

/** Như AbortSignal.any (Node 20+), viết tay để chạy được trên Node 16. */
function anySignal(...signals: AbortSignal[]): AbortSignal {
  const ctl = new AbortController()
  for (const s of signals) {
    if (s.aborted) {
      ctl.abort(s.reason)
      break
    }
    s.addEventListener('abort', () => ctl.abort(s.reason), { once: true })
  }
  return ctl.signal
}

/** Tải một trang của minhngoc, có thử lại khi máy chủ lỗi. */
export async function fetchText(url: string, opts: FetchPageOptions = {}): Promise<string> {
  const doFetch: FetchLike = opts.fetch ?? ((u, init) => fetch(u, init))
  const retries = opts.retries ?? 2
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(opts.retryDelayMs ?? 2000, opts.signal)
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? 25000)
    const signal = opts.signal ? anySignal(opts.signal, timeout) : timeout
    try {
      const res = await doFetch(url, {
        signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'vi-VN,vi;q=0.9' }
      })
      if (!res.ok) {
        lastError = new FetchError(
          res.status >= 500 || res.status === 429
            ? `Máy chủ minhngoc.net.vn đang gặp sự cố (lỗi ${res.status}).`
            : `Máy chủ minhngoc.net.vn từ chối yêu cầu (lỗi ${res.status}).`,
          'server',
          res.status
        )
        // 4xx (trừ 429) thử lại cũng vô ích
        if (res.status < 500 && res.status !== 429) break
        continue
      }
      return await res.text()
    } catch (e) {
      if (opts.signal?.aborted) throw e
      lastError = timeout.aborted
        ? new FetchError('Máy chủ minhngoc.net.vn phản hồi quá chậm (hết thời gian chờ).', 'server')
        : classifyNetworkError(e)
      // Mất mạng thì thử lại ngay cũng vô ích
      if ((lastError as FetchError).kind === 'offline') break
    }
  }
  throw classifyNetworkError(lastError)
}

function cacheFile(cacheDir: string, date: DateVN): string {
  return join(cacheDir, `${formatDate(date)}.html`)
}

/** Lấy kết quả một ngày: dùng cache nếu có (chỉ cache khi đủ số), không thì tải. */
export async function loadResults(date: DateVN, opts: LoadOptions = {}): Promise<LoadedResult> {
  const now = () => new Date().toISOString()
  const file = opts.cacheDir ? cacheFile(opts.cacheDir, date) : null

  if (file && !opts.force) {
    const html = await readFile(file, 'utf8').catch(() => null)
    if (html) {
      const cached = parseResults(html, date)
      if (cached.status === 'ok') return { ...cached, fromCache: true, fetchedAt: now() }
      await rm(file, { force: true })
    }
  }

  // Hôm nay, 16h–17h: hỏi bảng trực tiếp trước. Trong lúc quay, trang kết quả theo ngày còn hiện
  // bảng hôm qua (chụp 16h23 ngày 29-10-2026), có khi tới lúc quay xong mới có số.
  // Ngoài khung giờ đó không đụng tới máy chủ trực tiếp.
  const live =
    opts.live && isLiveWindow() && sameDate(date, todayVN())
      ? await opts.live.load(date, opts).catch(() => null)
      : null
  if (opts.signal?.aborted) throw opts.signal.reason
  const fromLive: LoadedResult | null = live && { ...live.result, fromCache: false, fetchedAt: now(), live: live.running }
  // Quay xong thì feed vẫn để run = 1 thêm một lúc (chụp 16h36): đủ số rồi thì tải trang kết quả để cache
  if (fromLive?.live && fromLive.status !== 'ok') return fromLive

  let html: string
  try {
    html = await fetchText(sourceUrl(date), opts)
  } catch (e) {
    if (opts.signal?.aborted) throw e
    if (fromLive) return fromLive
    const fe = classifyNetworkError(e)
    return { ...errorResult(date, fe.message, fe.kind), fromCache: false, fetchedAt: now() }
  }

  const result = parseResults(html, date)
  if (file) {
    if (result.status === 'ok') {
      await mkdir(opts.cacheDir!, { recursive: true })
      await writeFile(file, html, 'utf8')
    } else {
      await rm(file, { force: true })
    }
  }
  // Quay xong mà trang kết quả chưa kịp cập nhật: dùng bảng trực tiếp (không cache, lần sau tải lại trang)
  if (fromLive && result.status !== 'ok' && fromLive.filled > result.filled) return fromLive
  return { ...result, fromCache: false, fetchedAt: now() }
}
