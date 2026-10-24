import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGarminClient, garminRoutes } from '../garmin.js'

const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data })
test('Garmin uses the documented token and activity endpoints and removes location/owner fields', async () => {
  const calls = []
  const client = createGarminClient({ key: 'test-key-only', fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return calls.length === 1 ? response({ access_token: 'test-token', expires_in: 86400 }) : response([
      { activityId: 12, activityName: 'Pool swim', startTimeLocal: '2026-10-24 09:00:00', activityType: { typeKey: 'lap_swimming' }, duration: 1800,
        startLatitude: 1, startLongitude: 2, ownerFullName: 'PRIVATE', description: 'PRIVATE', averageHR: 123 },
    ])
  } })
  const rows = await client.recent()
  assert.equal(calls[0].url, 'https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers.Authorization, 'ApiKey test-key-only')
  assert.match(calls[1].url, /activitylist-service\/activities\/search\/activities\?start=0&limit=20&sortOrder=desc$/)
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token')
  assert.equal(calls[1].options.redirect, 'error')
  assert.deepEqual(rows, [{ id: '12', name: 'Pool swim', date: '2026-10-24', type: 'lap_swimming', seconds: 1800 }])
  await client.recent()
  assert.equal(calls.length, 3) // Token cached in memory, not stored in the user's profile.
})

test('Garmin renews an expired token once and never follows a redirect with credentials', async () => {
  const calls = []
  const client = createGarminClient({ key: 'test-key-only', fetchImpl: async (url, options) => {
    calls.push({ url, options })
    if (calls.length === 1 || calls.length === 3) return response({ access_token: 'test-token-' + calls.length })
    return calls.length === 2 ? response({}, 401) : response([])
  } })
  assert.deepEqual(await client.recent(), [])
  assert.equal(calls.length, 4)
  assert.ok(calls.every(c => c.options.redirect === 'error' && c.options.signal))
})

test('Garmin routes require the exact configured profile, keep credentials private and rate-limit reads', async () => {
  let calls = 0, time = 20000
  const routes = garminRoutes({ env: { GARMIN_PERSONAL_API_KEY: 'test-key-only', GARMIN_USER_ID: 'owner' },
    readSession: req => req.user, now: () => time, json: (res, status, body) => Object.assign(res, { status, body }),
    fetchImpl: async () => { calls++; return calls === 1 ? response({ access_token: 'test-token' }) : response([]) },
  })
  for (const [user, status] of [[null, 401], [{ id: 'other' }, 403]]) {
    const res = {}; await routes['GET /api/garmin/activities']({ user }, res)
    assert.equal(res.status, status); assert.equal(calls, 0)
  }
  const setup = {}; await routes['GET /api/garmin/status']({ user: { id: 'owner' } }, setup)
  assert.deepEqual(setup.body, { configured: true, mode: 'read-only' })
  const res = {}; await routes['GET /api/garmin/activities']({ user: { id: 'owner' } }, res)
  assert.equal(res.status, 200); assert.equal(calls, 2)
  const busy = {}; await routes['GET /api/garmin/activities']({ user: { id: 'owner' } }, busy)
  assert.equal(busy.status, 429); assert.equal(calls, 2)
  time += 15001
  const later = {}; await routes['GET /api/garmin/activities']({ user: { id: 'owner' } }, later)
  assert.equal(later.status, 200); assert.equal(calls, 3)
  assert.ok(!JSON.stringify([setup, res, busy, later]).includes('test-key'))
})

test('missing configuration is disabled and upstream errors cannot leak credentials or activity data', async () => {
  const json = (res, status, body) => Object.assign(res, { status, body })
  const disabled = garminRoutes({ env: {}, readSession: () => ({ id: 'owner' }), json })
  const setup = {}; await disabled['GET /api/garmin/status']({}, setup)
  assert.equal(setup.body.configured, false)
  const routes = garminRoutes({ env: { GARMIN_PERSONAL_API_KEY: 'test-key-only', GARMIN_USER_ID: 'owner' },
    readSession: () => ({ id: 'owner' }), json, fetchImpl: async () => { throw Error('PRIVATE test-key-only') },
  })
  const res = {}; await routes['GET /api/garmin/activities']({}, res)
  assert.equal(res.status, 502)
  assert.ok(!JSON.stringify(res).includes('PRIVATE'))
  assert.ok(!JSON.stringify(res).includes('test-key-only'))
})
