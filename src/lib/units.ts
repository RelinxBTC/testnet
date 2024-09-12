import { formatUnits } from '@ethersproject/units'
export { formatUnits, parseUnits } from '@ethersproject/units'

export function formatUnitsComma(value: any, decimals?: number) {
  return formatUnits(value, decimals).replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',')
}

export function getElapsedTime(timer: any): String {
  if (timer ?? 0 > 0) {
    var time = new Date().getTime()
    var delta = (time - 1000 * (timer ?? 0)) / 1000
    console.log('delta:' + delta)
    var d = Math.floor(delta / 60 / 60 / 24)
    var h = Math.floor((delta / 60 / 60) % 24)
    var m = Math.floor((delta / 60) % 60)
    var s = Math.floor(delta % 60)
    var date = false
    var result = ''
    if (d > 0) {
      result = result + d + ' d '
      date = true
    }
    if (h > 0) {
      result = result + h + ' h '
    }
    if (m > 0) {
      result = result + m + ' m '
    }
    if (s > 0) {
      result = result + s + ' s '
    }
    result = result + 'ago'
    return result
  }
  return 'N/A'
}
