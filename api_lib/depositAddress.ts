import { Taptree } from 'bitcoinjs-lib/src/types'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from '@bitcoinerlab/secp256k1'
import { BIP32Factory, BIP32Interface } from 'bip32'
import { toXOnly, toXOnlyU8 } from '../lib/utils.js'
import { Script } from '@scure/btc-signer'

bitcoin.initEccLib(ecc)
const bip32 = BIP32Factory(ecc)

if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

export const hdKey = bip32.fromSeed(Buffer.from(process.env.BITCOIN_KEY ?? '', 'hex'))
var keys: BIP32Interface[] = []
for (var i = 0; i < 3; i++) {
  keys[i] = hdKey.derive(i)
}

export function getSupplyP2tr(userKey: string, redeem?: any) {
  return bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(toXOnly(hdKey.publicKey)), // @todo fix this, should use a nothing-up-my-sleeves point
    scriptTree: getTLSCScriptTree(userKey),
    redeem,
    network: bitcoin.networks.testnet
  })
}

/**
 * get time-lock self-custody taproot, which can be spent by userKey when time
 * passed, or with 2/2 multisig from user&MPC.
 */
export function getTLSCScriptTree(userKey: string): Taptree {
  return {
    output: scriptTLSC(userKey)
  }
}

/** Time-lock self-custody script */
export function scriptTLSC(userKey: string): Buffer {
  return Buffer.from(
    Script.encode([
      'DEPTH', // push stack depth
      '1SUB', // sub 1
      'IF', // result still greater, which means stack contains two signature
      toXOnlyU8(hdKey.publicKey), // check MPC key, here use hd public key for demo
      'CHECKSIGVERIFY', // fail if signature does not match
      'ELSE', // stack contains only one signature
      'OP_1', // 1 block later
      'CHECKSEQUENCEVERIFY', // fail if block not passes
      'DROP', // drop check result
      'ENDIF',
      toXOnlyU8(Buffer.from(userKey)), // check user key
      'CHECKSIG' // fail if signature does not match
    ])
  )
}
