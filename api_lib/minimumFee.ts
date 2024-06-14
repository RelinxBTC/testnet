import { mempool } from './mempool.js'

export async function minimumFee(vsize: number): Promise<number> {
  const {
    bitcoin: { fees }
  } = mempool()

  const { fastestFee, minimumFee } = await fees.getFeesRecommended()

  return Math.max(300, minimumFee, vsize * fastestFee)
}
