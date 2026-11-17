import { spawn, ChildProcess } from 'child_process'
import { LRUCache } from 'lru-cache'
import * as net from 'net'
import { AgentInfo } from './globals'
import { logger } from '../logger'

interface PodTunnel {
  localPort: number
  process: ChildProcess
}

const podTunnelCache = new LRUCache<string, Promise<PodTunnel>>({
  max: 50,
  ttl: 1000 * 60 * 5, // 5 minutes
  dispose: async tunnelPromise => {
    const tunnel = await tunnelPromise.catch(() => undefined)
    tunnel?.process.kill()
  },
})

function allocateFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo
      server.close(() => resolve(address.port))
    })
    server.on('error', reject)
  })
}

export async function ensureDevPodTunnel(agentInfo: AgentInfo): Promise<number> {
  const cacheKey = `${agentInfo.namespace}/${agentInfo.pod}:${agentInfo.port}`
  if (podTunnelCache.has(cacheKey)) {
    const existing = await podTunnelCache.get(cacheKey)!
    return existing.localPort
  }

  const tunnelPromise = (async (): Promise<PodTunnel> => {
    const localPort = await allocateFreePort()
    const child = spawn('oc', [
      'port-forward',
      `pod/${agentInfo.pod}`,
      `${localPort}:${agentInfo.port}`,
      '-n',
      agentInfo.namespace,
      '--address',
      '127.0.0.1',
    ])

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for oc port-forward')), 10000)

      child.stdout.on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('Forwarding from')) {
          clearTimeout(timer)
          resolve()
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        logger.trace(`(jolokia-agent) port-forward stderr: ${chunk.toString().trim()}`)
      })

      child.once('exit', code => {
        clearTimeout(timer)
        reject(new Error(`oc port-forward exited prematurely with code ${code}`))
      })
    })

    return { localPort, process: child }
  })()

  tunnelPromise.catch(() => podTunnelCache.delete(cacheKey))
  podTunnelCache.set(cacheKey, tunnelPromise)

  const tunnel = await tunnelPromise
  return tunnel.localPort
}
