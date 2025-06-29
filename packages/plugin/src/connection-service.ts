import jsonpath from 'jsonpath'
import {
  JolokiaErrorResponse,
  JolokiaSuccessResponse,
  VersionResponseValue as JolokiaVersionResponseValue,
} from 'jolokia.js'
import { K8sPod } from './types'
import { ContainerPort, Container } from 'kubernetes-types/core/v1'
import { Connection, Connections, SESSION_KEY_CURRENT_CONNECTION, connectService, eventService } from '@hawtio/react'
import { HTTPError, isBlank, isJolokiaVersionResponseType, joinPaths, jolokiaResponseParse, ParseResult } from './utils'
import { log } from './globals'
import { PROXY_GATEWAY_BASE_PATH } from './constants'

const DEFAULT_JOLOKIA_PORT = 8778
const JOLOKIA_PORT_QUERY = '$.spec.containers[*].ports[?(@.name=="jolokia")]'

class ConnectionService {

  podStatus(pod: K8sPod): string {
    // Return results that match
    // https://github.com/openshift/origin/blob/master/vendor/k8s.io/kubernetes/pkg/printers/internalversion/printers.go#L523-L615

    if (!pod || (!pod.metadata?.deletionTimestamp && !pod.status)) {
      return ''
    }

    if (pod.metadata?.deletionTimestamp) {
      return 'Terminating'
    }

    let initializing = false
    let reason

    // Print detailed container reasons if available. Only the first will be
    // displayed if multiple containers have this detail.

    const initContainerSpecStatuses = pod.status?.initContainerStatuses || []
    for (const initContainerSpecStatus of initContainerSpecStatuses) {
      const initContainerSpecState = initContainerSpecStatus['state']
      if (!initContainerSpecState) continue

      if (initContainerSpecState.terminated && initContainerSpecState.terminated.exitCode === 0) {
        // initialization is complete
        break
      }

      if (initContainerSpecState.terminated) {
        // initialization is failed
        if (!initContainerSpecState.terminated.reason) {
          if (initContainerSpecState.terminated.signal) {
            reason = 'Init Signal: ' + initContainerSpecState.terminated.signal
          } else {
            reason = 'Init Exit Code: ' + initContainerSpecState.terminated.exitCode
          }
        } else {
          reason = 'Init ' + initContainerSpecState.terminated.reason
        }
        initializing = true
        break
      }

      if (
        initContainerSpecState.waiting &&
        initContainerSpecState.waiting.reason &&
        initContainerSpecState.waiting.reason !== 'PodInitializing'
      ) {
        reason = 'Init ' + initContainerSpecState.waiting.reason
        initializing = true
      }
    }

    if (!initializing) {
      reason = pod.status?.reason || pod.status?.phase || ''

      const containerStatuses = pod.status?.containerStatuses || []
      for (const containerStatus of containerStatuses) {
        const containerReason = containerStatus.state?.waiting?.reason || containerStatus.state?.terminated?.reason

        if (containerReason) {
          reason = containerReason
          break
        }

        const signal = containerStatus.state?.terminated?.signal
        if (signal) {
          reason = `Signal: ${signal}`
          break
        }

        const exitCode = containerStatus.state?.terminated?.exitCode
        if (exitCode) {
          reason = `Exit Code: ${exitCode}`
          break
        }
      }
    }

    return reason || 'unknown'
  }

  private jolokiaContainerPort(container: Container): number|null {
    const ports: Array<ContainerPort> = container.ports || []
    log.debug(`jolokiaContainerPorts identified: ${ports}`)
    const containerPort = ports.find(port => port.name === 'jolokia')
    log.debug(`jolokaiContainerPorts determined the container Port to be ${containerPort}`)
    return containerPort?.containerPort ?? null
  }

  /*
   * Should only return those containers with a jolokia port
   */
  private jolokiaContainers(pod: K8sPod): Array<Container> {
    if (!pod) return []

    if (! this.hasJolokiaPort(pod)) return []

    const containers: Array<Container> = pod.spec?.containers || []
    return containers.filter(container => {
      return this.jolokiaContainerPort(container) !== null
    })
  }

