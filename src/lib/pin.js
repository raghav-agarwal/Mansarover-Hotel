// PINs are never stored in plain text: SHA-256 of "salt:pin", with a random salt per user.
const enc = new TextEncoder()

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function newSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)))
}

export async function hashPin(pin, salt) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${pin}`))
  return toHex(digest)
}

export const isValidPin = (pin) => /^\d{4}$/.test(pin)
