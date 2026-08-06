import fetchMock from 'jest-fetch-mock'
import { connectionService } from './connection-service'
import { K8sPod } from './types'
import { Connection, connectService, eventService } from '@hawtio/react'

// Mock dependencies
/* eslint-disable no-console */
jest.mock('./globals', () => ({
  log: {
    debug: (...args: unknown[]) => console.log('[DEBUG]', ...args),
    info: (...args: unknown[]) => console.log('[INFO]', ...args),
    warn: (...args: unknown[]) => console.log('[WARN]', ...args),
    error: (...args: unknown[]) => console.log('[ERROR]', ...args),
  },
}))

jest.mock('@hawtio/react', () => ({
  connectService: {
    loadConnections: jest.fn(),
    saveConnections: jest.fn(),
    getJolokiaUrl: jest.fn(),
    setCurrentConnection: jest.fn(),
  },
  eventService: {
    notify: jest.fn(),
  },
  SESSION_KEY_CURRENT_CONNECTION: 'current-connection',
}))

// Cast imported references to their mocked types
const mockedConnectService = jest.mocked(connectService)
const mockedEventService = jest.mocked(eventService)

const jolokiaSuccessResponse = {
  status: 200,
  timestamp: Date.now(),
  request: {
    type: 'version',
  },
  value: {
    agent: '2.5.0',
    protocol: '8.1',
    info: {
      proxy: {},
      jmx: {},
    },
  },
}

const maxRetries = 3
const delay = 0

