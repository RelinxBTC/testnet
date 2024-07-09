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
import { until } from 'lit/directives/until.js'

@customElement('supply-panel')
export class SupplyPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  private mediaList = globalThis.matchMedia('(min-width:640px)')
  @property() coin = 'Bitcoin'
  @state() drawer: Ref<SlDrawer> = createRef<SlDrawer>()
  @state() inputAmount: Ref<SlInput> = createRef<SlInput>()
  @state() inputBlocks: Ref<SlRadioGroup> = createRef<SlRadioGroup>()
  @state() blocks = 1
  @state() inputValue = 0
  @state() adding = false
  @state() placement = this.placementByMedia(this.mediaList)

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

  private async addSupply() {
    this.adding = true
    try {
      const addr = await walletState.getDepositAddress(this.blocks)
      console.log('locking', this.inputAmount.value!.valueAsNumber * 1e8, 'for', this.blocks, 'blocks to', addr)
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
      <sl-drawer ${ref(this.drawer)} placement=${this.placement} class="[&::part(body)]:pt-0">
        <span slot="label" style="color:var(--sl-color-green-500)">Supply ${this.coin}</span>
        <sl-input
          ${ref(this.inputAmount)}
          style="--sl-input-spacing-large: 0.2rem;"
          size="large"
          placeholder="0"
          filled
          type="number"
          @sl-input=${() => (this.inputValue = this.inputAmount.value!.valueAsNumber)}
        >
          <sl-icon slot="prefix" name="currency-bitcoin"></sl-icon>
          <span slot="help-text">
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
            @click=${() => {
              this.inputValue = this.balance / 1e8
              this.inputAmount.value!.value = this.inputValue.toString()
            }}
            pill
            >Max</sl-button
          >
        </sl-input>
        <div class="flex mt-5 items-center text-sl-neutral-600">
          Locking for
          <sl-radio-group
            ${ref(this.inputBlocks)}
            size="small"
            variant="success"
            class="mx-2"
            outline
            value="1"
            @sl-change=${() => (this.blocks = Number(this.inputBlocks.value!.value))}
          >
            <sl-radio-button value="1">1</sl-radio-button>
            <sl-radio-button value="10">10</sl-radio-button>
            <sl-radio-button value="100">100</sl-radio-button>
          </sl-radio-group>
          Blocks
        </div>
        <sl-divider style="--spacing: 1rem;"></sl-divider>
        <h3 class="text-sl-neutral-600">Self-Custody Address</h3>
        <span class="font-mono break-words text-[var(--sl-color-neutral-700)]"
          >${until(walletState.getDepositAddress(this.blocks))}</span
        >
        <h3 class="mt-2 text-sl-neutral-600">Self-Custody Script</h3>
        <pre
          class="mt-2 p-1 px-2 w-full overflow-x-scroll text-xs text-[var(--sl-color-neutral-700)] border rounded"
          style="border-color:var(--sl-color-neutral-200)"
        >
OP_DEPTH
OP_1SUB
# Check if more than one signature
OP_IF
  # MPC public key
  ${walletState.mpcPublicKey}
  OP_CHECKSIGVERIFY
OP_ELSE
  # Locking blocks
  ${this.blocks}
  # Check if locking blocks passed
  OP_CHECKSEQUENCEVERIFY
  OP_DROP
OP_ENDIF
# Your public key
${walletState.publicKey}
OP_CHECKSIG</pre
        >
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
