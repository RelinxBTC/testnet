import { Balance, Inscription, Network, SignPsbtOptions, Wallet } from '.'
import { getJson } from '../../../lib/fetch'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { mempoolApiUrl } from '../../../lib/utils'
import { btcNetwork } from '../../../lib/network'
import { AddressType, getAddressInfo } from 'bitcoin-address-validation'

enum LeatherNetworks {
  mainnet = 'mainnet',
  testnet = 'testnet',
  signet = 'signet',
  sbtcDevenv = 'sbtcDevenv',
  devnet = 'devnet'
}

type LeatherNetwork = keyof typeof LeatherNetworks

enum SignatureHash {
  DEFAULT = 0x00,
  ALL = 0x01,
  NONE = 0x02,
  SINGLE = 0x03,
  ALL_ANYONECANPAY = 0x81,
  NONE_ANYONECANPAY = 0x82,
  SINGLE_ANYONECANPAY = 0x83
}

interface SignPsbtRequestParams {
  account?: number
  allowedSighash?: SignatureHash[]
  broadcast?: boolean
  hex: string
  network?: LeatherNetwork
  signAtIndex?: number | number[]
}

export class Leather implements Wallet {
  private _network: Network = (localStorage.getItem('leather_network') as Network) ?? 'testnet'
  private addressesPromise: any

  private mempoolApiUrl(path: string): string {
    return mempoolApiUrl(path, this._network)
  }

  protected get instance() {
    return (window as any).LeatherProvider
  }

  get installed() {
    return typeof this.instance !== 'undefined'
  }

  private get leatherNetwork(): LeatherNetwork {
    switch (this._network) {
      case 'livenet':
        return 'mainnet'
      default:
        return this._network
    }
  }

  get network() {
    return Promise.resolve(this._network)
  }

  switchNetwork(network: Network): Promise<void> {
    if (this._network != 'livenet' && network != 'livenet') {
      this._network = network
      localStorage.setItem('leather_network', network)
      return Promise.resolve()
    }
    return Promise.reject(new Error('You need to change network in your Leather wallet and then reconnect'))
  }

  get accounts() {
    return (
      this.addressesPromise?.then((addresses: any) =>
        addresses
          .map((addr: any) => {
            if (addr.symbol == 'BTC' && addr.type == 'p2wpkh') {
              const network = getAddressInfo(addr.address).network
              if (network == 'mainnet') this._network = 'livenet'
              else if (network == 'testnet') {
                if (this._network == 'livenet') this._network = 'testnet'
                else if (this._network == 'devnet')
                  // transform address as pubkey is same
                  return btc.p2wpkh(hex.decode(addr.publicKey), btcNetwork('devnet')).address
              } else if (network == 'regtest') {
                if (this._network == 'livenet') this._network = 'devnet'
                else if (this._network != 'devnet')
                  // transform address as pubkey is same
                  return btc.p2wpkh(hex.decode(addr.publicKey), btc.TEST_NETWORK).address
              }
              return addr.address
            }
            return undefined
          })
          .filter((addr: any) => addr != undefined)
      ) ?? Promise.resolve([])
    )
  }

  requestAccounts() {
    this.addressesPromise ??= this.instance
      .request('getAddresses')
      .then((response: any) => response.result.addresses)
      .catch((e: any) => {
        throw e.error
      })
    return this.accounts
  }

  get publicKey() {
    return (
      this.addressesPromise?.then(
        (addresses: any) =>
          addresses
            .map((addr: any) => {
              if (addr.symbol == 'BTC' && addr.type == 'p2wpkh') return addr.publicKey
              return undefined
            })
            .filter((addr: any) => addr != undefined)?.[0]
      ) ?? Promise.resolve('')
    )
  }

  get balance(): Promise<Balance> {
    return this.accounts
      .then((accounts: any) => {
        if (accounts[0]) return fetch(this.mempoolApiUrl(`/api/address/${accounts[0]}`))
        throw new Error('wallet not connected')
      })
      .then(getJson)
      .then((result: any) => {
        return {
          confirmed: result.chain_stats.funded_txo_sum - result.chain_stats.spent_txo_sum,
          unconfirmed: result.mempool_stats.funded_txo_sum - result.mempool_stats.spent_txo_sum,
          total:
            result.chain_stats.funded_txo_sum -
            result.chain_stats.spent_txo_sum +
            result.mempool_stats.funded_txo_sum -
            result.mempool_stats.spent_txo_sum
        }
      })
  }

  on() {
    console.warn('Leather does not support event listening')
  }

  removeListener() {
    console.warn('Leather does not support event listening')
  }

