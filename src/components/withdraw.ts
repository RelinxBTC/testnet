import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import baseStyle from '/src/base.css?inline'
import style from './withdraw.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import { StateController, walletState } from '../lib/walletState'
import { SlDrawer, SlInput } from '@shoelace-style/shoelace'
import { withdrawMPC, withdrawWithoutMPC } from '../lib/withdraw'

@customElement('withdraw-panel')
export class WithdrawPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  private mediaList = globalThis.matchMedia('(min-width:640px)')
  @property() coin = 'Bitcoin'
  @state() drawer: Ref<SlDrawer> = createRef<SlDrawer>()
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() inputValue = 0
  @state() adding = false
  @state() erro_msg = ''
  @state() placement = this.placementByMedia(this.mediaList)

  get balanceConfirmed() {
    return walletState.balance?.confirmed ?? 0
  }

  get balanceReleased() {
    // return 0
    var value = 0
    this.utxos.map((utxo: any) => {
      if (!utxo.status.locked) value = value + utxo.value
    })
    return value
  }

  get balance() {
    var value = 0
    this.utxos.map((utxo: any) => {
      value = value + utxo.value
    })
    return value
  }

  get utxos() {
    return walletState.utxos ?? []
  }

  constructor() {
    super()
    new StateController(this, walletState)
  }

  private placementByMedia(mediaList: MediaQueryList) {
    return mediaList.matches ? 'end' : 'bottom'
  }

  private placementUpdater = (event: any) => (this.placement = this.placementByMedia(event))

  connectedCallback(): void {
    super.connectedCallback()
    this.mediaList.addEventListener('change', this.placementUpdater)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.mediaList.removeEventListener('change', this.placementUpdater)
  }

  public show() {
    console.log('show event!')
    return this.drawer.value?.show()
  }

  withdraw() {
    this.input.value?.setCustomValidity('')
    var amount = this.input.value!.valueAsNumber * 1e8
    if (this.balanceReleased > 0 && amount > this.balanceReleased) {
      this.input.value?.setCustomValidity("Can't withdraw more than unlocked.")
      this.input.value?.reportValidity()
      return
    }
    if (this.balanceReleased > 0 && amount < this.balanceReleased) {
      this.input.value?.setCustomValidity("Can't withdraw less than unlocked.")
      this.input.value?.reportValidity()
      return
    }
    if (this.balanceReleased == 0 && amount > this.balance) {
      this.input.value?.setCustomValidity('Withdrawal amount exceeds balance.')
      this.input.value?.reportValidity()
      return
    }
    if (this.balanceReleased == 0 && amount < this.balance) {
      this.input.value?.setCustomValidity('Withdrawal amount should equal to balance.')
      this.input.value?.reportValidity()
      return
    }
    if (this.balanceReleased > 0) {
      withdrawWithoutMPC([])
    } else {
      withdrawMPC(undefined)
    }
  }

  render() {
    return html`
      <sl-drawer ${ref(this.drawer)} placement=${this.placement} class="[&::part(body)]:pt-0">
        <span slot="label" style="color:var(--sl-color-green-500)">Withdraw ${this.coin}</span>
        <sl-input
          ${ref(this.input)}
          style="--sl-input-spacing-large: 0.2rem;"
          size="large"
          placeholder="0"
          filled
          type="number"
          @sl-input=${() => (this.inputValue = this.input.value!.valueAsNumber)}
        >
          <sl-icon slot="prefix" name="currency-bitcoin"></sl-icon>
          ${when(
            this.balanceReleased > 0,
            () =>
              html` <sl-button
                slot="suffix"
                size="small"
                @click=${() => {
                  this.inputValue = this.balanceReleased / 1e8
                  this.input.value!.value = this.inputValue.toString()
                }}
                pill
                >Max Unlocked</sl-button
              >`
          )}
          ${when(
            this.balanceReleased == 0,
            () =>
              html` <sl-button
                slot="suffix"
                size="small"
                @click=${() => {
                  this.inputValue = this.balance / 1e8
                  this.input.value!.value = this.inputValue.toString()
                }}
                pill
                >Max</sl-button
              >`
          )}
          <div slot="help-text" class="flex text-xs items-center text-sl-neutral-600">
            ${this.balanceReleased == 0 ? 'Current withdraw needs MPC signature.' : ''}
          </div>
          <div slot="help-text" class="flex text-xs items-center text-sl-neutral-600">
            <sl-icon outline name="currency-bitcoin"></sl-icon>
            ${Math.floor(this.balance / 1e8)}.${Math.floor((this.balance % 1e8) / 1e4)
              .toString()
              .padStart(4, '0')}
            (${Math.floor(this.balanceReleased / 1e8)}.${Math.floor((this.balanceReleased % 1e8) / 1e4)
              .toString()
              .padStart(4, '0')}
            Unlocked)
          </div>
        </sl-input>
        <div class="mt-4 flex space-x-4">
          <sl-button class="w-full" @click=${() => this.drawer.value?.hide()} pill>Cancel</sl-button>
          <sl-button
            class="w-full"
            ?disabled=${this.inputValue <= 0}
            @click=${() => this.withdraw()}
            pill
            .loading=${this.adding}
            >Withdraw</sl-button
          >
        </div>
      </sl-drawer>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'withdraw-panel': WithdrawPanel
  }
}
