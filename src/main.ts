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
import './components/utxos'
import { SupplyPanel } from './components/supply'
import { UtxoRow } from './components/utxos'
import { Unsubscribe, walletState } from './lib/walletState'
import { formatUnits } from './lib/units'
import { Balance } from './lib/wallets'
import { getJson } from '../lib/fetch'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { scriptTLSC } from '../lib/tlsc'
import { toastImportant } from './lib/toast'

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
  @state() UtxoRow: Ref<UtxoRow> = createRef<UtxoRow>()
  @state() progress: Ref<SlProgressBar> = createRef<SlProgressBar>()
  @state() protocolBalance?: Balance
  @state() utxos?: []
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]

  private protocolBalanceUpdater?: Promise<any>
  private utxoUpdater?: Promise<any>
  private stateUnsubscribes: Unsubscribe[] = []

  connectedCallback(): void {
    super.connectedCallback()
    this.stateUnsubscribes.push(
      walletState.subscribe((k, v) => {
        console.log(k, v)
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
            if (v) {
              walletState.updateBalance()
              walletState.updateProtocolBalance()
            }
            break
        }
      })
    )
    this.protocolBalanceUpdater ??= this.updateProtocolBalance()
    this.utxoUpdater ??= this.updateProtocolUtxos()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.stateUnsubscribes.forEach((f) => f())
    this.stateUnsubscribes = []
  }

  async updateProtocolUtxos() {
    while (true) {
      await walletState.updateUTXOs().catch((e) => console.log(`failed to update utxo list, error:`, e))
      await new Promise((r) => setTimeout(r, 60000))
    }
  }

  async updateProtocolBalance() {
    while (true) {
      await walletState
        .updateProtocolBalance()
        .catch((e) => console.log(`failed to update protocol balance, error:`, e))
      await new Promise((r) => setTimeout(r, 60000))
    }
  }

  supply() {
    this.supplyPanel.value?.show()
  }

  withdrawMPC() {
    Promise.all([walletState.connector!.publicKey, walletState.connector?.accounts]).then(
      async ([publicKey, accounts]) => {
        var res = await fetch(`/api/withdraw?pub=${publicKey}&address=${accounts?.[0]}`).then(getJson)
        if (!res.psbt) {
          console.warn('withdraw tx not generated', res)
          return
        }
        var tx = btc.Transaction.fromPSBT(hex.decode(res.psbt))
        var toSignInputs = []
        for (var i = 0; i < tx.inputsLength; i++) toSignInputs.push({ index: i, publicKey, disableTweakSigner: true })
        walletState.connector
          ?.signPsbt(res.psbt, {
            autoFinalized: true,
            toSignInputs
          })
          .then((hex) => {
            walletState.connector?.pushPsbt(hex).then((id) => console.log(id))
          })
      }
    )
  }

  withdrawWithoutMPC() {
    Promise.all([
      walletState.connector!.publicKey,
      walletState.connector?.accounts,
      fetch(`/api/mpcPubkey`).then(getJson),
      fetch('https://mempool.space/testnet/api/v1/fees/recommended').then(getJson)
    ])
      .then(async ([publicKey, accounts, { key: mpcPubkey }, feeRates]) => {
        const p2tr = btc.p2tr(
          undefined,
          { script: scriptTLSC(hex.decode(mpcPubkey), hex.decode(publicKey)) },
          btc.TEST_NETWORK,
          true
        )
        var value = 0
        const utxos: [] = await fetch(`https://mempool.space/testnet/api/address/${p2tr.address}/utxo`)
          .then(getJson)
          .then((utxos) =>
            utxos
              .map((utxo: any) => {
                console.log(utxo)
                value += utxo.value
                return {
                  ...p2tr,
                  txid: utxo.txid,
                  index: utxo.vout,
                  witnessUtxo: { script: p2tr.script, amount: BigInt(utxo.value) }
                }
              })
              .filter((utxo: any) => utxo != undefined)
          )
        const tx = new btc.Transaction()
        utxos.forEach((utxo: any) => tx.addInput(utxo))
        if (tx.inputsLength == 0) throw new Error('No UTXO can be withdrawn')

        // fee may not be enough, but we can not get vsize before sign and finalize
        const newFee = Math.max(300, feeRates.minimumFee, (tx.toPSBT().byteLength * feeRates.fastestFee) / 4)
        tx.addOutputAddress(accounts![0], BigInt((value - newFee).toFixed()), btc.TEST_NETWORK)

        var toSignInputs = []
        for (var i = 0; i < tx.inputsLength; i++) toSignInputs.push({ index: i, publicKey, disableTweakSigner: true })
        return walletState.connector
          ?.signPsbt(hex.encode(tx.toPSBT()), {
            autoFinalized: true,
            toSignInputs
          })
          .then((hex) => walletState.connector?.pushPsbt(hex).then((id) => console.log(id)))
      })
      .catch((e) => {
        console.error(e)
        toastImportant(e)
      })
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
          <sl-button class="supply" variant="success" @click=${() => this.withdrawMPC()} pill>
            <sl-icon slot="prefix" name="dash-circle-fill"></sl-icon>
            Withdraw With MPC
          </sl-button>
          <sl-button class="supply" variant="success" @click=${() => this.withdrawWithoutMPC()} pill>
            <sl-icon slot="prefix" name="dash-circle-fill"></sl-icon>
            Withdraw Without MPC
          </sl-button>
        </div>
      </div>
      <div class="grid grid-cols-5 space-y-5 sm:grid-cols-12 sm:space-x-5 sm:space-y-0">
        <div class="col-span-7">
          <div class="relative panel !rounded-none">
            <ul>
              <li class="text-xs mb-3">Deposits</li>
              ${when(this.utxos == undefined, () => html` <sl-progress-bar indeterminate></sl-progress-bar> `)}
              ${map(this.utxos, (utxo) => {
                console.log(utxo)
                return html`<li>
                  <utxo-row class="py-4 flex items-center" .utxo=${utxo}></utxo-row>
                </li>`
              })}
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
            <sl-divider class="my-8"></sl-divider>
            <div class="flex">
              <div class="flex-1">
                <span class="text-xs text-sl-neutral-600">Supply APR</span>
                <div class="mt-2">2.65%</div>
              </div>
            </div>
            <supply-panel ${ref(this.supplyPanel)}></supply-panel>
          </div>

          <div class="relative panel"></div>
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
