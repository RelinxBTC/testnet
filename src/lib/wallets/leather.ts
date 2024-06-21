import { BaseWallet } from './base'
import { Balance, Inscription, Network, SignPsbtOptions } from '.'
import { getJson } from '../../../lib/fetch'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'

enum WalletDefaultNetworkConfigurationIds {
  mainnet = 'mainnet',
  testnet = 'testnet',
  signet = 'signet',
  sbtcDevenv = 'sbtcDevenv',
  devnet = 'devnet'
}

type DefaultNetworkConfigurations = keyof typeof WalletDefaultNetworkConfigurationIds

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
  network?: DefaultNetworkConfigurations
  signAtIndex?: number | number[]
}

export class Leather extends BaseWallet {
  private _network: Network = (localStorage.getItem('leather_network') as Network) ?? 'livenet'
  private addressesPromise: any

  private get mempoolUrl() {
    var baseUrl = 'https://mempool.space'
    if (this._network != 'livenet') baseUrl += `/${this._network}`
    return baseUrl
  }

  protected get instance() {
    return (window as any).LeatherProvider
  }

  get network() {
    return Promise.resolve(this._network)
  }

  switchNetwork(network: Network): Promise<void> {
    this._network = network
    localStorage.setItem('leather_network', network)
    return Promise.resolve()
  }

  get accounts() {
    return (
      this.addressesPromise?.then((addresses: any) =>
        addresses
          .map((addr: any) => {
            if (addr.symbol == 'BTC' && addr.type == 'p2wpkh') return addr.address
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
        if (accounts[0]) return fetch(`${this.mempoolUrl}/api/address/${accounts[0]}`)
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
    return this.instance
      .request('sendTransfer', {
        recipients: [
          {
            address: toAddress,
            amount: satoshis
          }
        ],
        network: this._network
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
    const requestParams: SignPsbtRequestParams = { hex: psbtHex, signAtIndex }

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
    return fetch(`${this.mempoolUrl}/api/tx`, {
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
}
