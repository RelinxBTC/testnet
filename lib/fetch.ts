export class FetchError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message)
    this.status = status
  }
}

export function getJson(res: Response) {
  if (res.status != 200)
    return res.text().then((text) => {
      throw new FetchError(res.status, text)
    })
  return res.json().catch(console.warn)
}

export function getBody(res: Response) {
  if (res.status != 200)
    return res.text().then((text) => {
      throw new FetchError(res.status, text)
    })
  return res.text()
}
