import { Network } from '../../../lib/types'

export function mempoolApiUrl(path: string, network?: Network): string {
  if (path.startsWith('/api')) path = path.slice(4)
  const hasVersion = path.startsWith('/v1')
  if (hasVersion) path = path.slice(3)
  return network == 'devnet'
    ? 'http://localhost:8999/api/v1' + path
    : 'https://mempool.space' + (network != 'livenet' ? `/${network}/api` : '/api') + (hasVersion ? '/v1' : '') + path
}