  private jolokiaPort(pod: K8sPod): number {
    const ports = jsonpath.query(pod, JOLOKIA_PORT_QUERY)
    log.debug(`jolokiaPort found ${ports} in pod`)
    if (!ports || ports.length === 0) {
      log.warn(`jolokiaPort could not query a port so using the default ${DEFAULT_JOLOKIA_PORT}. This might mean the pod cannot be accessed.`)
      return DEFAULT_JOLOKIA_PORT
    }

    log.debug(`jolokiaPort determined the pod Port to be ${ports[0].containerPort}`)
    return ports[0].containerPort ?? DEFAULT_JOLOKIA_PORT
  }

  private getAnnotation(pod: K8sPod, name: string, defaultValue: string): string {
    if (pod.metadata?.annotations && pod.metadata?.annotations[name]) {
      return pod.metadata.annotations[name]
    }
    return defaultValue
  }

  private jolokiaPath(pod: K8sPod, port: number): string | null {
    if (!pod.metadata) {
      log.error('Cannot get jolokia path for pod as it does not contain any metadata properties')
      return null
    }

    const namespace = pod.metadata?.namespace ?? 'default'
    const name = pod.metadata?.name
    if (!namespace || !name) {
      log.error('Cannot get name or namespace for pod')
      return null
    }

    const protocol = this.getAnnotation(pod, 'hawt.io/protocol', 'https')
    const jPath = this.getAnnotation(pod, 'hawt.io/jolokiaPath', '/jolokia/')

    const path = joinPaths(
      PROXY_GATEWAY_BASE_PATH,
      'management',
      'namespaces',
      namespace,
      'pods',
      `${protocol}:${name}:${port}`,
      jPath,
    )
    return joinPaths(window.location.origin, path)
  }

  private connectionKeyName(pod: K8sPod, container: Container) {
    return `${pod.metadata?.namespace}-${pod.metadata?.name}-${container.name}`
  }

  deriveConnection(pod: K8sPod): string {
    const containers: Array<Container> = this.jolokiaContainers(pod)
    const connections: Connections = connectService.loadConnections()

    let connName = ''
    const connNames: string[] = []
    for (const container of containers) {
      const jolokiaPort = this.jolokiaContainerPort(container)
      if (!jolokiaPort) {
        // Should not happen since these are jolokia containers
        log.error(`Could no longer find a jolokia port in container ${container.name} from pod ${pod.metadata?.name}`)
        continue
      }

      const jolokiaPath = this.jolokiaPath(pod, jolokiaPort) ?? ''
      const url: URL = new URL(jolokiaPath)
      const protocol = url.protocol.replace(':', '') as 'http' | 'https'
      const connection: Connection = {
        id: this.connectionKeyName(pod, container),
        name: this.connectionKeyName(pod, container),
        jolokiaUrl: url.toString(),

        // Not necessary but included to satisfy rules of Connection object
        scheme: protocol,
        host: url.hostname,
        port: Number(url.port),
        path: url.pathname,
      }

      connName = this.connectionKeyName(pod, container)
      connections[connName] = connection
      connNames.push(connName)
    }

    connectService.saveConnections(connections)

    // returns the name of the given pod's connection
    return connName
  }

