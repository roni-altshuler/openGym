import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hostedApi } from '../lib/opengym-hosted.mjs'
import { sealGarminKey, openGarminKey } from '../lib/garmin-vault.mjs'

const secret = Buffer.alloc(32, 7).toString('base64') // Test-only key, never used by hosting.
const origin = 'https://private.test'
const req = (path, { user = 'alice', method = 'GET', body, requestOrigin = origin } = {}) => new Request(origin + path, {
  method, headers: { ...(user ? { 'oai-authenticated-user-id': user, 'oai-authenticated-user-email': user + '@example.test' } : {}),
    ...(method !== 'GET' ? { origin: requestOrigin, 'Content-Type': 'application/json' } : {}) },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
})
function database() {
  const profiles = new Map(), keys = new Map(), calls = []
  return { profiles, keys, calls, prepare(sql) {
    let args
    const statement = { bind(...values) { args = values; calls.push({ sql, args }); return statement },
      async first() {
        if (sql.startsWith('SELECT state')) return profiles.get(args[0]) || null
        if (sql.startsWith('SELECT encrypted')) return keys.get(args[0]) || null
        throw Error('Unexpected SQL')
      },
      async run() {
        let changes = 0
        if (sql.startsWith('INSERT OR IGNORE')) {
          if (!profiles.has(args[0])) { profiles.set(args[0], { state: args[1], revision: 0 }); changes = 1 }
        } else if (sql.startsWith('UPDATE profiles')) {
          const row = profiles.get(args[2])
          if (row?.revision === args[3]) { profiles.set(args[2], { state: args[0], revision: args[1] }); changes = 1 }
        } else if (sql.startsWith('INSERT INTO credentials')) {
          keys.set(args[0], { encrypted_garmin_key: args[1], last_pull: 0 }); changes = 1
        } else if (sql.startsWith('UPDATE credentials')) {
          const row = keys.get(args[1])
          if (row && row.last_pull < args[2]) { row.last_pull = args[0]; changes = 1 }
        } else if (sql.startsWith('DELETE FROM credentials')) changes = keys.delete(args[0]) ? 1 : 0
        else throw Error('Unexpected SQL')
        return { meta: { changes } }
      },
    }; return statement
  } }
}
const environment = () => ({ DB: database(), GARMIN_KEY_ENCRYPTION_SECRET: secret })
const mockGarmin = async url => Response.json(url.includes('personalapitoken-service') ? { access_token: 'test-access-token', expires_in: 86400 } : [])

test('AES-GCM ciphertext is randomized, authenticated, and bound to the profile', async () => {
  const key = 'fixture-only-garmin-key'
  const first = await sealGarminKey(key, 'alice', secret)
  const second = await sealGarminKey(key, 'alice', secret)
  assert.notEqual(first, second)
  assert.ok(!first.includes(key))
  assert.equal(await openGarminKey(first, 'alice', secret), key)
  await assert.rejects(openGarminKey(first, 'bob', secret))
  await assert.rejects(openGarminKey(first.slice(0, -2) + 'xx', 'alice', secret))
  await assert.rejects(sealGarminKey(key, 'alice', ''))
})

test('anonymous and cross-origin requests cannot access or change private records', async () => {
  const env = environment()
  for (const path of ['/api/me', '/api/data', '/api/garmin/status', '/api/garmin/activities']) {
    assert.equal((await hostedApi(req(path, { user: null }), env)).status, 401)
  }
  assert.equal((await hostedApi(req('/api/garmin/key', { method: 'POST', requestOrigin: 'https://other.test', body: { key: 'fixture-only-key' } }), env)).status, 403)
  assert.equal(env.DB.calls.length, 0)
})

test('Garmin setup stores only ciphertext, isolates users, excludes secrets from backups and supports removal', async () => {
  const env = environment(), key = 'fixture-only-garmin-key'
  const options = { fetchImpl: mockGarmin, now: () => 20000 }
  const connected = await hostedApi(req('/api/garmin/key', { method: 'POST', body: { key } }), env, options)
  assert.equal(connected.status, 200)
  assert.deepEqual(await connected.json(), { configured: true, canConfigure: true, mode: 'read-only' })
  assert.ok(!JSON.stringify(env.DB.calls).includes(key))
  const ciphertext = env.DB.keys.get('alice').encrypted_garmin_key
  assert.equal(await openGarminKey(ciphertext, 'alice', secret), key)
  const other = await hostedApi(req('/api/garmin/status', { user: 'bob' }), env)
  assert.equal((await other.json()).configured, false)
  assert.equal((await hostedApi(req('/api/garmin/activities', { user: 'bob' }), env, options)).status, 400)
  assert.equal((await hostedApi(req('/api/garmin/activities'), env, options)).status, 200)
  assert.equal((await hostedApi(req('/api/garmin/activities'), env, options)).status, 429)
  const backup = await (await hostedApi(req('/api/data'), env)).text()
  assert.ok(!backup.includes(key)); assert.ok(!backup.includes(ciphertext))
  assert.equal((await hostedApi(req('/api/garmin/key', { method: 'DELETE' }), env)).status, 200)
  assert.equal(env.DB.keys.size, 0)
})

test('invalid and failed keys are never stored and errors cannot expose remote secrets', async () => {
  const env = environment()
  const answer = await hostedApi(req('/api/garmin/key', { method: 'POST', body: { key: 'fixture-only-garmin-key' } }), env,
    { fetchImpl: async () => { throw Error('PRIVATE upstream secret fixture-only-garmin-key') } })
  assert.equal(answer.status, 502)
  assert.ok(!(await answer.text()).includes('PRIVATE'))
  assert.equal(env.DB.keys.size, 0)
  const huge = await hostedApi(req('/api/garmin/key', { method: 'POST', body: { key: 'x'.repeat(9000) } }), env)
  assert.equal(huge.status, 413)
})

test('phone and desktop saves use atomic revision checks and keep profiles separate', async () => {
  const env = environment()
  const initial = await (await hostedApi(req('/gym/api/data'), env)).json()
  assert.equal(initial.rev, 0)
  assert.equal(initial.state.trainingCycle.weeks.length, 2)
  const first = structuredClone(initial.state), second = structuredClone(initial.state)
  first.workouts = [{ id: 'phone-fixture', entries: [], d: '2026-10-25' }]
  second.workouts = [{ id: 'desktop-fixture', entries: [], d: '2026-10-25' }]
  const writes = await Promise.all([first, second].map(state => hostedApi(req('/api/data', { method: 'PUT', body: { state, baseRev: 0, stamped: true } }), env)))
  assert.deepEqual(writes.map(r => r.status).sort(), [200, 409])
  const saved = await (await hostedApi(req('/api/data'), env)).json()
  assert.equal(saved.rev, 1)
  assert.equal(saved.state.workouts.length, 1)
  const other = await (await hostedApi(req('/api/data', { user: 'bob' }), env)).json()
  assert.deepEqual(other.state.workouts, [])
  assert.equal((await hostedApi(req('/api/data', { method: 'PUT', body: { baseRev: 1, state: [] } }), env)).status, 400)
})
