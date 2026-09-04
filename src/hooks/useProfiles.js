import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'

const DEFAULT_QUERY = { search: '', tag: '', sort: 'updatedAt', direction: 'desc', page: 0, size: 15 }

/** Owns the profile list: query state, paging, and the headline stats that sit beside it. */
export function useProfiles(onError, enabled = true) {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState({ items: [], totalItems: 0, totalPages: 0 })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  // Counts the requests sent, so a slow one that lands late cannot overwrite a newer answer.
  const latestRequest = useRef(0)

  // Typing in the search box should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.search), 250)
    return () => clearTimeout(timer)
  }, [query.search])

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const request = (latestRequest.current += 1)
    setLoading(true)
    try {
      const [result, storeStats] = await Promise.all([
        api.list({ ...query, search: debouncedSearch }),
        api.stats(),
      ])
      if (request !== latestRequest.current) return
      setPage(result)
      setStats(storeStats)
      setError(null)
    } catch (failure) {
      if (request !== latestRequest.current) return
      setError(failure.message)
      onError?.(failure.message)
    } finally {
      if (request === latestRequest.current) setLoading(false)
    }
    // `query` is read in full, but only the fields below should trigger a reload — `search` is
    // covered by its debounced copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.sort, query.direction, query.page, query.size, query.tag, debouncedSearch, enabled, onError])

  useEffect(() => {
    load()
  }, [load])

  const update = useCallback((changes) => {
    // Any change other than paging sends us back to the first page.
    setQuery((current) => ({ ...current, page: 0, ...changes }))
  }, [])

  return { query, update, page, stats, loading, error, refresh: load }
}
