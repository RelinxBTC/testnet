import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'
import { Network } from '../lib/types'
import { secp256k1 } from '@noble/curves/secp256k1'
import * as btc from '@scure/btc-signer'
import { hexToBytes } from '@noble/hashes/utils'
import { hdKey } from '../api_lib/depositAddress.js'
import { btcNetwork } from '../lib/network.js'

async function get(request: VercelRequest, response: VercelResponse) {
  const txid = request.query['txid'] as string
  const network = request.query['network'] as Network
  const commitments = await (txid ? kv.hgetall(txid) : kv.lrange(network, 0, 100))
  return response.status(200).send(commitments)
}

async function post(request: VercelRequest, response: VercelResponse) {
  const commitment = JSON.parse(request.body)
  const txid = commitment.txid
  const nonce = commitment.nonce
  const network = request.query['network'] as Network
  const msgHash = secp256k1.CURVE.hash(new Uint8Array([parseInt(nonce, 16)]))
  const sig = secp256k1.Signature.fromCompact(commitment.s).addRecoveryBit(commitment.r)
  const pub = sig.recoverPublicKey(msgHash)
  const tx = btc.Transaction.fromPSBT(hexToBytes(commitment.psbt))
  const output = tx.getOutput(0)
  const p2wsh = btc.p2wsh(btc.p2ms(2, [hdKey.publicKey, pub.toRawBytes()]), btcNetwork(network))
  if (output.script?.length != p2wsh.script.length || !output.script?.every((v, i) => v === p2wsh.script?.[i]))
    throw new Error('psbt does not match commitment')
  if (!secp256k1.verify(commitment.s, msgHash, pub.toHex())) throw new Error('verify commitment signature failed')
  await kv.multi().hsetnx(txid, nonce, commitment).lpush(network, commitment).exec()

  return response.status(200).send('')
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    switch (request.method) {
      case 'GET':
        return get(request, response)

      case 'POST':
        return post(request, response)
    }
  } catch (err) {
    if (err instanceof Error) {
      console.log(err)
      response.status(400).send(err.message)
    } else {
      console.error(err)
      response.status(500).send('unknown error')
    }
    return
  }
}
