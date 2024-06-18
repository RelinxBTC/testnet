import { BaseWallet } from './base'
import { Balance, Inscription, Network, SignPsbtOptions, WalletEvent } from '.'
import { getJson } from '../../../lib/fetch'

export class OKX extends BaseWallet {
  private _network: Network = (localStorage.getItem('okx_network') as Network) ?? 'livenet'
  private _instanceTestnet: any = this.instanceTestnet
  private get instanceTestnet() {
    switch (this._network) {
      case 'signet':
        return (window as any).okxwallet?.bitcoinSignet
      case 'testnet':
        return (window as any).okxwallet?.bitcoinTestnet
    }
    return null
  }

  protected get instance() {
    return (window as any).okxwallet?.bitcoin
  }

  get network() {
    return Promise.resolve(this._network)
  }

  switchNetwork(network: Network): Promise<void> {
    this._network = network
    localStorage.setItem('okx_network', network)
    this._instanceTestnet = this.instanceTestnet()
    return Promise.resolve()
  }

  get accounts() {
    return this._instanceTestnet
      ? this._instanceTestnet.getSelectedAddress().then((result: any) => [result])
      : this.instance.getAccounts()
  }

  requestAccounts() {
    return this._instanceTestnet
      ? this._instanceTestnet.connect().then((result: any) => [result.address])
      : this.instance.requestAccounts()
  }

  get publicKey() {
    return this._instanceTestnet
      ? this._instanceTestnet.getSelectedAccount().then((result: any) => [result.publicKey])
      : this.instance.getPublicKey()
  }

  get balance(): Promise<Balance> {
    if (this._network == 'livenet') return this.instance.getBalance()

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
    this.instance.on(
      event,
      this._network == 'livenet'
        ? handler
        : () => {
            this.requestAccounts().then(handler)
          }
    )
  }

  sendBitcoin(toAddress: string, satoshis: number, options?: { feeRate: number }): Promise<string> {
    if (this._network != 'livenet') throw new Error('not implemented')
    return this.instance.sendBitcoin(toAddress, satoshis, options)
  }

  getInscriptions(cursor?: number, size?: number): Promise<{ total: number; list: Inscription[] }> {
    if (this._network != 'livenet') throw new Error('not implemented')
    return this.instance.getInscriptions(cursor, size)
  }

  sendInscription(toAddress: string, inscriptionId: string, options?: { feeRate: number }): Promise<string> {
    if (this._network != 'livenet') throw new Error('not implemented')
    return this.instance.sendInscription(toAddress, inscriptionId, options)
  }

  signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
    return (this._instanceTestnet ?? this.instance).signPsbt(psbtHex, options)
  }

  signPsbts(psbtHexs: string[], options?: SignPsbtOptions): Promise<string[]> {
    return (this._instanceTestnet ?? this.instance).signPsbts(psbtHexs, options)
  }

  pushPsbt(psbtHex: string): Promise<string> {
    if (this._network != 'livenet') throw new Error('not implemented')
    return this.instance.pushPsbt(psbtHex)
  }
}