  sendBitcoin(toAddress: string, satoshis: number, options?: { feeRate: number }): Promise<string> {
    if (options?.feeRate) console.warn('feeRate not supported in Leather')
    // workaround for devnet as https://github.com/leather-io/extension/issues/4874
    if (this._network == 'devnet') {
      var account: any
      var p2ret: any
      return Promise.all([this.accounts, this.publicKey])
        .then(([accounts, pubKeyStr]) => {
          const { type } = getAddressInfo(accounts[0])
          const pubKey = hex.decode(pubKeyStr)
          switch (type) {
            case AddressType.p2wpkh:
              p2ret = btc.p2wpkh(pubKey, btcNetwork('devnet'))
              break
            case AddressType.p2pkh:
              p2ret = btc.p2pkh(pubKey, btcNetwork('devnet'))
              break
            default:
              throw new Error(`${type} is not implemented in sendBitcoin`)
          }
          if (accounts[0]) {
            account = accounts[0]
            return fetch(this.mempoolApiUrl(`/api/address/${accounts[0]}/utxo`)).then(getJson)
          }
          throw new Error('wallet not connected')
        })
        .then(
          async (utxos) =>
            await Promise.all(
              utxos.map(async (utxo: any) => {
                return {
                  ...p2ret,
                  txid: utxo.txid,
                  index: utxo.vout,
                  nonWitnessUtxo: (p2ret.type as string).startsWith('w')
                    ? undefined
                    : await fetch(this.mempoolApiUrl(`/api/tx/${utxo.txid}/hex`)),
                  witnessUtxo: (p2ret.type as string).startsWith('w')
                    ? { script: p2ret.script, amount: BigInt(utxo.value) }
                    : undefined
                }
              })
            )
        )
        .then((utxos) =>
          btc.selectUTXO(utxos, [{ address: toAddress, amount: BigInt(satoshis) }], 'default', {
            changeAddress: account, // required, address to send change
            feePerByte: BigInt(options?.feeRate ?? 1), // require, fee per vbyte in satoshi
            bip69: true, // lexicographical Indexing of Transaction Inputs and Outputs
            createTx: true, // create tx with selected inputs/outputs
            network: btcNetwork('devnet')
          })
        )
        .then((selected) => {
          if (!selected) throw new Error('not enough fund')
          return this.instance
            .request('signPsbt', {
              hex: hex.encode(selected!.tx!.toPSBT()),
              network: 'devnet',
              broadcast: true
            })
            .then((response: any) => {
              console.debug('signPsbt returns', response)
              const txid = response.result.txid
              if (txid) return txid
              const finalTx = btc.Transaction.fromPSBT(hex.decode(response.result.hex), { allowUnknownInputs: true })
              finalTx.finalize()
              return finalTx.id
            })
            .catch((e: any) => {
              console.warn(e)
              throw e.error
            })
        })
    }
    return this.instance
      .request('sendTransfer', {
        recipients: [
          {
            address: toAddress,
            amount: satoshis
          }
        ],
        network: this.leatherNetwork
      })
      .then((response: any) => response.result.txid)
      .catch((e: any) => {
        throw e.error
      })
  }

  getInscriptions(): Promise<{ total: number; list: Inscription[] }> {
    throw new Error('not implemented')
  }

  sendInscription(): Promise<string> {
    throw new Error('not implemented')
  }

  signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
    const signAtIndex: number[] | undefined = options?.toSignInputs.map((i) => i.index)
    const requestParams: SignPsbtRequestParams = { hex: psbtHex, network: this.leatherNetwork, signAtIndex }

    return this.instance
      .request('signPsbt', requestParams)
      .then((response: any) => {
        const psbtHex = response.result.hex
        if (options?.autoFinalized) {
          const finalTx = btc.Transaction.fromPSBT(hex.decode(psbtHex), { allowUnknownInputs: true })
          finalTx.finalize()
          return hex.encode(finalTx.toPSBT())
        }
        return psbtHex
      })
      .catch((e: any) => {
        console.warn(e)
        throw e.error
      })
  }

  signPsbts(psbtHexs: string[], options?: SignPsbtOptions): Promise<string[]> {
    return Promise.all(psbtHexs.map((psbt) => this.signPsbt(psbt, options)))
  }

  pushPsbt(psbtHex: string): Promise<string> {
    return fetch(this.mempoolApiUrl('/api/tx'), {
      method: 'POST',
      body: hex.encode(btc.Transaction.fromPSBT(hex.decode(psbtHex), { allowUnknownInputs: true }).extract())
    }).then((res) => {
      if (res.status == 200) {
        return res.text()
      }
      return res.text().then((text) => {
        console.error(res.status, text, res)
        throw new Error(text)
      })
    })
  }

  signMessage(message: string): Promise<string> {
    return this.instance
      .request('signMessage', {
        message: message,
        network: this.leatherNetwork
      })
      .then((response: any) => response.result.signature)
  }
}
