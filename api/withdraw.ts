import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js'
import ecc from '@bitcoinerlab/secp256k1'
import { getSupplyP2tr, hdKey, scriptTLSC } from '../api_lib/depositAddress.js'
import { getJson } from '../lib/fetch.js'
import { protocolBalance } from '../api_lib/protocolBalance.js'
import { minimumFee } from '../api_lib/minimumFee.js'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const pubKey = request.query['pub'] as string
    const address = request.query['address'] as string
    if (!pubKey) throw new Error('missing public key')
    if (!address) throw new Error('missing output address')
    const redeem = {
      output: scriptTLSC(pubKey),
      redeemVersion: LEAF_VERSION_TAPSCRIPT
    }
    const p2tr = getSupplyP2tr(pubKey, redeem)
    const withdrawAmt = await protocolBalance(address, pubKey)
    console.log(p2tr.address, withdrawAmt)
    var value = 0
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
    const utxos: [] = await fetch(`https://mempool.space/testnet/api/address/${p2tr.address}/utxo`)
      .then(getJson)
      .then((utxos) =>
        utxos
          .map((utxo: any) => {
            console.log(utxo)
            if (utxo.value < 1000 || value > withdrawAmt.total) return
            value += utxo.value
            return {
              hash: Buffer.from(utxo.txid, 'hex').reverse(),
              index: utxo.vout,
              witnessUtxo: { value: utxo.value, script: p2tr.output! },
              tapLeafScript: [
                {
                  leafVersion: redeem.redeemVersion!,
                  script: redeem.output,
                  controlBlock: p2tr.witness![p2tr.witness!.length - 1]
                }
              ]
            }
          })
          .filter((utxo: any) => utxo != undefined)
      )
    utxos.forEach((utxo: any) => psbt.addInput(utxo))
    if (psbt.inputCount == 0) throw new Error('No UTXO can be withdrawn')
    psbt.addOutput({ address, value: withdrawAmt.total })
    psbt.signAllInputs(hdKey).finalizeAllInputs()

    const newFee = await minimumFee(psbt)
    console.log(newFee)
    var finalPsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
    // finalPsbt.setMaximumFeeRate(fastestFee + 1)
    utxos.forEach((utxo: any) => finalPsbt.addInput(utxo))
    finalPsbt.addOutput({ address, value: withdrawAmt.total - newFee })
    finalPsbt.signAllInputs(hdKey).finalizeAllInputs()

    var finalTx = finalPsbt.extractTransaction()

    console.log(finalTx.getId(), finalTx.toHex())
    finalTx.ins.forEach((i) =>
      console.log({
        ...i,
        hash: i.hash.toString('hex'),
        script: i.script.toString('hex'),
        scriptHash: p2tr.pubkey?.toString('hex'),
        scriptAddress: p2tr.address,
        witness: i.witness.map((w) => w.toString('hex'))
      })
    )
    console.log(bitcoin.Transaction.fromBuffer(finalTx.toBuffer()).ins[0].hash.toString('hex'))

    response.status(200).send({ psbt: finalPsbt.toHex() })
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
