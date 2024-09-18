import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/button-group/button-group'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import style from './provider.css?inline'
import baseStyle from '../base.css?inline'
import './timer.ts'

@customElement('wallet-panel')
export class WalletPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @state() providers: any = []

  connectedCallback(): void {
    super.connectedCallback()
  }

  render() {
    return html`
      <div class="grid grid-cols-12 space-y-4 sm:grid-cols-12 sm:space-x-4 sm:space-y-0">
        <div class="col-span-12"></div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wallet-panel': WalletPanel
  }
}
