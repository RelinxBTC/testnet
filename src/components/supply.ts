import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import baseStyle from '/src/base.css?inline'
import style from './supply.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import '@shoelace-style/shoelace/dist/components/radio-button/radio-button.js'
import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js'
import { StateController, walletState } from '../lib/walletState'
import { SlDrawer, SlInput, SlRadioGroup } from '@shoelace-style/shoelace'
import { toast, toastImportant } from '../lib/toast'
import { when } from 'lit/directives/when.js'

@customElement('supply-panel')
export class SupplyPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() coin = 'Bitcoin'
  @state() drawer: Ref<SlDrawer> = createRef<SlDrawer>()
  @state() inputAmount: Ref<SlInput> = createRef<SlInput>()
  @state() inputBlocks: Ref<SlRadioGroup> = createRef<SlRadioGroup>()
  @state() inputValue = 0
  @state() adding = false

  get balanceConfirmed() {
    return walletState.balance?.confirmed ?? 0
  }

  get balance() {
    return walletState.balance?.total ?? 0
  }

  constructor() {
    super()
    new StateController(this, walletState)
  }

  public show() {
    console.log('show event!')
    return this.drawer.value?.show()
  }

  private async addSupply() {
    this.adding = true
    try {
      const blocks = Number(this.inputBlocks.value?.value)
      const addr = await walletState.getDepositAddress(blocks)
      console.log('locking', this.inputAmount.value!.valueAsNumber * 1e8, 'for', blocks, 'blocks to', addr)
      const tx = await walletState.connector!.sendBitcoin(addr, this.inputAmount.value!.valueAsNumber * 1e8)
      toastImportant(
        `Your transaction <a href="${walletState.mempoolUrl}/tx/${tx}">${tx}</a> has been sent to network.`
      )
      walletState.updateProtocolBalance()
      walletState.updateBalance()
      walletState.updateUTXOs()
      this.drawer.value?.hide()
    } catch (e) {
      console.warn(e)
      toast(e)
    }
    this.adding = false
  }

  render() {
    return html`
      <sl-drawer
        ${ref(this.drawer)}
        placement="bottom"
        no-header
        ?contained=${globalThis.matchMedia('(min-width:640px').matches}
        class="drawer-placement-bottom sm:drawer-contained"
      >
        <span class="font-medium text-xs" style="color:var(--sl-color-green-500)">Supply ${this.coin}</span>
        <sl-input
          ${ref(this.inputAmount)}
          class="mt-2"
          size="large"
          placeholder="0"
          filled
          type="number"
          @sl-input=${() => (this.inputValue = this.inputAmount.value!.valueAsNumber)}
        >
          <sl-icon slot="prefix" name="currency-bitcoin"></sl-icon>
          <span slot="help-text" class="text-xs">
            ${Math.floor(this.balance / 1e8)}.${Math.floor((this.balance % 1e8) / 1e4)
              .toString()
              .padStart(4, '0')}
            in wallet
            ${when(
              this.balance != this.balanceConfirmed,
              () =>
                `(${Math.floor(this.balanceConfirmed / 1e8)}.${Math.floor((this.balanceConfirmed % 1e8) / 1e4)
                  .toString()
                  .padStart(4, '0')} Confirmed)`
            )}
          </span>
          <sl-button
            slot="suffix"
            size="small"
            @click=${() => {
              this.inputValue = this.balance / 1e8
              this.inputAmount.value!.value = this.inputValue.toString()
            }}
            pill
            >Max</sl-button
          >
        </sl-input>
        <div class="flex mt-5 text-xs items-center text-sl-neutral-600">
          Locking for
          <sl-radio-group ${ref(this.inputBlocks)} size="small" variant="success" class="mx-2" outline value="1">
            <sl-radio-button value="1">1</sl-radio-button>
            <sl-radio-button value="10">10</sl-radio-button>
            <sl-radio-button value="100">100</sl-radio-button>
          </sl-radio-group>
          Blocks
        </div>
        <div slot="footer" class="flex space-x-4">
          <sl-button class="w-full" @click=${() => this.drawer.value?.hide()}>Cancel</sl-button>
          <sl-button
            class="w-full"
            variant="primary"
            ?disabled=${this.inputValue <= 0}
            @click=${() => this.addSupply()}
            .loading=${this.adding}
            >Add</sl-button
          >
        </div>
      </sl-drawer>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'supply-panel': SupplyPanel
  }
}
