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
    lock_blocks: number
  }
  value: number
}

const defaultBlocks = [1, 10, 100]

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
      .then(({ key: mpcPubkey }) => (this._mpcPublicKey = mpcPubkey))
      .finally(() => delete this.promises['mpcPublicKey']))
  }

  // ---- deposit address ----
  @property({ type: Object }) private _depositAddresses?: Record<number, string>
  public get depositAddress(): string | undefined {
    if (this._depositAddresses && 1 in this._depositAddresses) return this._depositAddresses[1]
    this.updateDepositAddress()
  }

  public async getDepositAddress(blocks = 1): Promise<string> {
    return this._depositAddresses?.[blocks] ?? this.updateDepositAddress().then(() => this._depositAddresses![blocks])
  }

  public async getDepositAddresses(): Promise<Record<number, string>> {
    return this._depositAddresses && 1 in this._depositAddresses
      ? this._depositAddresses
      : this.updateDepositAddress().then(() => this._depositAddresses!)
  }

  public async updateDepositAddress() {
    return (this.promises['depositAddress'] ??= this.getPublicKey()
      .then((pubKey) =>
        pubKey
          ? Promise.all([pubKey, this.getMpcPublicKey(), this.getNetwork()])
          : Promise.reject('wallet not connected')
      )
      .then(([publicKey, mpcPubkey, network]) => {
        this._depositAddresses = {}
        defaultBlocks.forEach((blocks) => {
          const address = btc.p2tr(
            undefined,
            { script: scriptTLSC(hex.decode(mpcPubkey), hex.decode(publicKey), blocks) },
            btcNetwork(network),
            true
          ).address
          if (address) this._depositAddresses![blocks] = address
        })
      })
      .finally(() => delete this.promises['depositAddress']))
  }

  // ---- balance ----
  @property({ type: Object }) private _balance?: Balance
  public get balance(): Balance | undefined {
    if (this._balance) return this._balance
    this.updateBalance().catch(console.debug)
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
    return (this.promises['protocolBalance'] ??= this.getDepositAddresses()
      .then((depositAddresses) =>
        Promise.all(
          Object.keys(depositAddresses).map((block) =>
            fetch(this.mempoolApiUrl(`/api/address/${depositAddresses[Number(block)]}`)).then(getJson)
          )
        )
      )
      .then((balances) => {
        var [unconfirmed, confirmed] = [0, 0]
        balances.forEach(({ mempool_stats, chain_stats }) => {
          unconfirmed += mempool_stats.funded_txo_sum - mempool_stats.spent_txo_sum
          confirmed += chain_stats.funded_txo_sum - chain_stats.spent_txo_sum
        })
        return (this._protocolBalance = { unconfirmed, confirmed, total: unconfirmed + confirmed })
      })
      .finally(() => delete this.promises['protocolBalance']))
  }

  // ---- height ----
  @property({ type: Object }) private _height?: number
  public get height(): number | undefined {
    if (this._height) return this._height
    this.getHeight().catch(console.debug)
  }

  public async getHeight() {
    return (this.promises['height'] ??= fetch(this.mempoolApiUrl('/api/blocks/tip/height'))
      .then(getJson)
      .then((height) => (this._height = height))
      .finally(() => delete this.promises['height']))
  }

  // --- utxos ----
  @property({ type: Array }) private _utxos?: UTXO[]
  public get utxos(): UTXO[] | undefined {
    if (this._utxos) return this._utxos
    this.updateUTXOs()
  }

  public async updateUTXOs(): Promise<UTXO[]> {
    return (this.promises['utxos'] ??= this.getDepositAddresses()
      .then(
        (depositAddresses) => (
          console.debug('updating utxos with addresses', depositAddresses),
          Promise.all([
            this.getHeight(),
            Promise.all(
              Object.keys(depositAddresses).map((block) =>
                fetch(this.mempoolApiUrl(`/api/address/${depositAddresses[Number(block)]}/utxo`))
                  .then(getJson)
                  .then((utxos: UTXO[]) => (utxos.forEach((utxo) => (utxo.status.lock_blocks = Number(block))), utxos))
              )
            )
          ])
        )
      )
      .then(([lastBlock, utxoses]) =>
        utxoses
          .reduce((accumulator, utxos) => accumulator.concat(utxos), [])
          .map((utxo) => {
            utxo.status.locked =
              !utxo.status.confirmed || lastBlock - utxo.status.block_height < utxo.status.lock_blocks - 1
            console.debug('got utxo', utxo)
            return utxo
          })
          .sort((a, b) => {
            const l = b.status.lock_blocks - a.status.lock_blocks
            if (a.status.confirmed && b.status.confirmed) {
              const h = b.status.block_height - a.status.block_height
              return h ? h : l
            } else if (a.status.confirmed && !b.status.confirmed) return 1
            else if (b.status.confirmed && !a.status.confirmed) return -1
            else return l ? l : b.value - a.value
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
