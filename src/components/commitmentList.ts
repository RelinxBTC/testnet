import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import baseStyle from '/src/base.css?inline'
import { getJson } from '../../lib/fetch'
import * as btc from '@scure/btc-signer'
import { hexToBytes } from '@noble/hashes/utils'
import { Unsubscribe, walletState } from '../lib/walletState'
import { btcNetwork } from '../../lib/network'
import { until } from 'lit/directives/until.js'
import { map } from 'lit/directives/map.js'
import { formatUnits } from '../lib/units'
import { toast } from '../lib/toast'

@customElement('commitment-list')
export class Commitments extends LitElement {
  static styles = [unsafeCSS(baseStyle)]
  @state() commitments?: Promise<Array<any>>
  @state() signatures?: Record<string, Promise<Record<string, string>>>
  private unsubscribe?: Unsubscribe

  connectedCallback(): void {
    super.connectedCallback()
    this.updateCommitments()
    this.signatures = walletState.signatures
    this.unsubscribe = walletState.subscribe((_, v) => (this.signatures = v), 'signatures')
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.unsubscribe?.()
  }

  private getSignatures(txid: string, nonce: number) {
    return this.signatures?.[`${txid}:${nonce}`] ?? walletState.getSignatures(txid, nonce)
  }

  public updateCommitments() {
    this.commitments = walletState
      .getNetwork()
      .then((network) => fetch(`/api/commitments?network=${network}`))
      .then(getJson)
  }

  render() {
    return html` ${until(
      this.commitments?.then((commitments) => {
        return (commitments?.length ?? 0) == 0
          ? html`<div class="text-base p-2 space-x-1">
              <sl-icon name="file-earmark-x"></sl-icon><span>No Data Found.</span>
            </div> `
          : html`<sl-tree class="max-h-96 overflow-auto">
              ${map(commitments, (commitment) => {
                const tx = btc.Transaction.fromPSBT(hexToBytes(commitment.psbt))
                const output = tx.getOutput(0)
                return html`<sl-tree-item
                  class="noexpand border-t border-dashed border-t-[var(--sl-color-neutral-200)] first:border-t-0 "
                  ><div class="flex space-x-1 h-8 w-full text-sm">
                    <div class="flex-none m-auto flex items-center">
                      <sl-icon outline name="currency-bitcoin" class="h-full"></sl-icon>
                      ${output.amount ? formatUnits(output.amount, 8) : 'Bad amount'}
                    </div>
                    <div class="flex-auto w-4 m-auto truncate">
                      ${output.script
                        ? btc.Address(btcNetwork(walletState.network)).encode(btc.OutScript.decode(output.script))
                        : 'Bad address'}
                    </div>
                    <div class="flex-none m-auto flex items-center text-[var(--sl-color-neutral-400)]">
                      ${until(
                        this.getSignatures(commitment.txid, parseInt(commitment.nonce, 16)).then(
                          (signatures) => html`
                            <sl-icon .name=${signatures?.up ? 'hand-thumbs-up-fill' : 'hand-thumbs-up'}></sl-icon>
                            <sl-icon .name=${signatures?.down ? 'hand-thumbs-down-fill' : 'hand-thumbs-down'}></sl-icon>
                            <sl-tooltip
                              content=${signatures?.up && signatures?.down
                                ? 'Enough signatures, slashable'
                                : 'Not enough signatures, can not slash'}
                              hoist
                            >
                              <sl-button
                                ?disabled=${!(signatures?.up && signatures?.down)}
                                variant="text"
                                size="small"
                                @click=${() => toast('Ready to slash...')}
                                ><sl-icon name="journal-x"></sl-icon
                              ></sl-button>
                            </sl-tooltip>
                          `
                        ),
                        html`<sl-spinner></sl-spinner>`
                      )}
                    </div>
                  </div>
                </sl-tree-item>`
              })}
            </sl-tree>`
      }),
      html`<sl-spinner class="m-2"></sl-spinner>`
    )}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'commitment-list': Commitments
  }
}
