// Hàm tải trang cho core/source.ts.
// Electron 25+ có net.fetch (đi theo proxy hệ thống). Bản Win7 chạy Electron 22 không có, nên
// dùng https của Node: kèm sẵn bộ chứng chỉ gốc riêng, không phụ thuộc kho chứng chỉ cũ của Win7.

import { net } from 'electron'
import { get } from 'node:https'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import type { Readable } from 'node:stream'
import type { FetchLike, FetchResponse } from '../core/source'

const MAX_REDIRECTS = 5

function nodeFetch(url: string, init?: Parameters<FetchLike>[1], redirects = 0): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    const req = get(url, { headers: { ...init?.headers, 'Accept-Encoding': 'gzip, deflate, br' }, signal: init?.signal }, (res) => {
      const status = res.statusCode ?? 0
      const location = res.headers.location
      if (status >= 300 && status < 400 && location) {
        res.resume()
        if (redirects >= MAX_REDIRECTS) return reject(new Error('Chuyển hướng quá nhiều lần.'))
        return resolve(nodeFetch(new URL(location, url).toString(), init, redirects + 1))
      }
      const enc = String(res.headers['content-encoding'] ?? '').toLowerCase()
      let body: Readable = res
      if (enc === 'gzip') body = res.pipe(createGunzip())
      else if (enc === 'deflate') body = res.pipe(createInflate())
      else if (enc === 'br') body = res.pipe(createBrotliDecompress())
      const chunks: Buffer[] = []
      body.on('data', (c: Buffer) => chunks.push(c))
      body.on('error', reject)
      body.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({ ok: status >= 200 && status < 300, status, text: async () => text })
      })
    })
    req.on('error', reject)
  })
}

export const httpFetch: FetchLike =
  typeof net?.fetch === 'function' ? (url, init) => net.fetch(url, init) : nodeFetch
