import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import { map } from 'lit/directives/map.js'
import baseStyle from './base.css?inline'
import style from './main.css?inline'
import './global.css'
import '@shoelace-style/shoelace/dist/themes/light.css'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/divider/divider'
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip'
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar'
import { SlProgressBar } from '@shoelace-style/shoelace'
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'
import './components/connect.ts'
import './components/supply'
import './components/withdraw'
import './components/utxos'
import { SupplyPanel } from './components/supply'
import { WithdrawPanel } from './components/withdraw'
import { UtxoRow } from './components/utxos'
import { Unsubscribe, walletState } from './lib/walletState'
import { formatUnits } from './lib/units'
import { Balance } from './lib/wallets'

setBasePath(import.meta.env.MODE === 'development' ? 'node_modules/@shoelace-style/shoelace/dist' : '/')

function darkMode(enable = true) {
  if (enable) {
    import('@shoelace-style/shoelace/dist/themes/dark.css')
    document.documentElement.setAttribute('class', 'sl-theme-dark')
  } else {
    document.documentElement.removeAttribute('class')
  }
}

globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches && darkMode()

globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
  darkMode(e.matches)
})

@customElement('app-main')
export class AppMain extends LitElement {
  @state() walletBalance = 0
  @state() supplyPanel: Ref<SupplyPanel> = createRef<SupplyPanel>()
  @state() withdrawPanel: Ref<WithdrawPanel> = createRef<WithdrawPanel>()
  @state() UtxoRow: Ref<UtxoRow> = createRef<UtxoRow>()
  @state() progress: Ref<SlProgressBar> = createRef<SlProgressBar>()
  @state() protocolBalance?: Balance
  @state() utxos?: []
  @state() height?: number
  @state() updating?: boolean
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]

  private timedUpdater?: Promise<any>
  private stateUnsubscribes: Unsubscribe[] = []

  connectedCallback(): void {
    super.connectedCallback()
    this.stateUnsubscribes.push(
      walletState.subscribe((k, v) => {
        console.debug('[walletState update]', k, '->', v)
        switch (k) {
          case '_balance':
            this.walletBalance = v?.total ?? 0
            console.log('balance->' + this.walletBalance)
            break
          case '_protocolBalance':
            this.protocolBalance = v
            break
          case '_utxos':
            this.utxos = v
            break
          case '_height':
            this.height = v
            break
          case '_address':
          case '_network':
            if (v) this.updateAll(true)
            break
        }
      })
    )
    this.timedUpdater ??= this.busyUpdater()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.stateUnsubscribes.forEach((f) => f())
    this.stateUnsubscribes = []
  }

  get balanceUnconfirmed() {
    return walletState.balance?.unconfirmed ?? 0
  }

  updateAll(clearValues = false) {
    this.updating = true
    if (clearValues) {
      this.height = undefined
      this.walletBalance = 0
      this.protocolBalance = undefined
      this.utxos = undefined
    }
    return Promise.all([
      walletState.updateBalance(),
      walletState.updateProtocolBalance(),
      walletState.updateUTXOs()
    ]).finally(() => (this.updating = false))
  }

  async busyUpdater() {
    while (true) {
      await this.updateAll()
      await new Promise((r) => setTimeout(r, 60000))
    }
  }

  supply() {
    this.supplyPanel.value?.show()
  }

  withdraw() {
    this.withdrawPanel.value?.show()
  }

  render() {
    return html` <div class="mx-auto max-w-screen-lg px-6 lg:px-0 pb-6">
      <nav class="flex justify-between py-4">
        <div class="flex">
          <a href="#" class="-m-1.5 p-1.5">
            <img class="h-10 w-auto" src="../relinx_logo.png" alt="" />
          </a>
        </div>
        <div class="justify-end">
          <connect-button></connect-button>
        </div>
      </nav>
      <div class="my-10 grid sm:flex">
        <div class="sm:flex-auto font-medium">
          ${when(
            (this.protocolBalance?.total ?? 0) >= 0,
            () => html` <span class="text-xs" style="color:var(--sl-color-green-500)">Balance</span> `,
            () => html`
              <span class="text-xs" style="color:var(--sl-color-green-500)">Borrowing</span
              ><span class="text-xs text-sl-neutral-600">@</span><span class="text-xs">2.6%</span>
            `
          )}
          <div class="flex text-4xl my-1 items-center">
            <sl-icon outline name="currency-bitcoin"></sl-icon>
            ${Math.floor(Math.abs(this.protocolBalance?.total ?? 0) / 1e8)}.<span class="text-sl-neutral-600"
              >${Math.floor((Math.abs(this.protocolBalance?.total ?? 0) % 1e8) / 1e4)
                .toString()
                .padStart(4, '0')}</span
            >
            ${when(
              this.protocolBalance?.unconfirmed,
              () =>
                html`<span class="text-xs ml-1 border-l pl-2 text-sl-neutral-600 font-light">
                  ${formatUnits(Math.abs(this.protocolBalance!.confirmed), 8)} confirmed<br />
                  ${formatUnits(Math.abs(this.protocolBalance!.unconfirmed), 8)} unconfirmed
                </span>`
            )}
          </div>
          <span class="text-xs">$0.00</span>
        </div>
        <div class="mt-5 flex sm:my-auto space-x-4">
          <sl-button
            class="supply"
            variant=${this.walletBalance <= 0 ? 'default' : 'success'}
            @click=${() => this.supply()}
            ?disabled=${this.walletBalance <= 0}
            pill
          >
            <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
            Supply BTC
          </sl-button>
          <sl-button
            class="supply"
            variant="success"
            @click=${() => this.withdraw()}
            pill
            ?disabled=${this.utxos == undefined}
          >
            <sl-icon slot="prefix" name="dash-circle-fill"></sl-icon>
            Withdraw BTC
          </sl-button>
        </div>
      </div>
      <div class="grid grid-cols-5 space-y-5 sm:grid-cols-12 sm:space-x-5 sm:space-y-0">
        <div class="col-span-7">
          <div class="relative panel !rounded-none">
            <div class="text-xs mb-3 flex justify-between items-center">
              <span
                >${when(
                  this.utxos?.length,
                  () => html`${this.utxos?.length} deposits, current block height: ${this.height}`,
                  () => html`Loading Deposits...`
                )}</span
              >
              <sl-button variant="default" size="small" ?loading=${this.updating} @click=${() => this.updateAll()}>
                <sl-icon slot="suffix" name="arrow-clockwise"></sl-icon>
                Refresh
              </sl-button>
            </div>
            <ul>
              ${when(this.utxos == undefined, () => html` <sl-progress-bar indeterminate></sl-progress-bar> `)}
              ${when(
                this.utxos != undefined && this.utxos.length == 0,
                () => html`<div style="font-size: 18px;"><sl-icon name="file-earmark-x"></sl-icon>No Data Found.</div> `
              )}
              ${map(
                this.utxos,
                (utxo) => html`<li><utxo-row class="py-4 flex items-center" .utxo=${utxo}></utxo-row></li>`
              )}
            </ul>
          </div>
        </div>

        <div class="col-span-5 space-y-2">
          <div class="relative panel font-medium">
            <span class="text-xs text-sl-neutral-600">Wallet Balance</span>
            <div class="flex text-xl my-1 items-center">
              <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(this.walletBalance / 1e8)}.<span
                class="text-sl-neutral-600"
                >${Math.floor((this.walletBalance % 1e8) / 1e4)
                  .toString()
                  .padStart(4, '0')}</span
              >
            </div>
            ${when(
              this.balanceUnconfirmed != 0,
              () =>
                html`<div class="flex text-xs items-center text-sl-neutral-600">
                  ${formatUnits(Math.abs(this.balanceUnconfirmed), 8) + ' Unconfirmed'}
                </div>`
            )}
          </div>
          <div class="relative font-medium min-h-72">
            <supply-panel ${ref(this.supplyPanel)}></supply-panel>
            <withdraw-panel ${ref(this.withdrawPanel)}></withdraw-panel>
          </div>
        </div>
      </div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-main': AppMain
  }
}
