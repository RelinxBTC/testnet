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
import { toastImportant } from '../lib/toast'
import { getJson } from '../../lib/fetch'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { scriptTLSC } from '../../lib/tlsc'

@customElement('withdraw-panel')
export class WithdrawPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() coin = 'Bitcoin'
  @state() drawer: Ref<SlDrawer> = createRef<SlDrawer>()
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() inputValue = 0
  @state() adding = false
  @state() erro_msg = ''

  get balanceConfirmed() {
    return walletState.balance?.confirmed ?? 0
  }

  get balanceReleased() {
    // return 0
    var value = 0
    this.utxos.map((utxo: any) => {
      console.log(utxo)
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

  public show() {
    console.log('show event!')
    return this.drawer.value?.show()
  }

  withdraw() {
    this.input.value?.setCustomValidity('')
    var amount = this.input.value!.valueAsNumber * 1e8
    if (this.balanceReleased > 0 && amount > this.balanceReleased) {
      this.input.value?.setCustomValidity("Can't withdraw more than released.")
      this.input.value?.reportValidity()
      return
    }
    if (this.balanceReleased == 0 && amount > this.balance) {
      this.input.value?.setCustomValidity('Withdrawal amount exceeds balance.')
      this.input.value?.reportValidity()
      return
    }
    if (this.balanceReleased > 0) {
      this.withdrawWithoutMPC()
    } else {
      this.withdrawMPC()
    }
  }

  withdrawMPC() {
    var amount = this.input.value!.valueAsNumber * 1e8
    Promise.all([walletState.connector!.publicKey, walletState.connector?.accounts]).then(
      async ([publicKey, accounts]) => {
        var res = await fetch(`/api/withdraw?pub=${publicKey}&address=${accounts?.[0]}&amt=${amount}`).then(getJson)
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
        var amt = this.input.value!.valueAsNumber * 1e8
        const utxos: [] = await fetch(`https://mempool.space/testnet/api/address/${p2tr.address}/utxo`)
          .then(getJson)
          .then((utxos) =>
            utxos
              .map((utxo: any) => {
                console.log(utxo)
                if (value > amt) {
                  return
                }
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
        tx.addOutputAddress(accounts![0], BigInt((amt - newFee).toFixed()), btc.TEST_NETWORK)

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
    return html`
      <sl-drawer
        ${ref(this.drawer)}
        placement="bottom"
        no-header
        ?contained=${globalThis.matchMedia('(min-width:640px').matches}
        class="drawer-placement-bottom sm:drawer-contained"
      >
        <span class="font-medium text-xs" style="color:var(--sl-color-green-500)">Withdraw ${this.coin}</span>
        <div class="flex items-center mt-5">
          <sl-input
            ${ref(this.input)}
            class="flex-auto mr-2"
            size="large"
            placeholder="0"
            filled
            type="number"
            @sl-input=${() => (this.inputValue = this.input.value!.valueAsNumber)}
          ></sl-input>
          ${when(
            this.balanceReleased > 0,
            () =>
              html` <sl-button
                size="small"
                @click=${() => {
                  this.inputValue = this.balanceReleased / 1e8
                  this.input.value!.value = this.inputValue.toString()
                }}
                pill
                >Max Released</sl-button
              >`
          )}
          ${when(
            this.balanceReleased == 0,
            () =>
              html` <sl-button
                size="small"
                @click=${() => {
                  this.inputValue = this.balance / 1e8
                  this.input.value!.value = this.inputValue.toString()
                }}
                pill
                >Max</sl-button
              >`
          )}
        </div>
        <div class="flex text-xs items-center text-sl-neutral-600">
          ${this.balanceReleased == 0 ? 'Current withdraw needs MPC signature.' : ''}
        </div>
        <div class="flex text-xs items-center text-sl-neutral-600">
          <sl-icon outline name="currency-bitcoin"></sl-icon>
          ${Math.floor(this.balance / 1e8)}.${Math.floor((this.balance % 1e8) / 1e4)
            .toString()
            .padStart(4, '0')}
          (${Math.floor(this.balanceReleased / 1e8)}.${Math.floor((this.balanceReleased % 1e8) / 1e4)
            .toString()
            .padStart(4, '0')}
          Released)
        </div>

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
