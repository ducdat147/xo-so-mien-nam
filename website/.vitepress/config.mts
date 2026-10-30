import { defineConfig } from 'vitepress'

const REPO = 'https://github.com/ducdat147/xo-so-mien-nam'

// Tìm kiếm: bỏ dấu tiếng Việt ở cả chữ trong trang lẫn chữ gõ vào, gõ "in phieu" vẫn ra "In phiếu"
const boDau = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default defineConfig({
  lang: 'vi-VN',
  title: 'Xổ Số Đại Lý',
  description: 'App máy tính lấy kết quả xổ số miền Nam và in phiếu dò cho đại lý vé số',
  base: '/xo-so-mien-nam/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/xo-so-mien-nam/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#C2410C' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Hướng dẫn', link: '/huong-dan/tai-ve', activeMatch: '/huong-dan/' },
      { text: 'Phát triển', link: '/phat-trien/', activeMatch: '/phat-trien/' },
      { text: 'Thay đổi', link: '/thay-doi' },
      { text: 'Tải về', link: `${REPO}/releases/latest` }
    ],
    sidebar: {
      '/huong-dan/': [
        {
          text: 'Hướng dẫn sử dụng',
          items: [
            { text: 'Tải và cài app', link: '/huong-dan/tai-ve' },
            { text: 'Lấy kết quả, in và lưu', link: '/huong-dan/su-dung' },
            { text: 'Chỉnh mẫu phiếu', link: '/huong-dan/cai-dat' },
            { text: 'Hỏi đáp, xử lý sự cố', link: '/huong-dan/hoi-dap' }
          ]
        }
      ],
      '/phat-trien/': [
        {
          text: 'Cho lập trình viên',
          items: [
            { text: 'Chạy từ mã nguồn', link: '/phat-trien/' },
            { text: 'Phát hành bản mới', link: '/phat-trien/phat-hanh' }
          ]
        }
      ]
    },
    socialLinks: [{ icon: 'github', link: REPO }],
    editLink: { pattern: `${REPO}/edit/master/website/:path`, text: 'Sửa trang này trên GitHub' },
    footer: { message: 'Mã nguồn mở theo giấy phép MIT.', copyright: '© 2026 DatTD' },

    outline: { level: [2, 3], label: 'Trên trang này' },
    docFooter: { prev: 'Trang trước', next: 'Trang sau' },
    lastUpdated: { text: 'Cập nhật lần cuối', formatOptions: { dateStyle: 'short' } },
    darkModeSwitchLabel: 'Giao diện',
    lightModeSwitchTitle: 'Chuyển sang nền sáng',
    darkModeSwitchTitle: 'Chuyển sang nền tối',
    sidebarMenuLabel: 'Mục lục',
    returnToTopLabel: 'Lên đầu trang',
    langMenuLabel: 'Ngôn ngữ',
    notFound: {
      title: 'KHÔNG TÌM THẤY TRANG',
      quote: 'Trang này không có hoặc đã đổi địa chỉ.',
      linkLabel: 'về trang chủ',
      linkText: 'Về trang chủ'
    },

    search: {
      provider: 'local',
      options: {
        miniSearch: {
          options: { processTerm: (term: string) => boDau(term) },
          searchOptions: { processTerm: (term: string) => boDau(term), prefix: true, fuzzy: 0.2 }
        },
        translations: {
          button: { buttonText: 'Tìm kiếm', buttonAriaLabel: 'Tìm kiếm' },
          modal: {
            displayDetails: 'Hiện chi tiết',
            resetButtonTitle: 'Xoá ô tìm',
            backButtonTitle: 'Đóng',
            noResultsText: 'Không thấy kết quả cho',
            footer: { selectText: 'chọn', navigateText: 'di chuyển', closeText: 'đóng' }
          }
        }
      }
    }
  }
})
