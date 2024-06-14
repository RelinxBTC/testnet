import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import '@shoelace-style/shoelace/dist/components/input/input'
import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import style from './utxo.css?inline'
import baseStyle from '/src/base.css?inline'

@customElement('utxo-row')
export class UtxoRow extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() utxo?: Object

  connectedCallback(): void {
    super.connectedCallback()
    console.log(JSON.stringify(this.utxo))
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
  }

  render() {
    return html` <span>This is a test row</span> `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'utxo-row': UtxoRow
  }
}
