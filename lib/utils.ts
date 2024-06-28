import { Network } from './types.js'

export function toXOnly(pubKey: Buffer): Buffer {
  return pubKey.length === 32 ? pubKey : pubKey.slice(1, 33)
}

export function toXOnlyU8(pubKey: Uint8Array): Uint8Array {
  return pubKey.length === 32 ? pubKey : pubKey.slice(1, 33)
}

export function mempoolApiUrl(path: string, network?: Network): string {
  if (path.startsWith('/api')) path = path.slice(4)
  const hasVersion = path.startsWith('/v1')
  if (hasVersion) path = path.slice(3)
  return network == 'devnet'
    ? 'http://localhost:18443' + path
    : 'https://mempool.space' + (network != 'livenet' ? `/${network}/api` : '/api') + (hasVersion ? '/v1' : '') + path
}
