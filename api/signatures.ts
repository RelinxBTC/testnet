import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToNumberBE, hexToNumber } from '@noble/curves/abstract/utils'

async function get(request: VercelRequest, response: VercelResponse) {
  const txid = request.query['txid'] as string
  const nonce = request.query['nonce'] as string
  const signatures = await kv.hgetall(`${txid}:${nonce}`)
  return response.status(200).send(signatures)
}

async function post(request: VercelRequest, response: VercelResponse) {
  const h = request.body as string
  const txid = request.query['txid'] as string
  const nonce = request.query['nonce'] as string
  const msg = request.query['msg'] as string

  const commitment = (await kv.hget(txid, nonce)) as any
  if (!commitment) throw new Error('commitment not found')
  const signature = secp256k1.Signature.fromCompact(commitment.s as string).addRecoveryBit(commitment?.r as number)
  const A = signature.recoverPublicKey(secp256k1.CURVE.hash(new Uint8Array([parseInt(nonce, 16)])))
  // signature.r = r*A + m*G
  const r = hexToNumber(h)
  const msgHash = secp256k1.CURVE.hash(msg)
  const m = bytesToNumberBE(msgHash)
  if (A.multiply(r).add(secp256k1.ProjectivePoint.BASE.multiply(m)).x != signature.r)
    throw new Error('signature mismatch')

  await kv.hsetnx(`${txid}:${nonce}`, msg, h)

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
