import { api } from '../api/client.js'

/** The catalogue changes only when the API is redeployed, so one fetch serves the whole session. */
let pending = null

export function loadCatalog() {
  pending ??= api.templates().catch((failure) => {
    pending = null
    throw failure
  })
  return pending
}
