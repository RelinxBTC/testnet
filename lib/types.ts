export type Balance = {
  confirmed: number
  unconfirmed: number
  total: number
}

export const Networks = ['testnet', 'livenet', 'signet', 'devnet'] as const
export type Network = (typeof Networks)[number]
