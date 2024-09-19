import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Ref, createRef } from 'lit/directives/ref.js'
import baseStyle from './base.css?inline'
import style from './main.css?inline'
import { when } from 'lit/directives/when.js'
import '@shoelace-style/shoelace/dist/themes/light.css'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/divider/divider'
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip'
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar'
import '@shoelace-style/shoelace/dist/components/card/card'
import '@shoelace-style/shoelace/dist/components/tree/tree'
import '@shoelace-style/shoelace/dist/components/tree-item/tree-item'
import { SlProgressBar } from '@shoelace-style/shoelace'
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'
import { AccsPanel } from '../../src/components/accs'
import { Balance } from '../../src/lib/wallets'
import { formatUnits } from '../../src/lib/units'
import { SupplyPanel } from '../../src/components/supply'
import { WithdrawPanel } from '../../src/components/withdraw'
import './components/provider'
import './components/node.ts'
import '../../src/components/connect.ts'
import '../../src/components/utxos.ts'
import '../../src/components/supply'
import '../../src/components/withdraw'
import './components/timer.ts'
import { map } from 'lit/directives/map.js'
import { toastImportant } from '../../src/lib/toast'

import { Unsubscribe, walletState } from '../../src/lib/walletState'

setBasePath(import.meta.env.MODE === 'development' ? '../node_modules/@shoelace-style/shoelace/dist' : '/')

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

