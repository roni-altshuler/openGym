// Transparent at-rest encoding only: the app, sync and exports still use ordinary JSON.
// D1 limits a row to 2 MB. Compress growing histories before reaching that storage boundary.
import { Buffer } from 'node:buffer'
export const MAX_PROFILE_BYTES = 8 * 1024 * 1024
const MAX_STORED_BYTES = 1_900_000
const PREFIX = 'opengym-gzip-v1:'

export async function encodeProfile(state) {
  const json = JSON.stringify(state)
  const bytes = new TextEncoder().encode(json)
  if (bytes.length > MAX_PROFILE_BYTES) throw { status: 413 }
  if (bytes.length < 256 * 1024) return json
  const compressed = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
  const stored = PREFIX + Buffer.from(compressed).toString('base64')
  if (stored.length > MAX_STORED_BYTES) throw { status: 413 }
  return stored
}

export async function decodeProfile(stored) {
  if (!stored.startsWith(PREFIX)) return JSON.parse(stored)
  const bytes = Buffer.from(stored.slice(PREFIX.length), 'base64')
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader()
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_PROFILE_BYTES) { await reader.cancel(); throw new Error('Invalid stored profile size') }
    chunks.push(value)
  }
  return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
}
