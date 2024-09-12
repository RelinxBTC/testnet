import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
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
import './components/provider'
import '../../src/components/connect.ts'
import './components/timer.ts'

import { Unsubscribe, walletState } from '../../src/lib/walletState'

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

@customElement('dashboard-main')
export class DashboardMain extends LitElement {
  @state() infomation: any = {}
  @state() walletBalance = 0
  @state() progress: Ref<SlProgressBar> = createRef<SlProgressBar>()
  @state() utxos?: []
  @state() height?: number
  @state() updating?: boolean
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
    this.infomation['EACH BTC AMOUNT AVG.'] = '12.5765 BTC'
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

  async busyUpdater() {
    while (true) {
      await this.updateAll()
      await new Promise((r) => setTimeout(r, 180000))
    }
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
      <div class="grid grid-cols-4 space-y-4 sm:grid-cols-12 sm:space-x-1 sm:space-y-1">
        <div class="col-span-12"></div>
        ${Object.entries(this.infomation ?? {}).map(
          ([key, value]) =>
            html` <div class="col-span-3 space-y-1">
              <div class="relative panel font-medium">
                <span class="text-xs text-sl-neutral-600">${key}</span>
                ${when(
                  key == 'LAST COMMIT',
                  () => html`<div class="flex text-2xl items-center"><timer-ago timestamp=${value}></timer-ago></div>`
                )}
                ${when(key != 'LAST COMMIT', () => html`<div class="flex text-2xl items-center">${value}</div>`)}
              </div>
            </div>`
        )}
      </div>
      <sl-icon outline name="currency-bitcoin"></sl-icon>
      <provider-row></provider-row>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-main': DashboardMain
  }
}
