import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadResults, sourceUrl, type FetchLike } from '../src/core/source'
import { D26, HTML_26 } from './helpers'

const ok = (body: string) => new Response(body, { status: 200 })
const exists = (p: string) => stat(p).then(() => true, () => false)

let dir: string
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'xsmn-test-')) })
afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

describe('loadResults', () => {
  it('tải đúng URL kèm header, đủ số thì ghi cache, lần sau dùng cache', async () => {
    const fetch = vi.fn<FetchLike>(async () => ok(HTML_26))
    const r1 = await loadResults(D26, { fetch, cacheDir: dir })
    expect(r1.status).toBe('ok')
    expect(r1.fromCache).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://www.minhngoc.net.vn/ket-qua-xo-so/mien-nam/26-10-2026.html')
    expect(url).toBe(sourceUrl(D26))
    expect((init?.headers as Record<string, string>)['Accept-Language']).toMatch(/^vi-VN/)
    expect(await readFile(join(dir, '26-10-2026.html'), 'utf8')).toBe(HTML_26)

    const r2 = await loadResults(D26, { fetch, cacheDir: dir })
    expect(r2.fromCache).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)

    const r3 = await loadResults(D26, { fetch, cacheDir: dir, force: true })
    expect(r3.fromCache).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('chưa đủ số thì không cache, và xoá cache cũ nếu có', async () => {
    const partial = HTML_26.replace('<div>929097</div>', '<div></div>')
    await writeFile(join(dir, '26-10-2026.html'), partial)
    const r = await loadResults(D26, { fetch: async () => ok(partial), cacheDir: dir })
    expect(r.status).toBe('partial')
    expect(await exists(join(dir, '26-10-2026.html'))).toBe(false)
  })

  it('ngày chưa có kết quả → none, không cache', async () => {
    const r = await loadResults({ y: 2026, m: 10, d: 27 }, { fetch: async () => ok(HTML_26), cacheDir: dir })
    expect(r.status).toBe('none')
    expect(await exists(join(dir, '27-10-2026.html'))).toBe(false)
  })

  it('lỗi mạng: thử lại 2 lần rồi trả error', async () => {
    const fetch = vi.fn<FetchLike>(async () => { throw new TypeError('fetch failed') })
    const r = await loadResults(D26, { fetch, retryDelayMs: 1 })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(r.status).toBe('error')
    expect(r.errorKind).toBe('server')
    expect(r.message).toMatch(/Không kết nối được tới máy chủ minhngoc/)
  })

  it('mất mạng: báo offline, không thử lại vô ích', async () => {
    const fetch = vi.fn<FetchLike>(async () => { throw new Error('net::ERR_INTERNET_DISCONNECTED') })
    const r = await loadResults(D26, { fetch, retryDelayMs: 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(r.errorKind).toBe('offline')
    expect(r.message).toBe('Không có kết nối mạng.')
    const dns = await loadResults(D26, {
      fetch: async () => { throw Object.assign(new Error('getaddrinfo ENOTFOUND www.minhngoc.net.vn'), { code: 'ENOTFOUND' }) },
      retryDelayMs: 1
    })
    expect(dns.errorKind).toBe('offline')
  })

  it('lỗi 5xx kéo dài: báo máy chủ gặp sự cố', async () => {
    const r = await loadResults(D26, { fetch: async () => new Response('', { status: 502 }), retryDelayMs: 1 })
    expect(r.errorKind).toBe('server')
    expect(r.message).toBe('Máy chủ minhngoc.net.vn đang gặp sự cố (lỗi 502).')
  })

  it('trang không có bảng kết quả (bảo trì / đổi giao diện) → parse', async () => {
    const r = await loadResults(D26, { fetch: async () => ok('<html>Bảo trì</html>') })
    expect(r.errorKind).toBe('parse')
  })

  it('lỗi 5xx thử lại, lần sau thành công', async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(ok(HTML_26))
    const r = await loadResults(D26, { fetch, retryDelayMs: 1 })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(r.status).toBe('ok')
  })

  it('lỗi 404 không thử lại', async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response('', { status: 404 }))
    const r = await loadResults(D26, { fetch, retryDelayMs: 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(r.status).toBe('error')
    expect(r.message).toContain('404')
    expect(r.errorKind).toBe('server')
  })

  it('quá thời gian chờ → error', async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))
    const r = await loadResults(D26, { fetch, timeoutMs: 20, retries: 0 })
    expect(r.status).toBe('error')
    expect(r.message).toMatch(/quá chậm/)
    expect(r.errorKind).toBe('server')
  })
})
