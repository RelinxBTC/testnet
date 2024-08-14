import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'
import { Network } from '../lib/types'

async function get(request: VercelRequest, response: VercelResponse) {
  const txid = request.query['txid'] as string
  const network = request.query['network'] as Network
  const commitments = await (txid ? kv.hgetall(txid) : kv.lrange(network, 0, 100))
  return response.status(200).send(commitments)
}

async function post(request: VercelRequest, response: VercelResponse) {
  const h = request.body as string
  const txid = request.query['txid'] as string
  const nonce = request.query['nonce'] as string
  const network = request.query['network'] as Network
  await kv.multi().hsetnx(txid, nonce, h).lpush(network, h).exec()

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
