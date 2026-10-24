// Official Garmin Personal API, read-only. Credentials never enter profile state or responses.
// Verified against Garmin's Personal API Swagger and Personal API FAQ on 2026-10-24.
const BASE = 'https://personal.connectapi.garmin.com'
const TOKEN = BASE + '/personalapitoken-service/personal-api/personal-api-key/token'
const RECENT = BASE + '/activitylist-service/activities/search/activities?start=0&limit=20&sortOrder=desc'

export function createGarminClient({ key, fetchImpl = fetch, now = Date.now }) {
  let token = null, expires = 0, tokenRequest = null
  const request = (url, options) => fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) })
  const accessToken = async () => {
    if (token && now() < expires) return token
    if (!tokenRequest) tokenRequest = (async () => {
      const res = await request(TOKEN, { method: 'POST', headers: { Authorization: 'ApiKey ' + key, Accept: 'application/json' } })
      if (!res.ok) throw new Error('Garmin authorization failed. Check the private API key and its expiry.')
      const data = await res.json()
      const value = data.access_token || data.accessToken
      if (typeof value !== 'string' || !value) throw new Error('Garmin returned an unexpected token response.')
      token = value
      const seconds = Number(data.expires_in)
      expires = now() + Math.max(0, Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds : 86400, 86400) - 60) * 1000
      return token
    })().finally(() => { tokenRequest = null })
    return tokenRequest
  }
  return {
    async recent() {
      let res
      for (let attempt = 0; attempt < 2; attempt++) {
        const bearer = await accessToken()
        res = await request(RECENT, { headers: { Authorization: 'Bearer ' + bearer, Accept: 'application/json' } })
        if (res.status !== 401 || attempt === 1) break
        token = null; expires = 0
      }
      if (!res.ok) throw new Error(res.status === 429 ? 'Garmin is limiting requests. Try again later.' : 'Garmin activities could not be read. Check access and try again.')
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Garmin returned an unexpected activity response.')
      // Deliberately omit GPS, owner details, health metrics, comments and social metadata.
      return data.slice(0, 20).map(a => ({
        id: String(a.activityId || ''), name: String(a.activityName || 'Activity').slice(0, 160),
        date: String(a.startTimeLocal || '').slice(0, 10),
        type: String(a.activityType?.typeKey || 'activity').slice(0, 60),
        seconds: Math.max(0, Number(a.duration) || 0),
      }))
    },
  }
}

export function garminRoutes({ json, readSession, env = process.env, fetchImpl, now = Date.now }) {
  const key = env.GARMIN_PERSONAL_API_KEY?.trim(), owner = env.GARMIN_USER_ID?.trim()
  const enabled = !!key && !!owner
  const client = enabled ? createGarminClient({ key, fetchImpl, now }) : null
  let lastPull = -Infinity, pulling = false
  const authorize = (req, res) => {
    const user = readSession(req)
    if (!user) { json(res, 401, { error: 'Sign in to use Garmin.' }); return false }
    if (!enabled || user.id !== owner) { json(res, 403, { error: 'Garmin is not configured for this profile.' }); return false }
    return true
  }
  return {
    'GET /api/garmin/status': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'Sign in to use Garmin.' })
      return json(res, 200, { configured: enabled && user.id === owner, mode: 'read-only' })
    },
    'GET /api/garmin/activities': async (req, res) => {
      if (!authorize(req, res)) return
      if (pulling || now() - lastPull < 15000) return json(res, 429, { error: 'Wait a few seconds before refreshing Garmin.' })
      lastPull = now(); pulling = true
      try { return json(res, 200, { activities: await client.recent() }) }
      catch { return json(res, 502, { error: 'Could not read Garmin. Check the server key, its expiry and the connection, then retry.' }) }
      finally { pulling = false }
    },
  }
}
