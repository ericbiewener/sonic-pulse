import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'sonic-pulse',
    compatibilityDate: '2026-11-18',
    assets: { notFoundHandling: 'single-page-application' },
  },
})
