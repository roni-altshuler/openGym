import { sealGarminKey, openGarminKey } from './garmin-vault.mjs'
import { createGarminClient } from './garmin-client.mjs'
import { stampPut } from './opengym-sync-stamps.mjs'
import seed from './strength-seed.json' with { type: 'json' }

const json = (body, status = 200) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
} })
const identity = request => {
  // Sites dispatch injects these after authentication. The Site remains owner-private.
  const id = request.headers.get('oai-authenticated-user-id')
  const email = request.headers.get('oai-authenticated-user-email')
  return id && email ? { id, name: 'My workouts' } : null
}
async function readJson(request, limit) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw { status: 415 }
  const reader = request.body?.getReader()
  if (!reader) throw { status: 400 }
  let size = 0
  const chunks = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) { await reader.cancel(); throw { status: 413 } }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(all)) } catch { throw { status: 400 } }
}
async function profile(DB, id) {
  await DB.prepare('INSERT OR IGNORE INTO profiles (user_id,state,revision) VALUES (?,?,0)').bind(id, JSON.stringify(seed)).run()
  const row = await DB.prepare('SELECT state,revision FROM profiles WHERE user_id=?').bind(id).first()
  return { state: JSON.parse(row.state), rev: row.revision }
}
async function credential(DB, id) {
  return DB.prepare('SELECT encrypted_garmin_key,last_pull FROM credentials WHERE user_id=?').bind(id).first()
}
export async function hostedApi(request, env, { fetchImpl = fetch, now = Date.now } = {}) {
  const url = new URL(request.url), route = url.pathname.replace(/^\/gym(?=\/api\/)/, '')
  if (route === '/api/health') return json({ ok: true })
  if (route === '/api/config') return json({ allow_guest: false, invite_only: true, hosted_identity: true, coach: null })
  const user = identity(request)
  if (!user) return json({ error: 'Sign in with ChatGPT to use your private workouts.' }, 401)
  if (!env.DB) return json({ error: 'Private storage is unavailable.' }, 503)
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== url.origin) return json({ error: 'Request origin is not allowed.' }, 403)
  try {
    if (route === '/api/me') return json({ user })
    if (route === '/api/data' && request.method === 'GET') return json(await profile(env.DB, user.id))
    if (route === '/api/data/rev') {
      const row = await profile(env.DB, user.id)
      return json({ rev: row.rev, ...(row.state._wid ? { wid: row.state._wid } : {}) })
    }
    if (route === '/api/data' && request.method === 'PUT') {
      const body = await readJson(request, 5 * 1024 * 1024), state = body?.state
      if (!state || typeof state !== 'object' || Array.isArray(state) || !Array.isArray(state.routines) || !Array.isArray(state.workouts)) return json({ error: 'Invalid workout state.' }, 400)
      const current = await profile(env.DB, user.id)
      if (!Number.isInteger(body.baseRev) || body.baseRev !== current.rev || (body.baseWid && current.state._wid && body.baseWid !== current.state._wid)) return json({ error: 'conflict', ...current }, 409)
      delete state.active
      if ((Number(current.state.resetAt) || 0) > (Number(state.resetAt) || 0)) {
        state.resetAt = current.state.resetAt
        if (current.state.resetIds) state.resetIds = current.state.resetIds
      }
      const report = {}
      stampPut(current.state, state, { overRead: true, stamped: body.stamped === true, report })
      state._rev = current.rev + (report.changed ? 2 : 1)
      state._wids = [...(current.state._wids || []), ...(current.state._wid ? [current.state._wid] : [])].slice(-50)
      state._wid = crypto.randomUUID()
      // The SQL revision predicate makes concurrent phone/desktop updates atomic.
      const result = await env.DB.prepare('UPDATE profiles SET state=?,revision=? WHERE user_id=? AND revision=?').bind(JSON.stringify(state), state._rev, user.id, current.rev).run()
      if (!result.meta?.changes) return json({ error: 'conflict', ...await profile(env.DB, user.id) }, 409)
      return json({ ok: true, ts: state._ts || null, rev: current.rev + 1, wid: state._wid })
    }
    if (route === '/api/garmin/status') {
      const row = await credential(env.DB, user.id)
      return json({ configured: !!row, canConfigure: !!env.GARMIN_KEY_ENCRYPTION_SECRET, mode: 'read-only' })
    }
    if (route === '/api/garmin/key' && request.method === 'POST') {
      if (!env.GARMIN_KEY_ENCRYPTION_SECRET) return json({ error: 'Secure credential storage is not configured.' }, 503)
      const body = await readJson(request, 8192)
      const key = typeof body?.key === 'string' ? body.key.trim() : ''
      if (key.length < 8 || key.length > 4096 || /[\u0000-\u001f]/.test(key)) return json({ error: 'Enter a valid Garmin Personal API key.' }, 400)
      // Validate directly with Garmin; never save a failed key or echo remote errors.
      await createGarminClient({ key, fetchImpl, now }).recent()
      const encrypted = await sealGarminKey(key, user.id, env.GARMIN_KEY_ENCRYPTION_SECRET)
      await env.DB.prepare('INSERT INTO credentials (user_id,encrypted_garmin_key,last_pull) VALUES (?,?,0) ON CONFLICT(user_id) DO UPDATE SET encrypted_garmin_key=excluded.encrypted_garmin_key,last_pull=0').bind(user.id, encrypted).run()
      return json({ configured: true, canConfigure: true, mode: 'read-only' })
    }
    if (route === '/api/garmin/key' && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM credentials WHERE user_id=?').bind(user.id).run()
      return json({ configured: false, canConfigure: !!env.GARMIN_KEY_ENCRYPTION_SECRET, mode: 'read-only' })
    }
    if (route === '/api/garmin/activities') {
      const row = await credential(env.DB, user.id)
      if (!row) return json({ error: 'Connect your Garmin key first.' }, 400)
      const acquired = await env.DB.prepare('UPDATE credentials SET last_pull=? WHERE user_id=? AND last_pull<?').bind(now(), user.id, now() - 15000).run()
      if (!acquired.meta?.changes) return json({ error: 'Wait a few seconds before refreshing Garmin.' }, 429)
      const key = await openGarminKey(row.encrypted_garmin_key, user.id, env.GARMIN_KEY_ENCRYPTION_SECRET)
      return json({ activities: await createGarminClient({ key, fetchImpl, now }).recent() })
    }
    if (route === '/api/logout' && request.method === 'POST') return json({ ok: true })
    if (route === '/api/activity' && request.method === 'POST') return json({ ok: true })
    return json({ error: 'This optional server feature is not enabled on private hosting.' }, 404)
  } catch (error) {
    // Never send/log exception messages, body contents, keys, tokens, or upstream responses.
    return json({ error: error?.status ? 'The request could not be accepted.' : 'Could not complete the request. For Garmin, check the key and its expiry.' }, error?.status || 502)
  }
}
