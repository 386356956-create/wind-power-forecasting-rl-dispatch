const DEFAULT_BASE = '/api'
const rawBase = import.meta.env.VITE_API_BASE || DEFAULT_BASE
const API_BASE = rawBase.replace(/\/$/, '')

function buildApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized.startsWith('/api/')) {
    return `${API_BASE}${normalized.slice(4)}`
  }
  return `${API_BASE}${normalized}`
}

async function readJson(path, options = {}) {
  const response = await fetch(buildApiUrl(path), options)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `API ${path} failed: ${response.status}`)
  }
  return response.json()
}

export function fetchDashboard() {
  return readJson('/dashboard')
}

export function fetchSite(siteId) {
  return readJson(`/site/${siteId}`)
}

export function askAgent(question) {
  return readJson('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
}

export function fetchComparison() {
  return readJson('/comparison')
}

export function getExportUrl(path) {
  return buildApiUrl(path)
}
