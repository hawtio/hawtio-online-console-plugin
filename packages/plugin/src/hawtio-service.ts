import { fetchPatchService } from './fetch-patch-service'
import {
  camel,
  configManager,
  consoleStatus,
  hawtio,
  HawtioPlugin,
  jmx,
  jolokiaService,
  logs,
  quartz,
  ResolveUser,
  runtime,
  springboot,
  UserAuthResult,
  userService,
  workspace,
} from '@hawtio/react'
import { HAWTIO_ONLINE_VERSION } from './constants'
import { log } from './globals'
import { K8sPod } from './types'
import { connectionService } from './connection-service'
import { pluginHeaderDropdown, pluginHeaderDropdownId } from './plugins'
import { Logger } from '@hawtio/react'

const USER = 'auth-disabled'
const AUTH_METHOD = 'NoAuth'

class HawtioService {
  private initialized?: boolean = false
  private resolved: boolean = false
  private error?: Error

  constructor() {
    /*
     * Disable the authentication requirements by specifying
     * a user that is already logged-in
     */
    userService.addFetchUserHook(USER, this.fetchUser)
  }

  private async fetchUser(resolve: ResolveUser): Promise<UserAuthResult> {
    resolve({ username: USER, isLogin: true, loginMethod: AUTH_METHOD })
    return { isIgnore: false, isError: false, loginMethod: AUTH_METHOD }
  }

  private async establishConnection(pod: K8sPod): Promise<boolean> {
    log.debug(`Probing pod ${pod.metadata?.name} ...`)

    if (!connectionService.hasJolokiaPort(pod)) {
      this.setError(new Error(`This pod does not contain a jolokia port`))
      return false
    }

    try {
      const url = await connectionService.probeJolokiaUrl(pod)
      if (!url) {
        connectionService.clear()
        this.setError(new Error('Failed to reach a recognised jolokia url for this pod'))
        return false
      }
    } catch (error) {
      connectionService.clear()
      this.setError(new Error(`Cannot access the jolokia url for this pod`, { cause: error }))
      return false
    }

    log.debug(`Connecting to pod ${pod.metadata?.name} ...`)

    /*
     * Set the current connection before initializing
     */
    const error = await connectionService.connect(pod)
    if (error) {
      connectionService.clear()
      this.setError(error)
      return false
    }

    return true
  }

  private async initPlugin(pluginIds: string[], id: string, bootstrapCb: HawtioPlugin) {
    const idx = pluginIds.findIndex(pluginId => pluginId === id)
    if (idx > -1) {
      log.debug(`(hawtio-service) Plugin already initialised so refreshing if necessary: ${id}`)
      return
    }

    log.debug(`(hawtio-service) Bootstrapping plugin: ${id}`)
    bootstrapCb()
  }

  async reset(pod: K8sPod | null) {
    // reset the error
    this.error = undefined

    if (!this.isInitialized()) {
      /*
       * Initializing not previously attempted
       */
      await userService.fetchUser()
      configManager.addProductInfo('Hawtio Online (Plugin)', HAWTIO_ONLINE_VERSION)
      hawtio.setBasePath(fetchPatchService.getBasePath())
    }

    hawtioService.setInitialized(true)
    log.debug('(hawtio-service) Hawtio is initialized ...')

    if (!pod) {
      connectionService.clear()
    } else {
      const result = await this.establishConnection(pod)
      if (!result) {
        log.debug('Failed to establish the connection')
        return
      }
    }

    /*
     * Connection established so reset the
     * hawtio/react plugins and services
     */

    const pluginIds = hawtio.getPlugins().map(plugin => plugin.id)
    log.debug('(hawtio-service) Current plugin ids according to hawtio: ', pluginIds)

    // Register or refresh Hawtio plugins
    await this.initPlugin(pluginIds, 'consolestatus', consoleStatus)
    await this.initPlugin(pluginIds, 'jmx', jmx)
    await this.initPlugin(pluginIds, 'camel', camel)
    await this.initPlugin(pluginIds, 'runtime', runtime)
    await this.initPlugin(pluginIds, 'logs', logs)
    await this.initPlugin(pluginIds, 'quartz', quartz)
    await this.initPlugin(pluginIds, 'springboot', springboot)
    await this.initPlugin(pluginIds, pluginHeaderDropdownId, pluginHeaderDropdown)

    // Reset the jolokia service
    log.debug('(hawtio-service) Resetting jolokia Service ...')
    jolokiaService.reset()

    // Have a connection so reset the workspace
    log.debug('(hawtio-service) Refreshing workspace tree ...')
    await workspace.refreshTree()
    const tree = await workspace.getTree()
    log.debug(`Contents of tree ${tree.getTree().length}`)

    // Bootstrap Hawtio
    log.debug(`(hawtio-service) Bootstrapping hawtio (${pluginIds.length === 0 ? 'true' : 'false'}) ...`)
    if (pluginIds.length === 0) {
      await hawtio.bootstrap()
    }

    log.debug('(hawtio-service) Resolving the hawtio service')
    await this.resolve()
  }

  getError() {
    return this.error
  }

  private setError(error: Error) {
    this.error = error
  }

  isInitialized() {
    return this.initialized
  }

  private setInitialized(initialized: boolean) {
    this.initialized = initialized
  }

  private async resolve() {
    log.debug('(hawtio-service) Hawtio resolving plugins ...')
    const plugins = await hawtio.resolvePlugins()
    if (plugins.length === 0) {
      this.error = new Error('All plugins failed to resolve')
      this.resolved = false
      return
    }

    /*
     * Plugins have been resolved
     */
    this.resolved = true
  }

  isResolved() {
    return this.resolved
  }

  destroy() {
    jolokiaService.reset()

    connectionService.clear()
  }
}

export const hawtioService = new HawtioService()