  private async handleResponse(
    response: Response,
    path: string,
    resolve: (value: string) => void,
    reject: (reason?: unknown) => void,
  ) {
    if (!response.ok) {
      log.debug('Using URL:', path, 'assuming it could be an agent but got return code:', response.status)

      // Start with the most generic, but always available, error message as a fallback.
      let message = response.statusText

      try {
        // Attempt to read the body as text.
        // In rare cases, this I/O operation might fail.
        const errorText = await response.text()

        // Parsing as text succeeded but would be helpful to see if it is json.
        // The default message is now the full text body.
        message = errorText

        try {
          // Attempt to parse the text string as JSON.
          const errorJson = JSON.parse(errorText)

          // Parsing has succeeded AND it has a JSON structure,
          if (errorJson && errorJson.error) {
            message = errorJson.error
          }

        } catch (jsonError) {
          // Wasn't valid JSON.
          // Message is already the full 'errorText', so no action is needed here.
          log.debug('Response body was not valid JSON. Using raw text for error message.')
        }

      } catch (textError) {
        // Catches if `response.text()` itself fails.
        // This would be due to a TypeError (e.g., body already read).
        log.error('Failed to read response body as text:', textError);
        // No action is needed because `message` variable still holds the
        // initial fallback value of `response.statusText`.
      }

      /*
       * Finally, create and reject the error with the best message
       * The '|| response.statusText' is a final safety net in
       * case message is empty
       */
      const err = new HTTPError(response.status, message || response.statusText)
      reject(err)
      return
    }

    try {
      const result: ParseResult<JolokiaSuccessResponse | JolokiaErrorResponse> = await jolokiaResponseParse(response)
      if (result.hasError) {
        const err = new HTTPError(500, result.error)
        log.error(err)
        reject(err)
        return
      }

      const jsonResponse: JolokiaSuccessResponse = result.parsed as JolokiaSuccessResponse
      if (!isJolokiaVersionResponseType(jsonResponse.value)) {
        const err = new HTTPError(500, 'Detected jolokia but cannot determine agent or version')
        log.error(err)
        reject(err)
        return
      }

      const versionResponse = jsonResponse.value as JolokiaVersionResponseValue
      log.debug('Found jolokia agent at:', path, 'details:', versionResponse.agent)
      resolve(path)
    } catch (e) {
      // Parse error should mean redirect to html
      const msg = `Jolokia Connect Error - ${e ?? response.statusText}`
      const err = new HTTPError(response.status, msg)
      reject(err)
    }
  }

  /*
   * Returns true if the pod metadata contains a 'jolokia' port
   * False otherwise
   */
  hasJolokiaPort(pod: K8sPod): boolean {
    const ports = jsonpath.query(pod, JOLOKIA_PORT_QUERY)
    return ports.length > 0
  }

  /*
   * Probe the pod's jolokia capability with a GET request
   *
   * Connection will probably return a 200 but respond with the homepage
   * rather than any json so let checks that too
   */
  async probeJolokiaUrl(pod: K8sPod): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const port = this.jolokiaPort(pod)
      const path = `${this.jolokiaPath(pod, port)}version`
      fetch(path)
        .then(async (response: Response) => {
          return this.handleResponse(response, path, resolve, reject)
        })
        .catch(error => {
          const err = new HTTPError(error.status, error.error)
          reject(err)
        })
    })
  }

  /*
   * Test the connection with a POST request rather
   * than #probeJolokiaUrl which uses a GET request
   *
   * This does not specify a token, unlike the @hawtio/react
   * connect-service. Instead it leaves that up to the interceptor
   * in fetch-patch-service.
   */
  private async testConnection(connection: Connection): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const path = connectService.getJolokiaUrl(connection)
      fetch(path, {
        method: 'post',
        body: JSON.stringify({ type: 'version' }),
      })
        .then(async (response: Response) => {
          return this.handleResponse(response, path, resolve, reject)
        })
        .catch(error => {
          const err = new HTTPError(error.status, error.error)
          reject(err)
        })
    })
  }

  async connect(pod: K8sPod): Promise<Error | null> {
    // Make the pod the current connection
    const connectionId: string = connectionService.deriveConnection(pod)

    if (isBlank(connectionId)) {
      return new Error('No connection could be resolved for this pod')
    }

    const connections: Connections = connectService.loadConnections()

    const connection: Connection = connections[connectionId]
    if (!connection) {
      return new Error(`There is no connection configured with name ${connectionId}`)
    }

    try {
      const result = await this.testConnection(connection)
      if (!result) {
        const msg = `There was a problem connecting to the jolokia service ${connectionId}`
        log.error(msg)
        return new Error(msg)
      }

      log.debug(`Recording current connection as ${connectionId}`)

      connectService.setCurrentConnection(connection)
      return null
    } catch (error) {
      const msg = `A problem occurred while trying to connect to the jolokia service ${connectionId}`
      log.error(msg)
      log.error(error)
      eventService.notify({ type: 'danger', message: msg })
      return new Error(msg, { cause: error as Error })
    }
  }

  clear() {
    sessionStorage.removeItem(SESSION_KEY_CURRENT_CONNECTION)
  }
}

export const connectionService = new ConnectionService()
