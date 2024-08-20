import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import baseStyle from '/src/base.css?inline'
import * as btc from '@scure/btc-signer'
import { hexToBytes } from '@noble/hashes/utils'
import { Unsubscribe, walletState } from '../lib/walletState'
import { btcNetwork } from '../../lib/network'
import { AccsPanel } from './accs'
import { modN, invN } from '../../lib/mod'
import { bytesToNumberBE } from '@noble/curves/abstract/utils'
import { secp256k1 } from '@noble/curves/secp256k1'
import { toast } from '../lib/toast'
import { SlButton } from '@shoelace-style/shoelace'
import { until } from 'lit/directives/until.js'
import { RecoveredSignatureType } from '@noble/curves/abstract/weierstrass'

@customElement('accs-commitment')
export class AccsCommitment extends LitElement {
  static styles = [unsafeCSS(baseStyle)]
  @property() txid?: string // txid that commitment relates to
  @property() n?: number // nonce of commitment
  @property() s?: RecoveredSignatureType // signature
  @property() psbt?: string // commitment psbt
  @property() rootKey?: Uint8Array // txid root key
  @state() keyMatches = false
  @state() derivedAddr?: string
  @state() priv?: Uint8Array
  @state() signatures?: Promise<Record<string, string>>
  private unsubscribe?: Unsubscribe

  connectedCallback(): void {
    super.connectedCallback()
    const tx = btc.Transaction.fromPSBT(hexToBytes(this.psbt!))
    this.derivedAddr = btc
      .Address(btcNetwork(walletState.network))
      .encode(btc.OutScript.decode(tx.getOutput(0).script!))
    AccsPanel.getCommitmentKey(this.rootKey, this.n!).then(([priv, _, addr]) => {
      this.priv = priv
      this.keyMatches = addr == this.derivedAddr
    })
    const sigKey = `${this.txid}:${this.n}`
    this.signatures = walletState.signatures?.[sigKey]
    this.unsubscribe = walletState.subscribe((_, v) => (this.signatures = v[sigKey]), 'signatures')
  }
  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.unsubscribe?.()
  }

  private getSignatures() {
    return this.signatures ?? walletState.getSignatures(this.txid!, this.n!)
  }

  private sign(msg: string) {
    const [priv, nonce, signature] = [this.priv, this.n, this.s]
    return (async () => {
      if (!priv || !nonce || !signature) throw new Error('not ready')
      const { r, s } = signature
      const a = bytesToNumberBE(priv)
      const k = modN(modN(r * a + bytesToNumberBE(secp256k1.CURVE.hash(new Uint8Array([nonce])))) * invN(s))
      const m = bytesToNumberBE(secp256k1.CURVE.hash(msg))
      // r=G*k=G*(r2*a+m) => r2=(k-m)/a
      return modN(modN(k - m) * invN(a))
    })()
      .then((r) =>
        fetch(`/api/signatures?txid=${this.txid}&nonce=${nonce!.toString(16)}&msg=${msg}`, {
          method: 'POST',
          body: r.toString(16)
        })
      )
      .then((res) => {
        if (res.status != 200)
          return res.text().then((text) => {
            console.error(res.status, text, res)
            throw new Error(text)
          })
        toast('Signature submitted.')
      })
      .catch((e) => {
        console.warn(e)
        toast(e)
      })
  }

  private clickSign(ev: Event) {
    return this.signatures?.then((signatures) => {
      const btn = (ev.target as Element).closest('sl-button') as SlButton
      const msg = btn.name
      if (
        signatures &&
        Object.keys(signatures).length > 0 &&
        !(msg in signatures) &&
        !confirm('Key already used, will be exposed if signature published. Really want to continue?')
      )
        return
      btn.loading = true
      return this.sign(msg)
        .then(() => walletState.updateSignatures(this.txid!, this.n!))
        .then((signatures) => (btn.variant = signatures[msg] ? 'primary' : 'default'))
        .finally(() => (btn.loading = false))
    })
  }

  render() {
    return html`<div class="flex-none m-auto mr-1">${this.n?.toString(16)}</div>
      <div class="flex-auto w-4 m-auto truncate">${this.derivedAddr}</div>
      <div class="flex-none m-auto">
        ${until(
          this.getSignatures().then(
            (signatures) =>
              html`<sl-tooltip
                content="${this.keyMatches ? 'Sign with this commitment' : 'One time key does not match'}"
                hoist
              >
                <sl-button-group>
                  <sl-button
                    .variant=${signatures?.up ? 'primary' : 'default'}
                    size="small"
                    ?disabled=${signatures?.up || !this.keyMatches}
                    name="up"
                    circle
                    @click=${this.clickSign}
                  >
                    <sl-icon name="hand-thumbs-up"></sl-icon>
                  </sl-button>
                  <sl-button
                    .variant=${signatures?.down ? 'primary' : 'default'}
                    size="small"
                    ?disabled=${signatures?.down || !this.keyMatches}
                    name="down"
                    circle
                    @click=${this.clickSign}
                  >
                    <sl-icon name="hand-thumbs-down"></sl-icon>
                  </sl-button>
                </sl-button-group>
              </sl-tooltip>`
          ),
          html`<sl-spinner></sl-spinner>`
        )}
      </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'accs-commitment': AccsCommitment
  }
}
