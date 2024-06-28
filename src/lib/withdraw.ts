import { walletState } from './walletState'
import { getJson } from '../../lib/fetch'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { scriptTLSC } from '../../lib/tlsc'
import { toast, toastImportant } from './toast'
import { btcNetwork } from '../../lib/network'

export async function withdrawMPC(utxo: any) {
  return Promise.all([walletState.connector!.publicKey, walletState.connector?.accounts])
    .then(async ([publicKey, accounts]) => {
      var { alert } = toastImportant(`Sending sign request to MPC nodes because of utxo's locking status.`)
      var uri = `/api/withdraw?pub=${publicKey}&address=${accounts?.[0]}&network=${walletState.network}`
      if (utxo != undefined) {
        uri = uri + `&utxo=${encodeURI(JSON.stringify(utxo))}`
      }
      console.log(uri)
      var res = await fetch(uri).then(getJson)
      await alert.hide()
      if (!res.psbt) {
        toastImportant('withdraw tx not generated', res)
        return
      }
      var tx = btc.Transaction.fromPSBT(hex.decode(res.psbt))
      var toSignInputs = []
      for (var i = 0; i < tx.inputsLength; i++) toSignInputs.push({ index: i, publicKey, disableTweakSigner: true })
      walletState.connector
        ?.signPsbt(res.psbt, { autoFinalized: true, toSignInputs })
        .then((hex) => walletState.connector?.pushPsbt(hex))
        .then((tx) => {
          console.log(tx)
          toastImportant(
            `Your transaction <a href="${walletState.mempoolUrl}/tx/${tx}">${tx}</a> has been sent to network.`
          )
          walletState.updateProtocolBalance()
          walletState.updateBalance()
          walletState.updateUTXOs()
        })
        .catch((e) => {
          console.warn(e)
          toast(e)
        })
    })
    .catch((e) => {
      console.error(e)
      toastImportant(e)
    })
}

export async function withdrawWithoutMPC(utxoList: any) {
  return Promise.all([
    walletState.connector!.publicKey,
    walletState.connector?.accounts,
    fetch(`/api/mpcPubkey`).then(getJson),
    fetch(walletState.mempoolApiUrl('/api/v1/fees/recommended')).then(getJson)
  ])
    .then(async ([publicKey, accounts, { key: mpcPubkey }, feeRates]) => {
      const p2tr = btc.p2tr(
        undefined,
        { script: scriptTLSC(hex.decode(mpcPubkey), hex.decode(publicKey)) },
        btcNetwork(walletState.network),
        true
      )
      var value = 0
      if (utxoList.length == 0) {
        utxoList = await fetch(walletState.mempoolApiUrl(`/api/address/${p2tr.address}/utxo`)).then(getJson)
      }
      const utxos = utxoList
        .map((utxo: any) => {
          if (!utxo.status.confirmed) return undefined // unconfirmed utxo can not be withdraw without MPC
          value += utxo.value
          return {
            ...p2tr,
            txid: utxo.txid,
            index: utxo.vout,
            sequence: 1,
            witnessUtxo: { script: p2tr.script, amount: BigInt(utxo.value) }
          }
        })
        .filter((utxo: any) => utxo != undefined)

      const tx = new btc.Transaction()
      utxos.forEach((utxo: any) => tx.addInput(utxo))
      if (tx.inputsLength == 0) throw new Error('No UTXO can be withdrawn')

      // fee may not be enough, but we can not get vsize before sign and finalize
      const newFee = Math.max(300, feeRates.minimumFee, (tx.toPSBT().byteLength * feeRates.fastestFee) / 4)
      tx.addOutputAddress(accounts![0], BigInt((value - newFee).toFixed()), btcNetwork(walletState.network))

      var toSignInputs: any = []
      for (var i = 0; i < tx.inputsLength; i++) toSignInputs.push({ index: i, publicKey, disableTweakSigner: true })
      return walletState.connector
        ?.signPsbt(hex.encode(tx.toPSBT()), { toSignInputs })
        .then((psbtHex) => {
          const finalTx = btc.Transaction.fromPSBT(hex.decode(psbtHex), { allowUnknownInputs: true })
          if (!finalTx.isFinal) finalTx.finalize()

          const minimumFee = finalTx.vsize * feeRates.minimumFee
          const fastestFee = finalTx.vsize * feeRates.fastestFee
          if (minimumFee <= finalTx.fee) return finalTx

          const errMsg = new Error(
            `We need to sign tx again because minimum fee not met, we are ${finalTx.fee}, minimum is ${minimumFee}, fastest is ${fastestFee}`
          )
          toastImportant(errMsg)
          console.log(errMsg)
          tx.updateOutput(0, { amount: BigInt((value - fastestFee).toFixed()) })
          return walletState
            .connector!.signPsbt(hex.encode(tx.toPSBT()), { autoFinalized: true, toSignInputs })
            .then((psbtHex) => btc.Transaction.fromPSBT(hex.decode(psbtHex)))
        })
        .then((finalTx: btc.Transaction) => {
          return fetch(walletState.mempoolApiUrl('/api/tx'), {
            method: 'POST',
            body: hex.encode(finalTx.extract())
          })
        })
        .then((res) => {
          if (res.status == 200) {
            return res.text()
          }
          return res.text().then((text) => {
            console.error(res.status, text, res)
            throw new Error(text)
          })
        })
        .then((tx) => {
          toastImportant(
            `Your transaction <a href="${walletState.mempoolUrl}/tx/${tx}">${tx}</a> has been sent to network.`
          )
          walletState.updateProtocolBalance()
          walletState.updateBalance()
          walletState.updateUTXOs()
        })
        .catch((e) => {
          console.warn(e)
          toast(e)
        })
    })
    .catch((e) => {
      console.error(e)
      toastImportant(e)
    })
}
