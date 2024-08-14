import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import baseStyle from '/src/base.css?inline'
import * as btc from '@scure/btc-signer'
import { hexToBytes } from '@noble/hashes/utils'
import { Unsubscribe, walletState } from '../lib/walletState'
import { btcNetwork } from '../../lib/network'
import { AccsPanel } from './accs'
import * as mod from '@noble/curves/abstract/modular'
import { bytesToNumberBE } from '@noble/curves/abstract/utils'
import { secp256k1 } from '@noble/curves/secp256k1'
import { toast } from '../lib/toast'
import { SlButton } from '@shoelace-style/shoelace'
import { until } from 'lit/directives/until.js'

function modN(a: bigint) {
  return mod.mod(a, secp256k1.CURVE.n)
}
function invN(a: bigint) {
  return mod.invert(a, secp256k1.CURVE.n)
}

@customElement('accs-commitment')
export class AccsCommitment extends LitElement {
  static styles = [unsafeCSS(baseStyle)]
  @property() txid?: string // txid that commitment relates to
  @property() n?: number // nonce of commitment
  @property() s?: string // s in signature
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
    const [priv, nonce, s] = [this.priv, this.n, this.s]
    return (async () => {
      if (!priv || !nonce || !s) throw new Error('not ready')
      const msgHash = secp256k1.CURVE.hash(msg)
      const a = bytesToNumberBE(priv)
      const nonceHash = secp256k1.CURVE.hash(new Uint8Array([nonce]))
      const signature = secp256k1.sign(nonceHash, priv)
      // s = (r*a + m) / k
      if (signature.s.toString(16) != s) throw new Error('signature mismatch')
      // r2 = (r1*a + m1 - m2) / a
      return modN(modN(signature.r * a + bytesToNumberBE(nonceHash) - bytesToNumberBE(msgHash)) * invN(a))
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
