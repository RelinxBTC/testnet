import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { getSupplyP2tr } from '../api_lib/depositAddress.js'
import { Network } from '../lib/types.js'
import { mempool } from '../api_lib/mempool.js'
import { getJson } from '../lib/fetch.js'
import { mempoolApiUrl } from '../lib/utils.js'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const pubKey = request.query['pub'] as string
    if (!pubKey) throw new Error('missing public key')
    const address = request.query['address'] as string
    if (!address) throw new Error('missing output address')
    const network = request.query['network'] as Network
    const p2tr = getSupplyP2tr(pubKey, network)
    console.log('supply addr:' + p2tr.address)
    const {
      bitcoin: { blocks }
    } = mempool(network)
    const lastBlock = await blocks.getBlocksTipHeight()
    console.log('lastBlock -> ' + lastBlock)
    const utxos: [] = await fetch(mempoolApiUrl(`/api/address/${p2tr.address}/utxo`, network))
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
