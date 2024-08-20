import { secp256k1 } from '@noble/curves/secp256k1'
import * as mod from '@noble/curves/abstract/modular'

export function modN(a: bigint) {
  return mod.mod(a, secp256k1.CURVE.n)
}
export function invN(a: bigint) {
  return mod.invert(a, secp256k1.CURVE.n)
}
