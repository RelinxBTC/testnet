import type { VercelRequest, VercelResponse } from '@vercel/node'
import { hdKey } from '../api_lib/depositAddress.js'

export default async function handler(_: VercelRequest, response: VercelResponse) {
  try {
    response.status(200).send({ key: hdKey.publicKey.toString('hex') })
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
