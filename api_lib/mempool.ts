import mempoolJS from '@mempool/mempool.js'
import { MempoolReturn } from '@mempool/mempool.js/lib/interfaces/index.js'

export function mempool(network: string): MempoolReturn {
  return mempoolJS({ hostname: network == 'devnet' ? 'localhost:8083' : 'mempool.space', network: network })
}
