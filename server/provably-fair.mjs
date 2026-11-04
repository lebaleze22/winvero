import { createHash, createHmac, randomBytes } from 'node:crypto'

export const sha256Hex = value => createHash('sha256').update(value).digest('hex')

export function normalizeClientSeed(value) {
  const seed = String(value ?? 'winvero-default').trim()
  if (!/^[\x20-\x7E]{1,128}$/.test(seed)) throw new Error('Client seed invalide')
  return seed
}

export function createServerSeed() {
  return randomBytes(32).toString('hex')
}

export function fairDigest(serverSeed, clientSeed, nonce, cursor) {
  return createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}:${cursor}`)
    .digest('hex')
}

export function fairFloat(serverSeed, clientSeed, nonce, cursor) {
  const digest = fairDigest(serverSeed, clientSeed, nonce, cursor)
  // Les 13 premiers hexadécimaux représentent 52 bits, exactement représentables
  // par un Number IEEE-754. La division produit une valeur déterministe dans [0, 1).
  return Number.parseInt(digest.slice(0, 13), 16) / 0x10000000000000
}

export class FairRng {
  constructor(serverSeed, clientSeed, nonce, cursor = 0) {
    this.serverSeed = serverSeed
    this.clientSeed = normalizeClientSeed(clientSeed)
    this.nonce = nonce
    this.cursor = cursor
  }

  float() {
    return fairFloat(this.serverSeed, this.clientSeed, this.nonce, this.cursor++)
  }

  int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1) throw new Error('Borne aléatoire invalide')
    return Math.floor(this.float() * maxExclusive)
  }

  pick(values) {
    if (!Array.isArray(values) || values.length === 0) throw new Error('Liste aléatoire vide')
    return values[this.int(values.length)]
  }

  shuffle(values) {
    const result = [...values]
    for (let index = result.length - 1; index > 0; index -= 1) {
      const selected = this.int(index + 1)
      ;[result[index], result[selected]] = [result[selected], result[index]]
    }
    return result
  }
}

export function createFairContext(clientSeed, nonce, fixedServerSeed) {
  const serverSeed = fixedServerSeed || createServerSeed()
  const normalizedClientSeed = normalizeClientSeed(clientSeed)
  return {
    serverSeed,
    serverSeedHash: sha256Hex(serverSeed),
    clientSeed: normalizedClientSeed,
    nonce,
    rng: new FairRng(serverSeed, normalizedClientSeed, nonce),
  }
}

export function verifyFairEvent({ serverSeed, serverSeedHash, clientSeed, nonce, cursor, value }) {
  return sha256Hex(serverSeed) === serverSeedHash
    && fairFloat(serverSeed, clientSeed, nonce, cursor) === value
}
