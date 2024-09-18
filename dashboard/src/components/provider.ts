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

@customElement('provider-row')
export class ProviderRow extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @state() providers: any = []
  @state() headers = ['Status', 'Name', '$BTC SC', 'Address', 'Total Commits', 'Last Commit']

  connectedCallback(): void {
    super.connectedCallback()
    this.providers.push({
      status: 'live',
      name: 'Relinx Main Node0',
      sc: '12.98 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '1234',
      last: (Date.now() - Math.floor(Math.random() * 30000)) / 1000
    })
    this.providers.push({
      status: 'live',
      name: 'Relinx Main Node1',
      sc: '11.8 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '251',
      last: (Date.now() - Math.floor(Math.random() * 50000)) / 1000
    })
    this.providers.push({
      status: 'offline',
      name: 'Relinx Main Node3',
      sc: '9.8 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '44',
      last: (Date.now() - Math.floor(Math.random() * 80000)) / 1000
    })

    this.providers.push({
      status: 'live',
      name: 'Relinx Main Node4',
      sc: '19.8 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '2244',
      last: (Date.now() - Math.floor(Math.random() * 100000)) / 1000
    })

    this.providers.push({
      status: 'live',
      name: 'Relinx Main Node5',
      sc: '37.1 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '4674',
      last: (Date.now() - Math.floor(Math.random() * 120000)) / 1000
    })
    this.providers.push({
      status: 'offline',
      name: 'Relinx Main Node6',
      sc: '12.18 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '12',
      last: (Date.now() - Math.floor(Math.random() * 120000)) / 1000
    })
    this.providers.push({
      status: 'live',
      name: 'Relinx Main Node7',
      sc: '76.8 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '122',
      last: (Date.now() - Math.floor(Math.random() * 110000)) / 1000
    })
    this.providers.push({
      status: 'live',
      name: 'Relinx Main Node8',
      sc: '3.83 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '234',
      last: (Date.now() - Math.floor(Math.random() * 120000)) / 1000
    })
    this.providers.push({
      status: 'live',
      name: 'Relinx Main Node9',
      sc: '45.1 BTC',
      address: 'tb1q63qaf4xu0fl6pjzd9hpe3fjktj8qk2ufmuc9zc',
      total: '343',
      last: (Date.now() - Math.floor(Math.random() * 10000)) / 1000
    })
  }

  render() {
    return html`
      <div class="grid grid-cols-12 space-y-4 sm:grid-cols-12 sm:space-x-4 sm:space-y-0">
        <div class="col-span-12">
          <table class="border-collapse w-full text-sm table-auto">
            <thead>
              <tr>
                ${this.headers.map(
                  (header) =>
                    html`<th
                      class="border dark:border-slate-600 font-medium p-2 pl-2 pt-3 pb-3 text-slate-400 dark:text-slate-200 text-left"
                    >
                      ${header}
                    </th>`
                )}
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-slate-800">
              ${this.providers.map(
                (provider: any) =>
                  html` <tr>
                    <td
                      class="border border-slate-200 dark:border-slate-600 p-2 pl-2 ${provider.status == 'live'
                        ? 'text-lime-600'
                        : 'text-red-600'}"
                    >
                      ${provider.status}
                    </td>
                    <td
                      class="border border-slate-200 dark:border-slate-600 p-2 pl-2 text-slate-500 dark:text-slate-400"
                    >
                      ${provider.name}
                    </td>
                    <td
                      class="border border-slate-200 dark:border-slate-600 p-2 pl-2 text-slate-500 dark:text-slate-400"
                    >
                      ${provider.sc}
                    </td>
                    <td
                      class="border border-slate-200 dark:border-slate-600 p-2 pl-2 text-slate-500 dark:text-slate-400 break-words"
                    >
                      <span title="${provider.address}"
                        >${provider.address.substring(0, 4) +
                        '...' +
                        provider.address.substring(provider.address.length - 4, provider.address.length)}</span
                      >
                    </td>
                    <td
                      class="border border-slate-200 dark:border-slate-600 p-2 pl-2 text-slate-500 dark:text-slate-400"
                    >
                      ${provider.total}
                    </td>
                    <td
                      class="border border-slate-200 dark:border-slate-600 p-2 pl-2 text-slate-500 dark:text-slate-400"
                    >
                      <timer-ago timestamp=${provider.last}></timer-ago>
                    </td>
                  </tr>`
              )}
            </tbody>
          </table>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'provider-row': ProviderRow
  }
}
