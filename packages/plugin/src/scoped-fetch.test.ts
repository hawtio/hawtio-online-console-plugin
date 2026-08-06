import fetchMock from 'jest-fetch-mock'
import { scopedFetch, basePath } from './scoped-fetch'
import { getCSRFToken } from './utils/https'

// Mock the utils/https module
jest.mock('./utils/https', () => ({
  getCSRFToken: jest.fn(),
}))

describe('scopedFetch', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
    jest.clearAllMocks()
    // Default: token is available
    ;(getCSRFToken as jest.Mock).mockReturnValue('test-csrf-token')
  })

  describe('timeout functionality', () => {
    it('should add timeout signal to Hawtio requests', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const url = `${basePath}/gateway/management/test`
      await scopedFetch(url)

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.signal).toBeDefined()
    })

    it('should timeout after 30 seconds for slow requests', async () => {
      jest.useFakeTimers()

      fetchMock.mockImplementation((_, init) => {
        return new Promise((resolve, reject) => {
          const signal = init?.signal
          if (signal?.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'))
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })

      const url = `${basePath}/gateway/management/test`
      const promise = scopedFetch(url)

      // Fast-forward time past the 30-second default timeout
      jest.advanceTimersByTime(30000)

      await expect(promise).rejects.toThrow()

      jest.useRealTimers()
    })

    it('should merge existing signal with timeout signal', async () => {
      const controller = new AbortController()

      fetchMock.mockImplementation((_, init) => {
        return new Promise((resolve, reject) => {
          const signal = init?.signal
          if (signal?.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'))
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })

      const url = `${basePath}/gateway/management/test`
      const promise = scopedFetch(url, { signal: controller.signal })

      // Trigger abort on the passed controller
      controller.abort()

      await expect(promise).rejects.toThrow()
    })

    it('should not add timeout to non-Hawtio requests', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ data: 'test' }))

      const url = 'https://external-api.com/data'
      await scopedFetch(url)

      // Should call window.fetch directly without modifications
      expect(fetchMock).toHaveBeenCalledWith(url, undefined)
    })
  })

  describe('CSRF token handling', () => {
    it('should add CSRF token to Hawtio request headers', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const url = `${basePath}/gateway/management/test`
      await scopedFetch(url)

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.headers?.get('X-CSRFToken')).toBe('test-csrf-token')
    })

    it('should wait for CSRF token if not immediately available', async () => {
      let callCount = 0
      ;(getCSRFToken as jest.Mock).mockImplementation(() => {
        callCount++
        return callCount > 2 ? 'delayed-token' : null
      })

      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const url = `${basePath}/gateway/management/test`
      await scopedFetch(url)

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.headers?.get('X-CSRFToken')).toBe('delayed-token')
      expect(callCount).toBeGreaterThan(2)
    })

    it('should proceed without token if unavailable after retries', async () => {
      ;(getCSRFToken as jest.Mock).mockReturnValue(null)

      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const url = `${basePath}/gateway/management/test`
      await scopedFetch(url)

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.headers?.get('X-CSRFToken')).toBeNull()
    })

    it('should not add CSRF token to non-Hawtio requests', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ data: 'test' }))

      const url = 'https://external-api.com/data'
      await scopedFetch(url)

      expect(fetchMock).toHaveBeenCalledWith(url, undefined)
    })
  })

  describe('URL rewriting', () => {
    it('should rewrite hawtconfig.json URL', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ config: 'test' }))

      await scopedFetch('//hawtconfig.json')

      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe(`${basePath}/hawtconfig.json`)
    })

    it('should rewrite preset-connections URL', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ connections: [] }))

      await scopedFetch('//preset-connections')

      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe(`${basePath}/preset-connections`)
    })

    it('should rewrite session-timeout URL', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ timeout: 3600 }))

      await scopedFetch('auth/config/session-timeout?test=1')

      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe(`${basePath}/auth/config/session-timeout?test=1`)
    })

    it('should track but not rewrite management gateway URLs', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const managementUrl = `${basePath}/gateway/management/namespaces/test/pods/test-pod:8778/jolokia/version`
      await scopedFetch(managementUrl)

      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe(managementUrl)
    })
  })

  describe('Request object handling', () => {
    it('should handle Request objects with timeout', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const url = `${basePath}/gateway/management/test`
      const request = new Request(url, {
        method: 'POST',
        body: JSON.stringify({ type: 'version' }),
      })

      await scopedFetch(request)

      expect(fetchMock).toHaveBeenCalled()
      const [callArg] = fetchMock.mock.calls[0]
      expect(callArg).toBeInstanceOf(Request)
    })

    it('should preserve Request method and body', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const url = `${basePath}/gateway/management/test`
      const body = JSON.stringify({ type: 'list' })
      const request = new Request(url, {
        method: 'POST',
        body,
      })

      await scopedFetch(request)

      const [callArg] = fetchMock.mock.calls[0]
      expect(callArg).toBeInstanceOf(Request)
      expect(callArg.method).toBe('POST')
    })

    it('should add CSRF token to Request objects', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const url = `${basePath}/gateway/management/test`
      const request = new Request(url, { method: 'POST' })

      await scopedFetch(request)

      const [callArg] = fetchMock.mock.calls[0]
      expect(callArg.headers.get('X-CSRFToken')).toBe('test-csrf-token')
    })
  })

  describe('Content-Type header', () => {
    it('should set Content-Type to application/json for Hawtio requests', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ value: { agent: 'test' } }))

      const url = `${basePath}/gateway/management/test`
      await scopedFetch(url)

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.headers?.get('Content-Type')).toBe('application/json')
    })

    it('should not modify Content-Type for non-Hawtio requests', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ data: 'test' }))

      const url = 'https://external-api.com/data'
      await scopedFetch(url, {
        headers: { 'Content-Type': 'text/plain' },
      })

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.headers?.['Content-Type']).toBe('text/plain')
    })
  })
})
