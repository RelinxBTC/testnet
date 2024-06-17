import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js'
import ecc from '@bitcoinerlab/secp256k1'
import { getSupplyP2tr } from '../api_lib/depositAddress.js'
import { getJson } from '../lib/fetch.js'
import { protocolBalance } from '../api_lib/protocolBalance.js'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const pubKey = request.query['pub'] as string
    const address = request.query['address'] as string
    if (!pubKey) throw new Error('missing public key')
    if (!address) throw new Error('missing output address')
    const p2tr = getSupplyP2tr(pubKey)
    const withdrawAmt = await protocolBalance(address, pubKey)
    console.log(p2tr.address, withdrawAmt)
    var value = 0
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
    const utxos: [] = await fetch(`https://mempool.space/testnet/api/address/${p2tr.address}/utxo`)
      .then(getJson)
      .then((utxos) =>
        utxos.filter((utxo: any) => utxo != undefined)
      )
    response.status(200).send(utxos)
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
