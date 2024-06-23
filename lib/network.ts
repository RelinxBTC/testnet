import { Network } from './types'

import * as btc from '@scure/btc-signer'

export function btcNetwork(network?: Network): typeof btc.NETWORK {
  switch (network) {
    case 'livenet':
      return btc.NETWORK
    case 'devnet':
      return { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
    default:
      return btc.TEST_NETWORK
  }
}
