import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { encodeProfile, decodeProfile, MAX_PROFILE_BYTES } from '../lib/profile-codec.mjs'

test('old plain-JSON profiles and small new profiles stay compatible', async () => {
  const state = { workouts: [], routines: [], note: 'Quality reps 💪' }
  assert.equal(await encodeProfile(state), JSON.stringify(state))
  assert.deepEqual(await decodeProfile(JSON.stringify(state)), state)
})

test('a multi-year synthetic history larger than a D1 row round-trips without losing Unicode or records', async () => {
  const state = { workouts: Array.from({ length: 4000 }, (_, i) => ({ id: 'fixture-' + i,
    name: 'Upper A', note: 'Controlled technique 💪 '.repeat(10),
    entries: Array.from({ length: 5 }, () => ({ id: '0025', sets: [{ w: 40, r: 8, rir: 2, done: true }, { w: 40, r: 8, rir: 2, done: true }] })) })) }
  assert.ok(Buffer.byteLength(JSON.stringify(state)) > 2_000_000)
  const stored = await encodeProfile(state)
  assert.ok(Buffer.byteLength(stored) < 1_900_000)
  assert.deepEqual(await decodeProfile(stored), state)
})

test('oversized inputs and compressed expansion are bounded rather than truncating history', async () => {
  await assert.rejects(encodeProfile({ note: 'x'.repeat(MAX_PROFILE_BYTES) }), e => e.status === 413)
  const huge = 'opengym-gzip-v1:' + gzipSync(JSON.stringify({ note: 'x'.repeat(MAX_PROFILE_BYTES + 100) })).toString('base64')
  await assert.rejects(decodeProfile(huge))
  await assert.rejects(decodeProfile('opengym-gzip-v1:not-valid-gzip'))
})
