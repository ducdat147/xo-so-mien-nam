import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import DownloadTable from './DownloadTable.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DownloadTable', DownloadTable)
  }
} satisfies Theme
