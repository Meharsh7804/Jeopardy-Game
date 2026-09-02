import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// PWA: register the service worker in production only so dev-time caching
// never serves stale assets while iterating. updateViaCache:'none' forces the
// browser to always hit the network for the SW script itself, so a freshly
// deployed SW (with its build-versioned cache) takes over immediately and old
// broken bundles are never served after a deploy.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch(() => {})
  })
}
