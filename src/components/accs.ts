import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import { map } from 'lit/directives/map.js'
import { until } from 'lit/directives/until.js'
import baseStyle from '/src/base.css?inline'
import style from './drawer.css?inline'
import '@shoelace-style/shoelace/dist/components/button-group/button-group'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import '@shoelace-style/shoelace/dist/components/dialog/dialog'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip'
import './accsCommitment'
import { UTXO, walletState } from '../lib/walletState'
import { SlDrawer, SlDialog, SlInput, SlButton } from '@shoelace-style/shoelace'
import { toast, toastImportant } from '../lib/toast'
import { secp256k1 } from '@noble/curves/secp256k1'
import * as hkdf from '@noble/hashes/hkdf'
import { scryptAsync } from '@noble/hashes/scrypt'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { wordlist } from '@scure/bip39/wordlists/english'
import * as bip39 from '@scure/bip39'
import * as btc from '@scure/btc-signer'
import { btcNetwork } from '../../lib/network'
import { getBody, getJson } from '../../lib/fetch'
import { scriptTLSC } from '../../lib/tlsc'

@customElement('accs-panel')
export class AccsPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() utxo?: UTXO
  @state() drawer: Ref<SlDrawer> = createRef<SlDrawer>()
  @state() wordSelector: Ref<SlInput> = createRef<SlInput>()
  @state() createCommitmentDialog: Ref<SlDialog> = createRef<SlDialog>()
  @state() selectedWord?: string
  @state() rootKey?: Uint8Array
  @state() rootKeyPub?: Uint8Array
  @state() commitmentNonce?: number
  @state() commitmentKey?: Uint8Array
  @state() commitmentKeyPub?: Uint8Array
  @state() commitmentAddress?: string
  @state() commitments?: Promise<Record<string, any>>

  @state() placement = 'end'
  private mediaQueryList = globalThis.matchMedia('(min-width:640px)')
  private updatePlacement = ({ matches }: MediaQueryListEvent | MediaQueryList) =>
    (this.placement = matches ? 'end' : 'bottom')

  private walletStateUnsub: any
  private onShow = (ev: Event) => {
    if (ev.target != this.drawer.value) return
    this.updatePlacement(this.mediaQueryList)
    this.mediaQueryList.addEventListener('change', this.updatePlacement)

    this.walletStateUnsub = walletState.subscribe((_, v) => {
      this.utxo = v[0]
      this.updateCommitments()
    }, '_utxos')
  }

  private onHide = (ev: Event) => {
    if (ev.target != this.drawer.value) return
    this.mediaQueryList.removeEventListener('change', this.updatePlacement)
    this.walletStateUnsub()
  }

  private updateCommitments() {
    this.commitments = fetch(`/api/commitments?txid=${this.utxo?.txid}`).then(getJson)
  }

  public show() {
    this.updateCommitments()
    this.generateKey()
    return this.drawer.value?.show().then(() => this.wordSelector.value?.focus())
  }

  public hide() {
    return this.drawer.value?.hide()
  }

  render() {
    return html`
      <sl-drawer
        ${ref(this.drawer)}
        @sl-show=${this.onShow}
        @sl-hide=${this.onHide}
        .placement=${this.placement}
        class="[&::part(title)]:pb-0"
      >
        <span slot="label">ACCs<span class="text-xs">(Accountable Custody Commitments)</span></span>
        <sl-tooltip>
          <span slot="content" class="break-words text-xs font-mono">${this.utxo?.txid}</span>
          <span class="inline-block w-full truncate text-xs font-mono text-[var(--sl-color-green-500)]"
            >txid:${this.utxo?.txid}</span
          >
        </sl-tooltip>
        <h4 class="text-sl-neutral-600 border-b border-[var(--sl-panel-border-color)] my-2">Commitments</h4>
        <ul class="text-xs font-mono">
          ${until(
            this.commitments?.then((commitments) =>
              Object.keys(commitments ?? {}).length == 0
                ? html`<li>No commitments yet.</li>`
                : map(
                    Object.entries(commitments ?? {}),
                    ([key, value]) =>
                      html`<li class="border-t border-t-[var(--sl-color-neutral-100)] first:border-t-0">
                        <accs-commitment
                          class="flex space-x-1 h-8"
                          .rootKey=${this.rootKey}
                          .psbt=${value.psbt}
                          .txid=${this.utxo?.txid}
                          .n=${parseInt(key, 16)}
                          .s=${value.s}
                        ></accs-commitment>
                      </li>`
                  )
            ),
            html`<li><sl-spinner></sl-spinner></li>`
          )}
        </ul>
        ${when(
          !this.rootKey,
          () => html`
            <sl-divider></sl-divider>
            <div class="space-y-2">
              <form
                @submit=${(ev: Event) => {
                  this.setWord()
                  ev.preventDefault()
                }}
              >
                <sl-input ${ref(this.wordSelector)} label="Enter something to generate one time keys" clearable>
                  <span slot="help-text"
                    >One time keys are generated with entered characters, txid and a nonce.<br /><span
                      class="text-[var(--sl-color-warning-600)]"
                      >You won't loose your bitcoins if you forget the phrase, but will not be able to use generated one
                      time keys anymore.</span
                    ><br />A much more complex mechanism will be used in production.</span
                  >
                  ${map(wordlist, (word) => html`<sl-option value="${word}">${word}</sl-option>`)}
                </sl-input>
                <div class="space-x-4">
                  <sl-button
                    @click=${() =>
                      (this.wordSelector.value!.value = bip39
                        .generateMnemonic(wordlist, 128)
                        .split(' ')
                        .slice(0, 4)
                        .join(' '))}
                    >Random</sl-button
                  >
                  <sl-button variant="primary" type="submit">Set</sl-button>
                </div>
              </form>
            </div>
          `,
          () => html`
            <div class="flex w-full mt-4">
              <sl-button size="small" outline class="m-auto" @click=${() => this.showCreateDialog()}>
                <sl-icon slot="prefix" name="plus-lg"></sl-icon>Create Commitment
              </sl-button>
            </div>
            <sl-divider></sl-divider>
            <div class="text-[var(--sl-color-neutral-600)]">
              Secret Phrase:
              <span class="font-mono break-words text-[var(--sl-color-neutral-700)]">${this.selectedWord}</span>
              (<sl-button
                variant="text"
                size="medium"
                @click=${() => (this.selectedWord = this.rootKey = this.rootKeyPub = undefined)}
                class="[&::part(label)]:p-0"
                >change</sl-button
              >)
            </div>
            <div class="text-[var(--sl-color-neutral-600)]">
              Root Public Key:
              <span class="text-sm font-mono break-words text-[var(--sl-color-neutral-700)]">
                ${bytesToHex(this.rootKeyPub!)}
              </span>
            </div>

            <sl-dialog ${ref(this.createCommitmentDialog)}>
              <span slot="label">Create Commitment</span>
              <sl-tooltip>
                <span slot="content" class="break-words text-xs font-mono"
                  >TxID: ${this.utxo?.txid}<br />RootPublicKey: ${bytesToHex(this.rootKeyPub!)}</span
                >
                <span class="inline-block w-full truncate text-xs font-mono text-[var(--sl-color-green-500)]"
                  >TxID:${this.utxo?.txid}<br />RootPublicKey:${bytesToHex(
                    this.rootKeyPub!
                  )}<br />Nonce:${this.commitmentNonce?.toString(16)}</span
                >
              </sl-tooltip>
              <h4 class="text-sl-neutral-600 mt-2">Commitment Output Address</h4>
              <div class="font-mono break-words text-xs text-[var(--sl-color-neutral-700)]">
                ${this.commitmentAddress}
              </div>
              <h4 class="text-sl-neutral-600 mt-2">Commitment Output Script</h4>
              <pre
                class="mt-2 p-1 px-2 w-full overflow-x-scroll text-xs text-[var(--sl-color-neutral-700)] border rounded border-[var(--sl-color-neutral-200)]"
              >
OP_2
# MPC public key
${walletState.mpcPublicKey}
# Your one time public key
${this.commitmentKeyPub ? bytesToHex(this.commitmentKeyPub) : ''}
OP_2
OP_CHECKMULTISIG</pre
              >
              <div slot="footer" class="flex space-x-2">
                <div class="text-xs text-[var(--sl-input-help-text-color)] text-left">
                  Unless your one time key is exposed, you won't loose any bitcoin, even if this PSBT is signed and
                  broadcasted by MPC.
                </div>
                <sl-button
                  slot="footer"
                  size="small"
                  variant="primary"
                  class="m-auto"
                  @click=${(ev: Event) => {
                    const btn = ev.target as SlButton
                    btn.loading = true
                    this.createCommitment().finally(() => (btn.loading = false))
                  }}
                  >Sign and Create</sl-button
                >
              </div>
            </sl-dialog>
          `
        )}
      </sl-drawer>
    `
  }

  private setWord() {
    this.selectedWord = this.wordSelector.value?.value
    this.generateKey()
  }

  private async generateKey() {
    if (this.selectedWord) {
      return scryptAsync(this.selectedWord, this.utxo!.txid, { N: 2 ** 10, r: 8, p: 1, dkLen: 32 }).then((priv) => {
        this.rootKey = priv
        this.rootKeyPub = secp256k1.getPublicKey(this.rootKey)
      })
    } else this.rootKeyPub = undefined
  }

  public static async getCommitmentKey(
    onetimeKey: Uint8Array | undefined,
    nonce: number
  ): Promise<[Uint8Array, Uint8Array, string]> {
    if (!onetimeKey) return [new Uint8Array(), new Uint8Array(), '']

    const priv = hkdf.extract(sha256, onetimeKey, new Uint8Array([nonce]))
    const pub = secp256k1.getPublicKey(priv)
    const p2wsh = await Promise.all([walletState.getMpcPublicKey(), walletState.getNetwork()]).then(
      ([mpcKey, network]) => btc.p2wsh(btc.p2ms(2, [hexToBytes(mpcKey), pub]), btcNetwork(network))
    )
    return [priv, pub, p2wsh.address!]
  }

  private async showCreateDialog() {
    var nonce = new Uint8Array(1)
    crypto.getRandomValues(nonce)
    this.commitmentNonce = nonce[0]
    ;[this.commitmentKey, this.commitmentKeyPub, this.commitmentAddress] = await AccsPanel.getCommitmentKey(
      this.rootKey,
      this.commitmentNonce
    )

    return this.createCommitmentDialog.value?.show()
  }

  private createCommitment() {
    return Promise.all([
      walletState.getPublicKey(),
      walletState.getMpcPublicKey(),
      walletState.network == 'devnet'
        ? { minimumFee: 1, fastestFee: 1 }
        : fetch(walletState.mempoolApiUrl('/api/v1/fees/recommended')).then(getJson),
      fetch(walletState.mempoolApiUrl(`/api/tx/${this.utxo?.txid}/hex`)).then(getBody)
    ])
      .then(([publicKey, mpcPubkey, feeRates, utxoHex]) => {
        const p2tr = btc.p2tr(
          undefined,
          { script: scriptTLSC(hexToBytes(mpcPubkey), hexToBytes(publicKey), this.utxo!.status.lock_blocks) },
          btcNetwork(walletState.network),
          true
        )
        const utxo = btc.Transaction.fromRaw(hexToBytes(utxoHex))
        const amount = utxo.getOutput(0).amount!
        const tx = new btc.Transaction()
        tx.addInput({
          ...p2tr,
          txid: hexToBytes(utxo.hash).reverse(),
          index: 0,
          witnessUtxo: { script: p2tr.script, amount }
        })

        // fee may not be enough, but we can not get vsize before sign and finalize
        const newFee = Math.max(300, feeRates.minimumFee, (tx.toPSBT().byteLength * feeRates.fastestFee) / 4)
        tx.addOutputAddress(this.commitmentAddress!, amount - BigInt(newFee.toFixed()), btcNetwork(walletState.network))

        var toSignInputs: any = []
        for (var i = 0; i < tx.inputsLength; i++) toSignInputs.push({ index: i, publicKey, disableTweakSigner: true })
        return walletState.connector
          ?.signPsbt(bytesToHex(tx.toPSBT()), { autoFinalized: false, toSignInputs })
          .then((psbtHex) => {
            console.log('signed psbt', psbtHex)
            const finalTx = btc.Transaction.fromPSBT(hexToBytes(psbtHex), { allowUnknownInputs: true })
            if (!finalTx.isFinal) finalTx.finalize()

            const minimumFee = finalTx.vsize * feeRates.minimumFee
            const fastestFee = finalTx.vsize * feeRates.fastestFee
            if (minimumFee <= finalTx.fee) return psbtHex

            const errMsg = new Error(
              `We need to sign tx again because minimum fee not met, we are ${finalTx.fee}, minimum is ${minimumFee}, fastest is ${fastestFee}`
            )
            toastImportant(errMsg)
            console.log(errMsg)
            tx.updateOutput(0, { amount: amount - BigInt(fastestFee.toFixed()) })
            return walletState.connector!.signPsbt(bytesToHex(tx.toPSBT()), { autoFinalized: false, toSignInputs })
          })
          .then((psbtHex) => {
            const signature = secp256k1.sign(
              secp256k1.CURVE.hash(new Uint8Array([this.commitmentNonce!])),
              this.commitmentKey!
            )
            return fetch(
              `/api/commitments?txid=${this.utxo?.txid}&nonce=${this.commitmentNonce?.toString(16)}&network=${
                walletState.network
              }`,
              {
                method: 'POST',
                body: JSON.stringify({
                  psbt: psbtHex,
                  txid: this.utxo?.txid,
                  nonce: this.commitmentNonce?.toString(16),
                  pub: bytesToHex(this.rootKeyPub!),
                  s: signature.s.toString(16)
                })
              }
            )
          })
          .then((res) => {
            if (res.status == 200) {
              return res.text()
            }
            return res.text().then((text) => {
              console.error(res.status, text, res)
              throw new Error(text)
            })
          })
          .then(() => {
            toastImportant(`Commitment #${this.commitmentNonce?.toString(16)} created.`)
            this.updateCommitments()
            this.createCommitmentDialog.value?.hide()
          })
          .catch((e) => {
            console.warn(e)
            toast(e)
          })
      })
      .catch((e) => {
        console.error(e)
        toastImportant(e)
      })
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'accs-panel': AccsPanel
  }
}
