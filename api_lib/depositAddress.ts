import * as ecc from '@bitcoinerlab/secp256k1'
import { BIP32Factory, BIP32Interface } from 'bip32'
import { scriptTLSC } from '../lib/tlsc.js'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { btcNetwork } from '../lib/network.js'
import { Network } from '../lib/types.js'

const bip32 = BIP32Factory(ecc)

if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

export const hdKey = bip32.fromSeed(Buffer.from(process.env.BITCOIN_KEY ?? '', 'hex'))
var keys: BIP32Interface[] = []
for (var i = 0; i < 3; i++) {
  keys[i] = hdKey.derive(i)
}

export function getSupplyP2tr(userKey: string, network?: Network) {
  return btc.p2tr(undefined, { script: scriptTLSC(hdKey.publicKey, hex.decode(userKey)) }, btcNetwork(network), true)
}
