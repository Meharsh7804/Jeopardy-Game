import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// Stamp the service-worker cache name with a per-build version so every deploy
// gets a fresh cache. "Cache-first for static assets" combined with a FIXED
// cache name was serving stale/broken JS bundles forever after a deploy (black
// screen that never recovers). A unique name fixes it: old caches are pruned on
// activate and the newest bundle is always fetched.
function versionedServiceWorker(): Plugin {
  let version = Date.now().toString(36)
  return {
    name: 'versioned-service-worker',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const file = path.resolve(process.cwd(), 'dist/sw.js')
      if (!fs.existsSync(file)) return
      let src = fs.readFileSync(file, 'utf8')
      // Replace the fixed cache token (just the name string, keep the logic).
      src = src.replace(/const CACHE = "[^"]*"/, `const CACHE = "bwq-${version}"`)
      fs.writeFileSync(file, src)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), versionedServiceWorker()],
})
