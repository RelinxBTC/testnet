import { toXOnlyU8 } from './utils.js'
import { Script } from '@scure/btc-signer'

/**
 * Time-lock self-custody script, which can be spent by userKey when time
 * passed, or with 2/2 multisig from user&MPC.
 */
export function scriptTLSC(mpcKey: Uint8Array, userKey: Uint8Array, blocks = 1): Uint8Array {
  if (!userKey.length) throw new Error('user key is empty')
  if (!mpcKey.length) throw new Error('mpc key is empty')
  return Script.encode([
    'DEPTH', // push stack depth
    '1SUB', // sub 1
    'IF', // result still greater, which means stack contains two signature
    toXOnlyU8(mpcKey), // check MPC key, here use hd public key for demo
    'CHECKSIGVERIFY', // fail if signature does not match
    'ELSE', // stack contains only one signature
    blocks, // 1 block later
    'CHECKSEQUENCEVERIFY', // fail if block not passes
    'DROP', // drop check result
    'ENDIF',
    toXOnlyU8(userKey), // check user key
    'CHECKSIG' // fail if signature does not match
  ])
}
