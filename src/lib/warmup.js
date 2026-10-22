const API = import.meta.env.VITE_API_URL

export async function pingServer() {
  try {
    await fetch(`${API}/health`, { signal: AbortSignal.timeout(35000) })
  } catch {
    // silently ignore — servidor pode estar iniciando
  }
}

let _keepAliveTimer = null

export function startKeepAlive() {
  if (_keepAliveTimer) return
  _keepAliveTimer = setInterval(pingServer, 10 * 60 * 1000)
}

export function stopKeepAlive() {
  clearInterval(_keepAliveTimer)
  _keepAliveTimer = null
}
