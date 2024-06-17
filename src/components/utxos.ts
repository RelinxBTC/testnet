import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import '@shoelace-style/shoelace/dist/components/input/input'
import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import style from './utxo.css?inline'
import baseStyle from '/src/base.css?inline'
import { formatUnits } from '../lib/units'

@customElement('utxo-row')
export class UtxoRow extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() utxo?: { value: 0; status: { confirmed: false; block_time: 0; block_height: 0 }; txid: '' }
  @property() lastBlock?: 0

  connectedCallback(): void {
    super.connectedCallback()
    console.log(JSON.stringify(this.utxo))
    console.log('last block: ' + this.lastBlock)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
  }

  getElapsedTime(): String {
    if (this.utxo?.status.block_time ?? 0 > 0) {
      var time = new Date().getTime()
      var delta = (time - 1000 * (this.utxo?.status.block_time ?? 0)) / 1000
      console.log('delta:' + delta)
      var d = Math.floor(delta / 60 / 60 / 24)
      var h = Math.floor((delta / 60 / 60) % 24)
      var m = Math.floor((delta / 60) % 60)
      var date = false
      var result = ''
      if (d > 0) {
        result = result + d + ' d '
        date = true
      }
      if (h > 0) {
        result = result + h + ' h '
      }
      if (!date) {
        result = result + m + ' m '
      }
      result = result + 'ago'
      return result
    }
    return 'N/A'
  }

  render() {
    return html`
      <div class="ml-1 flex-auto text-s">
        ${when(
          (this.utxo?.status.block_height ?? 0) == 0 ||
            (this.utxo?.status.block_height ?? 0) + 1 >= (this.lastBlock ?? 0),
          () =>
            html` <div class="flex text-s my-1 items-center" style="color: red;" alt="Locked">
              <sl-icon outline name="lock"></sl-icon>
            </div>`
        )}
        ${when(
          (this.utxo?.status.block_height ?? 0) > 0 &&
            (this.utxo?.status.block_height ?? 0) + 1 < (this.lastBlock ?? 0),
          () =>
            html` <div class="flex text-s my-1 items-center" style="color: #417505;" alt="Unlocked">
              <sl-icon outline name="unlock"></sl-icon>
            </div>`
        )}
      </div>
      <div class="ml-3 flex-auto text-xl">
        <div class="flex text-xl my-1 items-center">
          <sl-icon outline name="currency-bitcoin"></sl-icon>
          <span class="text-sl-neutral-600">${formatUnits(Math.abs(this.utxo?.value ?? 0), 8)}</span>
        </div>
      </div>
      <div class="ml-3 flex-auto text-s">
        ${when(
          this.utxo?.status.confirmed,
          () =>
            html` <div class="flex text-s my-1 items-center" style="color: #417505;">
              <sl-icon outline name="check-circle"></sl-icon> Confirmed
            </div>`
        )}
        ${when(
          !this.utxo?.status.confirmed,
          () =>
            html` <div class="flex text-s my-1 items-center" style="color: red;">
              <sl-icon outline name="record-circle"></sl-icon> Unconfirmed
            </div>`
        )}
      </div>
      <div class="ml-3 flex-auto text-s">${this.getElapsedTime()}</div>
      <div class="ml-3 flex-auto text-s">
        <a href="https://mempool.space/testnet/tx/${this.utxo?.txid}" _target="blank" alt="Check Transaction Details"
          ><sl-icon outline name="box-arrow-up-right"></sl-icon
        ></a>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'utxo-row': UtxoRow
  }
}
