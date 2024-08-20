import type { VercelRequest, VercelResponse } from '@vercel/node'
import { hdKey } from '../api_lib/depositAddress.js'
import { minimumFee } from '../api_lib/minimumFee.js'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { Network } from '../lib/types.js'
import { btcNetwork } from '../lib/network.js'
import { kv } from '@vercel/kv'
import { bytesToNumberBE, hexToBytes, numberToBytesBE } from '@noble/curves/abstract/utils'
import { secp256k1 } from '@noble/curves/secp256k1'
import { modN, invN } from '../lib/mod.js'
import { validate } from 'bitcoin-address-validation'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const network = request.query['network'] as Network
    if (!network) throw new Error('missing network')
    const address = request.query['address'] as string
    if (!address || !validate(address)) throw new Error('bad output address')
    const txid = request.query['txid'] as string
    if (!txid) throw new Error('missing txid')
    const nonce = request.query['nonce'] as string
    if (!nonce) throw new Error('missing commitment nonce')

    const commitment = (await kv.hget(txid, nonce)) as any
    if (!commitment?.psbt) throw new Error('commitment not found')
    const tx = btc.Transaction.fromPSBT(hexToBytes(commitment.psbt as string), { allowUnknownInputs: true })
    const signatures = await kv.hgetall(`${txid}:${nonce}`)
    if (!signatures?.up || !signatures?.down) throw new Error('failed to extract key, not enough signatures')

    const { up: r1, down: r2 } = signatures
    const [m1, m2] = ['up', 'down'].map((msg) => bytesToNumberBE(secp256k1.CURVE.hash(msg)))
    // a=(m1-m2)/(r2-r1)
    const a = modN(modN(m1 - m2) * invN(BigInt('0x' + r2) - BigInt('0x' + r1)))
    const pub = secp256k1.getPublicKey(a)
    const p2wsh = btc.p2wsh(btc.p2ms(2, [hdKey.publicKey, pub]), btcNetwork(network))
    const output = tx.getOutput(0)
    if (output.script?.length != p2wsh.script.length || !output.script?.every((v, i) => v === p2wsh.script?.[i]))
      throw new Error('extracted key does not match commitment')

    tx.sign(hdKey.privateKey!)
    tx.finalize()
    const tx2 = new btc.Transaction()
    const amount = tx.getOutput(0).amount!
    tx2.addInput({ ...p2wsh, txid: tx.id, index: 0, witnessUtxo: { script: p2wsh.script, amount } })
    tx2.addOutputAddress(address, amount, btcNetwork(network))
    tx2.sign(hdKey.privateKey!)
    tx2.sign(numberToBytesBE(a, 32))
    tx2.finalize()

    const fee = await minimumFee(tx2.vsize)
    const finalTx = new btc.Transaction()
    finalTx.addInput({ ...p2wsh, txid: tx.id, index: 0, witnessUtxo: { script: p2wsh.script, amount } })
    finalTx.addOutputAddress(address, amount - BigInt(fee), btcNetwork(network))
    finalTx.sign(hdKey.privateKey!)
    finalTx.sign(numberToBytesBE(a, 32))
    finalTx.finalize()
    response.status(200).send([tx, finalTx].map((tx) => hex.encode(tx.extract())))
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
