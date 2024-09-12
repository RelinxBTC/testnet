import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/button-group/button-group'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import style from './provider.css?inline'
import baseStyle from '../base.css?inline'
import { getElapsedTime } from '../../../src/lib/units'

@customElement('timer-ago')
export class TimerAgo extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @state() elapsed: any = 'N/A'
  @state() interval: any
  @property() timestamp?: number

  connectedCallback(): void {
    super.connectedCallback()
    this.updateTime()
    this.interval = setInterval(() => this.updateTime(), 3000)
  }
  disconnectedCallback() {
    clearInterval(this.interval)
  }

  public updateTime() {
    this.elapsed = getElapsedTime(this.timestamp)
  }

  render() {
    return html` <div>${this.elapsed}</div> `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'timer-ago': TimerAgo
  }
}
