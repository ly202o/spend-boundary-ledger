import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildVersion = new Date().toISOString()
export default defineConfig({
  base: '/spend-boundary-ledger/',
  define: { __BUILD_VERSION__: JSON.stringify(buildVersion) },
  plugins: [react(), {
    name: 'app-version',
    generateBundle() {
      this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({version:buildVersion})})
    },
  }],
})
