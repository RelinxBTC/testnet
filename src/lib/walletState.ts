import { State, property, storage } from '@lit-app/state'
import { Balance, Network, Wallet, WalletType } from './wallets'
import { UniSat } from './wallets/unisat'
import { OKX } from './wallets/okx'
import { Leather } from './wallets/leather'
import { WalletStandard } from './wallets/walletStandard'
import { getJson } from '../../lib/fetch'
import * as btc from '@scure/btc-signer'
import { scriptTLSC } from '../../lib/tlsc'
import { btcNetwork } from '../../lib/network'
import { hex } from '@scure/base'
import { mempoolApiUrl } from '../../lib/utils'

export { StateController, type Unsubscribe } from '@lit-app/state'

export type Brc20Balance = {
  ticker: string
  decimals: number
  availableBalance: string
  transferableBalance: string
  overallBalance: string
}

export type UTXO = {
  txid: string
  vout: number
  status: {
    confirmed: boolean
    block_height: number
    block_hash: string
    block_time: number
    locked: boolean
  }
  value: number
}

class WalletState extends State {
  @storage({ key: 'wallet' }) @property() wallet?: WalletType
  private promises: Record<string, Promise<any>> = {}

  // ---- address ----
  @property({ skipReset: true }) private _address?: string
  public get address(): string | undefined {
    if (!this._address) this.updateAddress()
    return this._address
  }
  public async getAddress() {
    return this._address ?? this.updateAddress()
  }

  public async updateAddress(): Promise<string> {
    return (this.promises['address'] ??= this.getConnector()
      .then((connector) => connector.accounts)
      .then((accounts) => (this._address = accounts[0]))
      .finally(() => delete this.promises['address']))
  }

  protected onAccountChanged = (accounts: string[]) => {
    this.reset(false)
    if (accounts) this._address = accounts[0]
  }

  // ---- network ----
  @property() private _network?: Network
  public get network(): Network | undefined {
    if (this._network) return this._network
    this.updateNetwork()
  }
  public async getNetwork() {
    if (this._network) return this._network
    return await this.updateNetwork()
  }

  public async updateNetwork() {
    return (this.promises['network'] ??= this.getConnector()
      .then((connector) => connector.network)
      .then((network) => (this._network = network))
      .finally(() => delete this.promises['network']))
  }
  public switchNetwork(network: Network) {
    this.connector?.switchNetwork(network)
    this.updateNetwork()
  }

  public mempoolApiUrl(path: string): string {
    return mempoolApiUrl(path, this._network)
  }
  public get mempoolUrl(): string {
    if (this._network == 'devnet') return 'http://localhost:8083'
    return 'https://mempool.space' + (this._network != 'livenet' ? `/${this._network}` : '')
  }

  // ---- public key ----
  @property() private _publicKey?: string
  public get publicKey(): string | undefined {
    if (this._publicKey) return this._publicKey
    this.updatePublicKey()
  }
  public async getPublicKey() {
    if (this._publicKey) return this._publicKey
    return await this.updatePublicKey()
  }

  public async updatePublicKey() {
    return (this.promises['publicKey'] ??= this.getConnector()
      .then((connector) => connector.publicKey)
      .then((pubKey) => (this._publicKey = pubKey))
      .finally(() => delete this.promises['publicKey']))
  }

  // ---- MPC public key ----
  @property() private _mpcPublicKey?: string
  public get mpcPublicKey(): string | undefined {
    if (this._mpcPublicKey) return this._mpcPublicKey
    this.updateMpcPublicKey()
  }

  public getMpcPublicKey(): Promise<string> {
    return this._mpcPublicKey ? Promise.resolve(this._mpcPublicKey) : this.updateMpcPublicKey()
  }

  public updateMpcPublicKey(): Promise<string> {
    return (this.promises['mpcPublicKey'] ??= fetch('/api/mpcPubkey')
      .then(getJson)
      .then(({ key: mpcPubkey }) => mpcPubkey)
      .finally(() => delete this.promises['mpcPublicKey']))
  }

  // ---- deposit address ----
  @property() private _depositaddress?: string
  public get depositaddress(): string | undefined {
    if (this._depositaddress) return this._depositaddress
    this.updateDepositAddress()
  }
  public async getDepositAddress() {
    return this._depositaddress ?? this.updateDepositAddress()
  }

  public async updateDepositAddress() {
    return (this.promises['depositAddress'] ??= Promise.all([
      this.getPublicKey(),
      this.getMpcPublicKey(),
      this.getNetwork()
    ])
      .then(
        ([publicKey, mpcPubkey, network]) =>
          btc.p2tr(
            undefined,
            { script: scriptTLSC(hex.decode(mpcPubkey), hex.decode(publicKey)) },
            btcNetwork(network),
            true
          ).address
      )
      .finally(() => delete this.promises['depositAddress']))
  }

