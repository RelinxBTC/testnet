import { BaseWallet } from './base'
import type { Balance, Inscription, Network, SignPsbtOptions, WalletEvent, WalletType } from '.'
import { getJson } from '../../../lib/fetch'
import { getWallets } from '@wallet-standard/app'
import type { Wallet } from '@wallet-standard/base'
import {
  Address,
  AddressPurpose,
  BitcoinNetworkType,
  BitcoinProvider,
  getAddress,
  sendBtcTransaction,
  signTransaction
} from 'sats-connect-v1'
import { base64, hex } from '@scure/base'
import * as btc from '@scure/btc-signer'
import { mempoolApiUrl } from './utils'

const SatsConnectNamespace = 'sats-connect:'

type SatsConnectFeature = {
  [SatsConnectNamespace]: {
    provider: BitcoinProvider
  }
}

export function Wallets(): Wallet[] {
  return getWallets()
    .get()
    .filter((v) => (v.features[SatsConnectNamespace] ? v : null))
}

export class WalletStandard extends BaseWallet {
  private _wallet: Wallet
  private _provider?: BitcoinProvider
  private _addresses?: Address[]
  private _network: Network = (localStorage.getItem('satsconnect_network') as Network) ?? 'livenet'
  constructor(type: WalletType) {
    super()
    const wallet = Wallets().find((v) => (v.name == type ? v : null))
    if (!wallet) throw new Error(`wallet ${type} not found`)
    this._wallet = wallet
    this._provider = (wallet.features as SatsConnectFeature)[SatsConnectNamespace].provider
  }

  private get getProvider(): () => Promise<BitcoinProvider | undefined> {
    return () => Promise.resolve(this._provider)
  }

  get installed() {
    return this._wallet != undefined
  }

  get network() {
    return Promise.resolve(this._network)
  }

  switchNetwork(network: Network): Promise<void> {
    if (network != 'livenet') return Promise.reject(new Error(`${network} not supported`))
    return Promise.resolve()
  }

  get accounts() {
    return Promise.resolve(this._addresses?.map((v) => v.address) ?? [])
  }

  requestAccounts(): Promise<string[]> {
    return new Promise((resolve, reject) =>
      getAddress({
        getProvider: this.getProvider,
        payload: {
          purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment],
          message: 'Address for receiving Ordinals and payments',
          network: {
            type: this._network == 'livenet' ? BitcoinNetworkType.Mainnet : BitcoinNetworkType.Testnet
          }
        },
        onFinish: (response) => {
          this._addresses = response.addresses
          resolve(this._addresses.map((v) => v.address))
        },
        onCancel: () => reject('Request canceled')
      })
    )
  }

  get publicKey() {
    return Promise.resolve(this._addresses?.[0].publicKey ?? '')
  }

  get balance(): Promise<Balance> {
    return this.accounts
      .then((accounts: any) => fetch(`https://mempool.space/${this._network}/api/address/${accounts[0]}`))
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

  on(event: WalletEvent, handler: (accounts: Array<string>) => void) {
    console.warn(`${this._wallet.name} does not support event listening`)
  }

  removeListener() {
    console.warn(`${this._wallet.name} does not support event listening`)
  }

  sendBitcoin(toAddress: string, satoshis: number, options?: { feeRate: number }): Promise<string> {
    if (options?.feeRate) console.warn(`feeRate is not supported in ${this._wallet.name}`)
    return new Promise((resolve, reject) =>
      sendBtcTransaction({
        payload: {
          recipients: [{ address: toAddress, amountSats: BigInt(satoshis) }],
          senderAddress: this._addresses![0].address,
          network: { type: BitcoinNetworkType.Mainnet }
        },
        onFinish: (response) => resolve(response),
        onCancel: () => reject('Request canceled')
      })
    )
  }

  getInscriptions(cursor?: number, size?: number): Promise<{ total: number; list: Inscription[] }> {
    throw new Error('not implemented')
  }

  sendInscription(toAddress: string, inscriptionId: string, options?: { feeRate: number }): Promise<string> {
    throw new Error('not implemented')
  }

  signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
    return new Promise((resolve, reject) =>
      signTransaction({
        payload: {
          psbtBase64: base64.encode(hex.decode(psbtHex)),
          message: '',
          inputsToSign: [
            {
              address: this._addresses![0].address,
              signingIndexes:
                options?.toSignInputs.map((i) => i.index) ??
                Array.from(
                  { length: btc.Transaction.fromPSBT(hex.decode(psbtHex), { allowUnknownInputs: true }).inputsLength },
                  (_, i) => i + 1
                )
            }
          ],
          network: { type: BitcoinNetworkType.Mainnet }
        },
        onFinish: (response) => resolve(response.psbtBase64),
        onCancel: () => reject('Request canceled')
      })
    )
  }

  signPsbts(psbtHexs: string[], options?: SignPsbtOptions): Promise<string[]> {
    return this.instance.signPsbts(psbtHexs, options)
  }

  pushPsbt(psbtHex: string): Promise<string> {
    return fetch(mempoolApiUrl('/api/tx', this._network), {
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
