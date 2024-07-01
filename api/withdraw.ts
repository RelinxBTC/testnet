import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import { getSupplyP2tr, hdKey } from '../api_lib/depositAddress.js'
import { getJson } from '../lib/fetch.js'
import { minimumFee } from '../api_lib/minimumFee.js'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { mempoolApiUrl } from '../lib/utils.js'
import { Network } from '../lib/types.js'
import { btcNetwork } from '../lib/network.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const pubKey = request.query['pub'] as string
    const address = request.query['address'] as string
    const utxo = request.query['utxo'] as string
    const network = request.query['network'] as Network
    if (!pubKey) throw new Error('missing public key')
    if (!address) throw new Error('missing output address')
    if (!address) throw new Error('missing network')

    var value = 0
    var utxoList
    if (utxo != undefined) {
      utxoList = [JSON.parse(utxo)]
    } else {
      const p2tr = getSupplyP2tr(pubKey, network)
      utxoList = await fetch(mempoolApiUrl(`/api/address/${p2tr.address}/utxo`, network)).then(getJson)
    }
    console.log('utxo is ---->', utxo)
    const utxos = utxoList
      .map((utxo: any) => {
        if (!utxo.status.confirmed && hex.decode(utxo.txid)[0] < 6)
          throw new Error(`MPC refused to sign withdraw from ${utxo.txid}`)
        const p2tr = getSupplyP2tr(pubKey, network, utxo.status.lock_blocks)
        value += utxo.value
        return {
          ...p2tr,
          txid: utxo.txid,
          index: utxo.vout,
          witnessUtxo: { script: p2tr.script, amount: BigInt(utxo.value) }
        }
      })
      .filter((utxo: any) => utxo != undefined)

    const tx = new btc.Transaction()
    utxos.forEach((utxo: any) => tx.addInput(utxo))
    if (tx.inputsLength == 0) throw new Error('No UTXO can be withdrawn')
    tx.sign(hdKey.privateKey!)

    const psbt = bitcoin.Psbt.fromBuffer(Buffer.from(tx.toPSBT()))
    const fee = await minimumFee(psbt.finalizeAllInputs().extractTransaction(true).virtualSize())
    const finalTx = new btc.Transaction()
    utxos.forEach((utxo: any) => finalTx.addInput(utxo))
    finalTx.addOutputAddress(address, BigInt(value - fee), btcNetwork(network))
    finalTx.sign(hdKey.privateKey!)

    response.status(200).send({ psbt: hex.encode(finalTx.toPSBT()) })
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
