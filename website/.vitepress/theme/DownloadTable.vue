<script setup lang="ts">
// Bảng tải về: hỏi GitHub bản phát hành mới nhất, link thẳng tới từng file cài.
// Không hỏi được (mất mạng, quá giới hạn API) thì vẫn hiện bảng, link về trang Releases.
import { computed, onMounted, ref } from 'vue'

const REPO = 'ducdat147/xo-so-mien-nam'
const RELEASES = `https://github.com/${REPO}/releases/latest`

type Os = 'mac' | 'win' | 'win7' | 'linux'
const ROWS: { os: Os; may: string; match: RegExp }[] = [
  { os: 'mac', may: 'macOS, chip Apple (M1, M2, M3…)', match: /-mac-arm64\.dmg$/ },
  { os: 'mac', may: 'macOS, chip Intel', match: /-mac-x64\.dmg$/ },
  { os: 'win', may: 'Windows 10, 11', match: /-win-x64\.exe$/ },
  { os: 'win7', may: 'Windows 7, 8, 8.1 (32 và 64-bit)', match: /-win7-[^/]*\.exe$/ },
  { os: 'linux', may: 'Linux, mọi bản (AppImage)', match: /\.AppImage$/ },
  { os: 'linux', may: 'Ubuntu, Debian (.deb)', match: /\.deb$/ }
]

interface Asset { name: string; size: number; browser_download_url: string }
const version = ref('')
const date = ref('')
const assets = ref<Asset[]>([])
const failed = ref(false)
const mine = ref<Os | null>(null)

function detectOs(): Os | null {
  const ua = navigator.userAgent
  if (/Windows NT 6\.[0-3]/.test(ua)) return 'win7'
  if (/Windows/.test(ua)) return 'win'
  if (/Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return 'mac'
  if (/Linux/.test(ua) && !/Android/.test(ua)) return 'linux'
  return null
}

onMounted(async () => {
  mine.value = detectOs()
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!r.ok) throw new Error(String(r.status))
    const data = await r.json()
    version.value = String(data.tag_name).replace(/^v/, '')
    date.value = new Date(data.published_at).toLocaleDateString('vi-VN')
    assets.value = data.assets
  } catch {
    failed.value = true
  }
})

const rows = computed(() =>
  ROWS.map((row) => ({ ...row, asset: assets.value.find((a) => row.match.test(a.name)) }))
)
const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`
</script>

<template>
  <div class="dl">
    <p v-if="version" class="dl-ver">
      Bản mới nhất <strong>{{ version }}</strong>, phát hành {{ date }}.
      <span v-if="mine">Dòng tô màu hợp với máy bạn đang dùng.</span>
    </p>
    <p v-else-if="failed" class="dl-ver">
      Chưa lấy được danh sách file. Mở <a :href="RELEASES" target="_blank" rel="noopener">trang tải về</a>
      rồi chọn file theo bảng dưới.
    </p>
    <p v-else class="dl-ver">Đang lấy danh sách file…</p>
    <table>
      <thead>
        <tr><th>Máy</th><th>File cài</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.may" :class="{ mine: row.os === mine }">
          <td>{{ row.may }}</td>
          <td>
            <a v-if="row.asset" :href="row.asset.browser_download_url">{{ row.asset.name }}</a>
            <span v-if="row.asset" class="dl-size"> · {{ mb(row.asset.size) }}</span>
            <a v-else :href="RELEASES" target="_blank" rel="noopener">Trang tải về</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.dl-ver { margin-bottom: 8px; }
.dl table { display: table; width: 100%; }
.dl tr.mine td { background: var(--vp-c-brand-soft); }
.dl tr.mine td:first-child { font-weight: 600; }
.dl-size { color: var(--vp-c-text-2); font-size: 0.9em; white-space: nowrap; }
.dl a { word-break: break-all; }
</style>
