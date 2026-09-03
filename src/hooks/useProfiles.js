import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

/** Owns the document list: query state, paging, and the headline stats that sit beside it. */
export function useProfiles(onError, enabled = true) {
  const [query, setQuery] = useState({ search: '', tag: '', sort: 'updatedAt', direction: 'desc', page: 0, size: 15 })
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState({ items: [], totalItems: 0, totalPages: 0 })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.search), 250)
    return () => clearTimeout(timer)
  }, [query.search])

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const [result, storeStats] = await Promise.all([
        api.list({ ...query, search: debouncedSearch }),
        api.stats(),
      ])
      setPage(result)
      setStats(storeStats)
      setError(null)
    } catch (failure) {
      setError(failure.message)
      onError?.(failure.message)
    } finally {
      setLoading(false)
    }
  }, [query.sort, query.direction, query.page, query.size, query.tag, debouncedSearch, enabled, onError]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  const update = useCallback((changes) => {
    // Any change other than paging sends us back to the first page.
    setQuery((current) => ({ ...current, page: 0, ...changes }))
  }, [])

  return { query, update, page, stats, loading, error, refresh: load }
}