describe('ConnectionService', () => {
  const mockPod: K8sPod = {
    metadata: {
      name: 'test-pod',
      namespace: 'test-ns',
      annotations: {},
    },
    spec: {
      containers: [
        {
          name: 'test-container',
          ports: [{ name: 'jolokia', containerPort: 8778 }],
        },
      ],
    },
    status: { phase: 'Running' },
  }

  beforeEach(() => {
    fetchMock.resetMocks()
    jest.clearAllMocks()
    mockedConnectService.loadConnections.mockReturnValue({})
    mockedConnectService.getJolokiaUrl.mockReturnValue('http://localhost:8778/jolokia')
  })

  describe('hasJolokiaPort', () => {
    it('should return true when pod has jolokia port', () => {
      const result = connectionService.hasJolokiaPort(mockPod)
      expect(result).toBe(true)
    })

    it('should return false when pod has no jolokia port', () => {
      const podWithoutJolokia: K8sPod = {
        ...mockPod,
        spec: {
          containers: [
            {
              name: 'test-container',
              ports: [{ name: 'http', containerPort: 8080 }],
            },
          ],
        },
      }
      const result = connectionService.hasJolokiaPort(podWithoutJolokia)
      expect(result).toBe(false)
    })

    it('should return false when pod has no containers', () => {
      const podWithoutContainers: K8sPod = {
        ...mockPod,
        spec: { containers: [] },
      }
      const result = connectionService.hasJolokiaPort(podWithoutContainers)
      expect(result).toBe(false)
    })
  })

  describe('probeJolokiaUrl', () => {
    it('should succeed on first attempt', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(jolokiaSuccessResponse), {
        headers: { 'content-type': 'application/json' },
      })

      const result = await connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)
      expect(result).toContain('/jolokia/version')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should include credentials in request', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(jolokiaSuccessResponse))

      await connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.credentials).toBe('include')
    })

    it('should retry on transient network failure', async () => {
      fetchMock
        .mockRejectOnce(new Error('Network error'))
        .mockRejectOnce(new Error('Network error'))
        .mockResponseOnce(JSON.stringify(jolokiaSuccessResponse))

      const result = await connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)
      expect(result).toContain('/jolokia/version')
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('should retry on 401 errors (CSRF token issues)', async () => {
      fetchMock
        .mockResponseOnce('Unauthorized', { status: 401 })
        .mockResponseOnce(JSON.stringify(jolokiaSuccessResponse))

      const result = await connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)
      expect(result).toContain('/jolokia/version')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should retry on 403 errors (CSRF token issues)', async () => {
      fetchMock.mockResponseOnce('Forbidden', { status: 403 }).mockResponseOnce(JSON.stringify(jolokiaSuccessResponse))

      const result = await connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)
      expect(result).toContain('/jolokia/version')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should NOT retry on 404 errors', async () => {
      fetchMock.mockResponseOnce('Not Found', { status: 404 })

      await expect(connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)).rejects.toThrow()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should NOT retry on 400 errors', async () => {
      fetchMock.mockResponseOnce('Bad Request', { status: 400 })

      await expect(connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)).rejects.toThrow()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should fail after max retries exhausted', async () => {
      fetchMock.mockReject(new Error('Network error'))

      await expect(connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)).rejects.toThrow(
        'Failed to probe Jolokia URL',
      )
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('should use exponential backoff between retries', async () => {
      const delays: number[] = []
      let lastTime = Date.now()

      fetchMock.mockImplementation(() => {
        const now = Date.now()
        delays.push(now - lastTime)
        lastTime = now
        return Promise.reject(new Error('Network error'))
      })

      await expect(connectionService.probeJolokiaUrl(mockPod, maxRetries, 100)).rejects.toThrow()

      // First call has no delay, second has ~1000ms, third has ~2000ms
      expect(delays[0]).toBeLessThan(100) // First call immediate
      expect(delays[1]).toBeGreaterThanOrEqual(100) // ~1000ms delay
      expect(delays[2]).toBeGreaterThanOrEqual(200) // ~2000ms delay
    }, 10000)

    it('should handle non-200 responses with error messages', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ error: 'Service unavailable' }), { status: 503 })

      await expect(connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)).rejects.toThrow()
    })

    it('should handle invalid JSON responses', async () => {
      fetchMock.mockResponseOnce('Not valid JSON', { status: 200 })

      await expect(connectionService.probeJolokiaUrl(mockPod, maxRetries, delay)).rejects.toThrow()
    })
  })

  describe('testConnection', () => {
    const mockConnection: Connection = {
      id: 'test-connection',
      name: 'test-connection',
      jolokiaUrl: 'http://localhost:8778/jolokia',
      scheme: 'http',
      host: 'localhost',
      port: 8778,
      path: '/jolokia',
    }

    beforeEach(() => {
      mockedConnectService.getJolokiaUrl.mockReturnValue(mockConnection.jolokiaUrl as string)
    })

    it('should succeed with valid connection', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(jolokiaSuccessResponse))

      const result = await connectionService['testConnection'](mockConnection, maxRetries, delay)
      expect(result).toBe(mockConnection.jolokiaUrl)
    })

    it('should use POST method with version request', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(jolokiaSuccessResponse))

      await connectionService['testConnection'](mockConnection, maxRetries, delay)

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.method).toBe('post')
      expect(options?.body).toBe(JSON.stringify({ type: 'version' }))
    })

    it('should include credentials in request', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(jolokiaSuccessResponse))

      await connectionService['testConnection'](mockConnection, maxRetries, delay)

      const [, options] = fetchMock.mock.calls[0]
      expect(options?.credentials).toBe('include')
    })

    it('should retry on transient failures', async () => {
      let callCount = 0

      fetchMock.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve(
          new Response(JSON.stringify(jolokiaSuccessResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      })

      const result = await connectionService['testConnection'](mockConnection, maxRetries, delay)
      expect(result).toBe(mockConnection.jolokiaUrl)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should retry on 401/403 errors', async () => {
      fetchMock
        .mockResponseOnce('Unauthorized', { status: 401 })
        .mockResponseOnce(JSON.stringify(jolokiaSuccessResponse))

      const result = await connectionService['testConnection'](mockConnection, maxRetries, delay)
      expect(result).toBe(mockConnection.jolokiaUrl)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should fail after max retries', async () => {
      fetchMock.mockReject(new Error('Network error'))

      await expect(connectionService['testConnection'](mockConnection, maxRetries, delay)).rejects.toThrow(
        'Failed to test connection',
      )
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })

  describe('connect', () => {
    beforeEach(() => {
      mockedConnectService.loadConnections.mockReturnValue({
        'test-ns-test-pod-test-container': {
          id: 'test-ns-test-pod-test-container',
          name: 'test-ns-test-pod-test-container',
          jolokiaUrl: 'http://localhost:8778/jolokia',
          scheme: 'http',
          host: 'localhost',
          port: 8778,
          path: '/jolokia',
        },
      })
    })

    it('should set current connection on success', async () => {
      fetchMock.mockResponse(JSON.stringify(jolokiaSuccessResponse))

      const error = await connectionService.connect(mockPod)
      expect(error).toBeNull()
      expect(mockedConnectService.setCurrentConnection).toHaveBeenCalled()
    })

    it('should return error when no connection can be derived', async () => {
      const podWithoutJolokia: K8sPod = {
        ...mockPod,
        spec: { containers: [] },
      }

      const error = await connectionService.connect(podWithoutJolokia)
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toContain('No connection could be resolved')
    })

    it('should return error after retries exhausted', async () => {
      fetchMock.mockReject(new Error('Network error'))

      const error = await connectionService.connect(mockPod)
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toContain('multiple attempts')
      expect(mockedEventService.notify).toHaveBeenCalledWith({
        type: 'danger',
        message: expect.stringContaining('Connection failed'),
      })
    })

    it('should handle generic errors gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Unknown error'))

      await connectionService.connect(mockPod)

      expect(mockedEventService.notify).toHaveBeenCalledWith({
        type: 'danger',
        message: 'Connection failed. Please try refreshing the page.',
      })
    })
  })

  describe('deriveConnection', () => {
    it('should create connection for pod with jolokia port', () => {
      const connectionId = connectionService.deriveConnection(mockPod)
      expect(connectionId).toBe('test-ns-test-pod-test-container')
      expect(mockedConnectService.saveConnections).toHaveBeenCalled()
    })

    it('should handle multiple containers with jolokia ports', () => {
      const multiContainerPod: K8sPod = {
        ...mockPod,
        spec: {
          containers: [
            {
              name: 'container-1',
              ports: [{ name: 'jolokia', containerPort: 8778 }],
            },
            {
              name: 'container-2',
              ports: [{ name: 'jolokia', containerPort: 8779 }],
            },
          ],
        },
      }

      const connectionId = connectionService.deriveConnection(multiContainerPod)
      expect(connectionId).toBeTruthy()
      expect(mockedConnectService.saveConnections).toHaveBeenCalled()
    })

    it('should return empty string for pod without jolokia port', () => {
      const podWithoutJolokia: K8sPod = {
        ...mockPod,
        spec: {
          containers: [
            {
              name: 'test-container',
              ports: [{ name: 'http', containerPort: 8080 }],
            },
          ],
        },
      }

      const connectionId = connectionService.deriveConnection(podWithoutJolokia)
      expect(connectionId).toBe('')
    })
  })

  describe('podStatus', () => {
    it('should return Running for running pod', () => {
      const status = connectionService.podStatus(mockPod)
      expect(status).toBe('Running')
    })

    it('should return Terminating for pod being deleted', () => {
      const terminatingPod: K8sPod = {
        ...mockPod,
        metadata: {
          ...mockPod.metadata!,
          deletionTimestamp: '2024-01-01T00:00:00Z',
        },
      }

      const status = connectionService.podStatus(terminatingPod)
      expect(status).toBe('Terminating')
    })

    it('should return empty string for pod without metadata', () => {
      const status = connectionService.podStatus({} as K8sPod)
      expect(status).toBe('')
    })

    it('should handle init container failures', () => {
      const failedInitPod: K8sPod = {
        ...mockPod,
        status: {
          phase: 'Pending',
          initContainerStatuses: [
            {
              name: 'init-container',
              state: {
                terminated: {
                  exitCode: 1,
                  reason: 'Error',
                },
              },
            },
          ],
        },
      }

      const status = connectionService.podStatus(failedInitPod)
      expect(status).toContain('Init')
    })
  })
})