@customElement('dashboard-main')
export class DashboardMain extends LitElement {
  @state() infomation: any = {}
  @state() walletBalance = 0
  @state() progress: Ref<SlProgressBar> = createRef<SlProgressBar>()
  @state() accsPanel: Ref<AccsPanel> = createRef<AccsPanel>()
  @state() supplyPanel: Ref<SupplyPanel> = createRef<SupplyPanel>()
  @state() withdrawPanel: Ref<WithdrawPanel> = createRef<WithdrawPanel>()
  @state() protocolBalance?: Balance
  @state() utxos?: []
  @state() height?: number
  @state() updating?: boolean
  @state() subnode?: boolean
  @state() currentNode: any
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]

  private timedUpdater?: Promise<any>
  private stateUnsubscribes: Unsubscribe[] = []

  connectedCallback(): void {
    super.connectedCallback()
    this.infomation['CURRENT PROVIDERS'] = '1234'
    this.infomation['SELF-CUSTODY TOTAL'] = '1344.3 BTC'
    this.infomation['ONLINE'] = '789'
    this.infomation['OFFLINE'] = '345'
    this.infomation['BITCOIN BLOCKHEIGHT'] = 'Unknown'
    this.infomation['EACH AMOUNT AVG.'] = '12.5765 BTC'
    this.infomation['BLOCK LOCKED AVG.'] = '150'
    this.infomation['LAST COMMIT'] = (Date.now() - Math.random() * 20000) / 1000

    this.stateUnsubscribes.push(
      walletState.subscribe((k, v) => {
        console.debug('[walletState update]', k, '->', v)
        switch (k) {
          case '_balance':
            this.walletBalance = v?.total ?? 0
            console.log('balance->' + this.walletBalance)
            break
          case '_utxos':
            this.utxos = v
            break
          case '_protocolBalance':
            this.protocolBalance = v
            break
          case '_height':
            this.height = v
            this.infomation['BITCOIN BLOCKHEIGHT'] = this.height
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
  }

  get nodeList() {
    var list: any = [
      { name: 'RelinxNode0', total: '82.9 BTC', status: 'live', apy: '2.6%', amount: this.protocolBalance?.total },
      { name: 'RelinxNode2', total: '27.9 BTC', status: 'live', apy: '3.1%', amount: this.protocolBalance?.total }
    ]
    return list
  }

  get balanceUnconfirmed() {
    return walletState.balance?.unconfirmed ?? 0
  }

  get totalBalance() {
    return (walletState.balance?.total ?? 0) + (this.protocolBalance?.total ?? 0)
  }

  updateAll(clearValues = false) {
    this.updating = true
    if (clearValues) {
      this.height = undefined
      this.walletBalance = 0
      this.utxos = undefined
    }
    return Promise.all([
      walletState.updateBalance(),
      walletState.updateProtocolBalance(),
      walletState.updateUTXOs()
    ]).finally(() => (this.updating = false))
  }

  supply() {
    toastImportant('Not yet implemented! This feature is under intensive development.')
  }

  withdraw() {
    this.withdrawPanel.value?.show()
  }

  async busyUpdater() {
    while (true) {
      await this.updateAll()
      await new Promise((r) => setTimeout(r, 180000))
    }
  }

  render() {
    return html` <div class="mx-auto max-w-screen-xl px-6 lg:px-0 pb-6">
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
      <div class="grid grid-cols-4 space-y-4 sm:grid-cols-12 sm:space-x-1 sm:space-y-1">
        ${when(
          this.subnode,
          () =>
            html` <div class="col-span-8">
              <nav class="flex justify-between py-4">
                <div class="flex">
                  <sl-button label="Back" @click=${() => (this.subnode = false)}>
                  <sl-icon name="chevron-left"></sl-icon> BACK
                  </sl-icon-button>
                </div>
              </nav>
              <node-panel .utxos=${this.utxos} .node=${this.currentNode}></node-panel>
            </div>`
        )}
        ${when(
          !this.subnode,
          () =>
            html` <div class="col-span-8">
              <div class="grid grid-cols-4 space-y-4 sm:grid-cols-12 sm:space-x-1 sm:space-y-1">
                <div class="col-span-12"></div>
                ${Object.entries(this.infomation ?? {}).map(
                  ([key, value]) =>
                    html` <div class="col-span-3 space-y-1">
                      <div class="relative panel font-medium">
                        <span class="text-xs text-sl-neutral-600">${key}</span>
                        ${when(
                          key == 'LAST COMMIT',
                          () => html`<timer-ago class="flex text-2xl items-center" timestamp=${value}></timer-ago>`
                        )}
                        ${when(
                          key != 'LAST COMMIT',
                          () => html`<div class="flex text-2xl items-center">${value}</div>`
                        )}
                      </div>
                    </div>`
                )}
                <div class="col-span-12 spance-y-1"></div>
              </div>
              <provider-row></provider-row>
            </div>`
        )}
        <div class="col-span-4 panel">
          ${when(
            walletState.address,
            () =>
              html`<div>
                <div class="sm:flex-auto font-medium">
                  ${when(
                    (this.totalBalance ?? 0) >= 0,
                    () => html` <span class="text-xs" style="color:var(--sl-color-green-500)">Providing</span> `,
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
                  <div class="grid grid-cols-4 space-y-4 sm:grid-cols-12 sm:space-x-1 sm:space-y-1">
                    <div class="col-span-6 space-y-2">
                      <div class="relative panel font-medium">
                        <span class="text-xs text-sl-neutral-600">Non-providing</span>
                        <div class="flex text-xl my-1 items-center">
                          <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(
                            this.walletBalance / 1e8
                          )}.<span class="text-sl-neutral-600"
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
                    </div>
                    <div class="col-span-1"></div>
                    <div class="col-span-5 content-center">
                      <div class="flex justify-center items-center">
                        <sl-button
                          class="supply relative inline-flex items-center justify-center"
                          .variant=${this.walletBalance <= 0 ? 'default' : 'success'}
                          @click=${() => this.supply()}
                          ?disabled=${this.walletBalance <= 0}
                          pill
                        >
                          <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
                          Add SCC Node
                        </sl-button>
                      </div>
                    </div>
                  </div>
                </div>
                <hr />
                <sl-tree class="max-h-96 overflow-auto">
                  ${map(
                    this.nodeList,
                    (node: any) =>
                      html`<sl-tree-item
                        class="noexpand even:bg-[var(--sl-color-neutral-100)]"
                        @click=${() => {
                          this.subnode = true
                          this.currentNode = node
                          // this.accsPanel.value!.utxo = node
                          // this.accsPanel.value!.show()
                        }}
                      >
                        <div class="ml-1">
                          <div class="grid grid-cols-4 space-y-4 sm:grid-cols-12 sm:space-x-1 sm:space-y-1">
                            <div class="col-span-3 text-left">
                              <span class="text-xs">${node.name}</span>
                            </div>
                            <div class="col-span-6"></div>
                            <div class="col-span-3 text-right">
                              <span class="text-xs ${node.status == 'live' ? 'text-lime-600' : 'text-red-600'}">
                                ${node.status}</span
                              >
                            </div>
                          </div>

                          <div class="flex text-2xl my-1 items-center">
                            <sl-icon outline name="currency-bitcoin"></sl-icon>
                            <span class="text-sl-neutral-600">${node.total}</span>
                          </div>
                          <div class="flex text-xs my-1 items-center">
                            <span class="text-sl-neutral-600">@${node.apy}</span>
                            <div class="flex text-xs my-1 items-center">&nbsp;/&nbsp;</div>
                            <div class="flex text-xs my-1 items-center">
                              <span class="text-sl-neutral-600 text-right"
                                >${formatUnits(Math.abs(node.amount ?? 0), 8)}</span
                              >
                              <sl-icon outline name="currency-bitcoin"></sl-icon>
                              providing
                            </div>
                          </div>
                        </div>
                      </sl-tree-item>`
                  )}
                </sl-tree>
              </div>`,
            () =>
              html`<div class="items-center">
                <p class="text-center text-2xl text-neutral-600 space-x-2 space-y-2">
                  Providing self-custodial trust on the Bitcoin network
                </p>
                <div class="my-4">
                  <p class="text-center text-xs text-stone-400">FEATURE1 | FEATURE2 | FEATURE3</p>
                </div>
                <div class="text-center">
                  <connect-button></connect-button>
                </div>
              </div>`
          )}
        </div>
      </div>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-main': DashboardMain
  }
}