  // ---- balance ----
  @property({ type: Object }) private _balance?: Balance
  public get balance(): Balance | undefined {
    if (this._balance) return this._balance
    this.updateBalance()
  }

  public async getBalance() {
    return this._balance ?? this.updateBalance()
  }

  public async updateBalance(): Promise<Balance> {
    return (this.promises['balance'] ??= this.getConnector()
      .then((connector) => connector.balance)
      .then((balance) => {
        console.log('update balance:', JSON.stringify(balance))
        this._balance = balance
        return balance
      })
      .finally(() => delete this.promises['balance']))
  }

  // ---- protocol balance ----
  @property({ type: Object }) private _protocolBalance?: Balance
  public get protocolBalance(): Balance | undefined {
    if (this._protocolBalance) return this._protocolBalance
    this.updateProtocolBalance()
  }

  public async getProtocolBalance() {
    return this._protocolBalance ?? this.updateProtocolBalance()
  }

  public async updateProtocolBalance(): Promise<Balance> {
    return (this.promises['protocolBalance'] ??= Promise.all([
      this.getAddress(),
      this.getPublicKey(),
      this.getNetwork()
    ])
      .then(([address, publicKey, network]) => {
        if (address && publicKey)
          return fetch(`/api/protocolBalance?address=${address}&pub=${publicKey}&network=${network}`)
        throw new Error('wallet not connected')
      })
      .then(getJson)
      .then((balance) => (this._protocolBalance = balance))
      .finally(() => delete this.promises['protocolBalance']))
  }

  // --- utxos ----
  @property({ type: Array }) private _utxos?: UTXO[]
  public get utxos(): UTXO[] | undefined {
    if (this._utxos) return this._utxos
    this.updateUTXOs()
  }

  public async updateUTXOs(): Promise<UTXO[]> {
    return (this.promises['utxos'] ??= this.getDepositAddress()
      .then((depositAddress) =>
        Promise.all([
          fetch(this.mempoolApiUrl('/api/blocks/tip/height')).then(getJson),
          fetch(this.mempoolApiUrl(`/api/address/${depositAddress}/utxo`)).then(getJson)
        ])
      )
      .then(([lastBlock, utxos]) =>
        (utxos as UTXO[])
          .map((utxo: UTXO) => {
            if (utxo.status.confirmed && lastBlock - utxo.status.block_height > 10) {
              utxo.status.locked = false
            } else {
              utxo.status.locked = true
            }
            console.log('utxo:' + JSON.stringify(utxo))
            return utxo
          })
          .sort((a, b) => {
            if (a.status.confirmed && b.status.confirmed) return b.status.block_height - a.status.block_height
            else if (a.status.confirmed && !b.status.confirmed) return 1
            else if (b.status.confirmed && !a.status.confirmed) return -1
            else return a.value - b.value
          })
      )
      .then((utxos) => (this._utxos = utxos))
      .finally(() => delete this.promises['utxos']))
  }

  // --- wallet connector ----
  private _connector?: Wallet
  get connector(): Wallet | undefined {
    if (!this._connector && this.wallet) this.useWallet(this.wallet)

    return this._connector
  }
  /** Get an available connector, will wait until one is ready */
  public async getConnector(): Promise<Wallet> {
    return (
      this.connector ??
      (this.promises['connector'] ??= new Promise<Wallet>((resolve) => {
        this.subscribe((_, v) => {
          if (v) {
            resolve(v)
            delete this.promises['connector']
          }
        }, '_connector')
      }))
    )
  }

  useWallet(type: WalletType) {
    if (this._connector) this.reset()
    switch (type) {
      case 'unisat':
        this._connector = new UniSat()
        break
      case 'okx':
        this._connector = new OKX()
        break
      case 'leather':
        this._connector = new Leather()
        break
      default:
        this._connector = new WalletStandard(type)
        if (!this._connector) throw new Error(`unsupported wallet type: ${type}`)
    }
    if (this._connector.installed) this._connector.on('accountsChanged', this.onAccountChanged)
  }

  reset(resetConnectorAndAddress = true): void {
    super.reset()
    ;[...this.propertyMap]
      // @ts-ignore
      .filter(([key, definition]) => definition.skipReset !== true && definition.resetValue === undefined)
      .forEach(([key, definition]) => {
        ;(this as {} as { [key: string]: unknown })[key as string] = definition.resetValue
      })
    this.promises = {}
    if (resetConnectorAndAddress) {
      if (this._connector?.installed) this._connector.removeListener('accountsChanged', this.onAccountChanged)
      this._connector = undefined
      this._address = undefined
    }
  }
}

export const walletState = new WalletState()
