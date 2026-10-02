import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pages build under /soc-analyst-simulator/, dev server at root
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/soc-analyst-simulator/' : '/',
  server: {
    // Listen on all interfaces (Windows IPv6 loopback quirk)
    host: true,
    port: 5173,
    open: true,
  },
}))
