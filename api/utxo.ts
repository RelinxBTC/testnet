import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { getSupplyP2tr } from '../api_lib/depositAddress.js'
import { getJson } from '../lib/fetch.js'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const pubKey = request.query['pub'] as string
    if (!pubKey) throw new Error('missing public key')
    const address = request.query['address'] as string
    if (!address) throw new Error('missing output address')
    const network = (request.query['network'] as string) ?? ''
    const p2tr = getSupplyP2tr(pubKey)
    console.log('supply addr:' + p2tr.address)
    const lastBlock = await fetch(`https://mempool.space/${network}/api/blocks/tip/height`).then(getJson)
    console.log('lastBlock -> ' + lastBlock)
    const utxos: [] = await fetch(`https://mempool.space/${network}/api/address/${p2tr.address}/utxo`)
      .then(getJson)
      .then((utxos) =>
        utxos
          .map((utxo: any) => {
            if (utxo.status.confirmed && Number(lastBlock) - utxo.status.block_height > 10) {
              utxo.status.locked = false
            } else {
              utxo.status.locked = true
            }
            console.log('utxo:' + JSON.stringify(utxo))
            return utxo
          })
          .filter((utxo: any) => utxo != undefined)
      )
    response.status(200).send(utxos.reverse())
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
