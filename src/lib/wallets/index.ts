import { type Balance, type Network } from '../../../lib/types'
export { type Balance, type Network } from '../../../lib/types'

export const WalletTypes = ['unisat', 'okx', 'leather'] as const
export const WalletNames: Record<WalletType, string> = {
  unisat: 'UniSat',
  okx: 'OKX',
  leather: 'Leather'
} as const

export interface Wallet {
  installed: boolean
  network: Promise<Network>
  switchNetwork(network: Network): Promise<void>
  accounts: Promise<string[]>
  requestAccounts(): Promise<string[]>
  publicKey: Promise<string>
  balance: Promise<Balance>
  on(event: WalletEvent, handler: (accounts: Array<string>) => void): void
  removeListener(event: WalletEvent, handler: (accounts: Array<string>) => void): void
  /** @returns txid */
  sendBitcoin(toAddress: string, satoshis: number, options?: { feeRate: number }): Promise<string>
  /**
   * @param cursor offset, starting from 0.
   * @param size number per page.
   */
  getInscriptions(cursor?: number, size?: number): Promise<{ total: number; list: Inscription[] }>
  /** @returns txid */
  sendInscription(toAddress: string, inscriptionId: string, options?: { feeRate: number }): Promise<string>
  /** @returns the hex string of the signed psbt */
  signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string>
  /** @returns the hex strings of the signed psbt */
  signPsbts(psbtHexs: string[], options?: SignPsbtOptions): Promise<string[]>
  /** @returns txid */
  pushPsbt(psbtHex: string): Promise<string>

  /** bip322-simple signature */
  signMessage(message: string): Promise<string>
}

export type Inscription = {
  /** the id of inscription. */
  inscriptionId: string
  /** the number of inscription. */
  inscriptionNumber?: string
  /** the address of inscription. */
  address: string
  /** the output value of inscription. */
  outputValue: string
  /** the offset of inscription. */
  offset: number
  /** the txid and vout of current location */
  location: string
  /** the content url of inscription. */
  content?: string
  /** the content length of inscription. */
  contentLength?: string
  /** the content type of inscription. */
  contentType?: number
  /** the preview link */
  preview?: number
  /** the blocktime of inscription. */
  timestamp?: number
  /** the txid of genesis transaction */
  genesisTransaction?: string
}

export type SignPsbtOptions = {
  autoFinalized?: boolean
  toSignInputs: {
    index: number
    address?: string
    publicKey?: string
    sighashTypes?: number[]
    disableTweakSigner?: boolean
  }[]
}

export const WalletEvents = ['accountsChanged', 'networkChanged'] as const
export type WalletEvent = (typeof WalletEvents)[number]

export type WalletType = (typeof WalletTypes)[number] | string
