import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/button-group/button-group'
import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import style from './utxo.css?inline'
import baseStyle from '/src/base.css?inline'
import { formatUnits } from '../lib/units'
import { UTXO, walletState } from '../lib/walletState'
import { withdrawMPC, withdrawWithoutMPC } from '../lib/withdraw'

@customElement('utxo-row')
export class UtxoRow extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() utxo?: UTXO
  @property() buttonStatus?: boolean

  async withdraw() {
    var utxos = []
    utxos.push(this.utxo)
    if (this.utxo?.status.locked) {
      this.buttonStatus = true
      await withdrawMPC(this.utxo)
      this.buttonStatus = false
    } else {
      this.buttonStatus = true
      await withdrawWithoutMPC(utxos)
      this.buttonStatus = false
    }
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
      <div class="ml-1 text-s">
        <span class="text-s my-1 items-center">
          ${when(
            this.utxo?.status.confirmed,
            () =>
              html`<sl-tooltip content="Confirmed at block ${this.utxo?.status.block_height}" hoist>
                <sl-icon class="text-green-500" outline name="check-circle"></sl-icon>
              </sl-tooltip>`,
            () =>
              html`<sl-tooltip content="Unconfirmed" hoist>
                <sl-icon class="text-red-400" outline name="record-circle"></sl-icon>
              </sl-tooltip>`
          )}
          ${when(
            this.utxo?.status.locked,
            () =>
              html`<sl-tooltip content="Locked for ${this.utxo?.status.lock_blocks} blocks" hoist>
                <sl-icon class="text-red-500" outline name="lock"></sl-icon>
              </sl-tooltip>`,
            () =>
              html`<sl-tooltip content="Unlocked" hoist>
                <sl-icon class="text-green-400" outline name="unlock"></sl-icon>
              </sl-tooltip> `
          )}
        </span>
      </div>
      <div class="ml-3 flex-auto text-xl">
        <div class="flex text-xl my-1 items-center text-sl-neutral-600">
          <sl-icon outline name="currency-bitcoin"></sl-icon>
          ${formatUnits(Math.abs(this.utxo?.value ?? 0), 8)}
        </div>
      </div>
      <div class="ml-3 flex-auto w-40 text-xs">
        ${this.getElapsedTime()}<br />
        <span class="text-neutral-400">${this.utxo?.status.lock_blocks} blocks locking</span>
      </div>
      <div class="ml-3 flex-auto text-s">
        <sl-tooltip content="Check Transaction Details" hoist>
          <a href="${walletState.mempoolUrl}/tx/${this.utxo?.txid}" _target="blank" alt="Check Transaction Details">
            <sl-icon outline name="box-arrow-up-right"></sl-icon>
          </a>
        </sl-tooltip>
      </div>
      <div class="ml-3 flex-auto text-s">
        <sl-button-group>
          <sl-button variant="success" outline disabled size="small">Withdraw</sl-button>
          <sl-tooltip content="Withdraw with MPC signature" hoist>
            <sl-button size="small" variant="success" @click=${() => withdrawMPC(this.utxo)}>MPC</sl-button>
          </sl-tooltip>
          <sl-tooltip content="Withdraw without MPC signature" hoist>
            <sl-button size="small" variant="success" @click=${() => withdrawWithoutMPC([this.utxo])}>Self</sl-button>
          </sl-tooltip>
        </sl-button-group>
      </div>
      <div class="ml-3 text-right">
        <sl-icon-button name="chevron-right" label="Settings"></sl-icon-button>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'utxo-row': UtxoRow
  }
}
