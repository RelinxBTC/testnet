import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/button-group/button-group'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import style from '../main.css?inline'
import baseStyle from '../base.css?inline'
import './timer'
import { map } from 'lit/directives/map.js'
import { AccsPanel } from '../../../src/components/accs'
import { SupplyPanel } from '../../../src/components/supply'
import { WithdrawPanel } from '../../../src/components/withdraw'
import '../../../src/components/supply'
import '../../../src/components/withdraw'
import '../../../src/components/accs'
import '../../../src/components/utxos'
import '../../../src/components/commitmentList'
import { formatUnits } from '../../../src/lib/units'
import { Unsubscribe, walletState, UTXO } from '../../../src/lib/walletState'
import { Commitments } from '../../../src/components/commitmentList'
import { Balance } from '../../../src/lib/wallets'

@customElement('node-panel')
export class NodePanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() node: any
  @property() utxos?: UTXO[]
  @state() updating?: boolean
  @state() walletBalance = 0
  @state() accsPanel: Ref<AccsPanel> = createRef<AccsPanel>()
  @state() commitmentList: Ref<Commitments> = createRef<Commitments>()
  @state() supplyPanel: Ref<SupplyPanel> = createRef<SupplyPanel>()
  @state() withdrawPanel: Ref<WithdrawPanel> = createRef<WithdrawPanel>()
  @state() protocolBalance?: Balance
  @state() height?: number

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
          case '_address':
          case '_network':
            if (v) this.updateAll(true)
            break
        }
      })
    )
    this.timedUpdater ??= this.busyUpdater()
  }

  async busyUpdater() {
    while (true) {
      await this.updateAll()
      await new Promise((r) => setTimeout(r, 180000))
    }
  }

  updateAll(clearValues = false) {
    this.updating = true
    if (clearValues) {
      this.height = undefined
      this.walletBalance = 0
      this.utxos = undefined
    }
    this.commitmentList.value?.updateCommitments()
    return Promise.all([
      walletState.updateBalance(),
      walletState.updateProtocolBalance(),
      walletState.updateUTXOs()
    ]).finally(() => (this.updating = false))
  }

  updated(changedProperties: any) {
    // console.log(changedProperties) // logs previous values
    changedProperties.forEach((v: any, k: any) => {
      console.log(k)
      console.log(v)
      if (k == 'node') {
        //node changed, update page data
        this.updateAll()
      }
    })
  }

  //   updateAll() {
  //     this.commitmentList.value?.updateCommitments()
  //   }

  supply() {
    this.supplyPanel.value?.show()
  }

  withdraw() {
    this.withdrawPanel.value?.show()
  }

  render() {
    return html`
      <div class="grid grid-cols-5 space-y-5 sm:grid-cols-12 sm:space-x-5 sm:space-y-0">
        <div class="col-span-12 space-y-1">
          <div class="my-10 grid sm:flex">
            <div class="sm:flex-auto font-medium">
              <span class="text-xs text-sl-neutral-600">Node Infomation</span>
              <div class="flex text-2xl items-center">${this.node.name}</div>
              <div class="flex text-xs items-center">
                <span class="${this.node.status == 'live' ? 'text-lime-600' : 'text-red-600'}"
                  >${this.node.status}</span
                >
              </div>
              <div class="flex text-xs items-center">@${this.node.apy}</div>
              <div class="flex text-xs items-center">SC total: ${this.node.total}</div>
              <div class="flex text-xs items-center">
                Providing: ${formatUnits(Math.abs(this.node.amount ?? 0), 8)} BTC
              </div>
            </div>
            <div class="mt-5 flex sm:my-auto space-x-4">
              <sl-button
                class="supply"
                .variant=${this.walletBalance <= 0 ? 'default' : 'success'}
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
        </div>
      </div>
      <div class="grid grid-cols-5 space-y-5 sm:grid-cols-12  sm:space-y-0">
        <div class="col-span-12 mt-2">
          <sl-card>
            <div slot="header" class="font-medium">Custody List of ${this.node.name}</div>
            <sl-tree class="max-h-96 overflow-auto border-2">
              ${when(
                this.utxos != undefined && this.utxos.length == 0,
                () =>
                  html`<div class="text-base p-2 space-x-1">
                    <sl-icon name="file-earmark-x"></sl-icon><span>No Data Found.</span>
                  </div>`
              )}
              ${map(
                this.utxos,
                (utxo) =>
                  html`<sl-tree-item
                    class="noexpand even:bg-[var(--sl-color-neutral-100)]"
                    @click=${() => {
                      this.accsPanel.value!.utxo = utxo
                      this.accsPanel.value!.show()
                    }}
                  >
                    <utxo-row class="p-4 flex items-center w-full" .utxo=${utxo}></utxo-row>
                  </sl-tree-item>`
              )}
            </sl-tree>
          </sl-card>
        </div>
        <div class="col-span-12">
          <sl-card class="mt-4 ml-0">
            <div slot="header" class="font-medium">Recent ACCs (Accountable Custody Commitments)</div>
            <commitment-list ${ref(this.commitmentList)}></commitment-list>
          </sl-card>
        </div>
        <supply-panel ${ref(this.supplyPanel)}></supply-panel>
        <withdraw-panel ${ref(this.withdrawPanel)}></withdraw-panel>
        <accs-panel ${ref(this.accsPanel)}></accs-panel>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'node-panel': NodePanel
  }
}
