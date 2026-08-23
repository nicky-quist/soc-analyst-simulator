import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The GitHub Pages build lives under /soc-analyst-simulator/, but the dev
// server should serve from the root — otherwise `npm run dev` prints
// http://localhost:5173/ and that URL isn't where the app actually is.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/soc-analyst-simulator/' : '/',
  server: {
    // Vite's default binds IPv6 loopback only on Windows, so http://127.0.0.1:5173
    // refuses the connection. Listening on every interface avoids that.
    host: true,
    port: 5173,
    open: true,
  },
}))
