// Server-only AES-256-GCM envelope. The master key is a private hosted runtime secret.
const bytes = text => new TextEncoder().encode(text)
const base64 = value => btoa(String.fromCharCode(...new Uint8Array(value)))
const unbase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0))
async function encryptionKey(secret) {
  const raw = unbase64(secret || '')
  if (raw.length !== 32) throw new Error('Garmin encryption is not configured')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
export async function sealGarminKey(plaintext, userId, secret) {
  const key = await encryptionKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bytes('garmin:v1:' + userId) }, key, bytes(plaintext))
  return 'v1.' + base64(iv) + '.' + base64(ciphertext)
}
export async function openGarminKey(envelope, userId, secret) {
  const [version, iv, ciphertext] = String(envelope).split('.')
  if (version !== 'v1') throw new Error('Invalid encrypted credential')
  const key = await encryptionKey(secret)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: bytes('garmin:v1:' + userId) }, key, unbase64(ciphertext))
  return new TextDecoder().decode(decrypted)
}
