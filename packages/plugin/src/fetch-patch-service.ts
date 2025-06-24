import * as fetchIntercept from 'fetch-intercept'
import { PLUGIN_BASE_PATH } from './constants'
import { getCSRFToken } from './utils/https'

type HawtioFetchPath = {
  path?: string,
  regex: RegExp,
}

type HawtioFetchPaths = Record<string, HawtioFetchPath>

const hawtioFetchPaths: HawtioFetchPaths = {
  presetConnections: { path: 'preset-connections', regex: /\/\/preset-connections$/ },
  hawtconfig: { path: 'hawtconfig.json', regex: /hawtconfig\.json$/ },
  sessionTimeout: { path: 'auth/config/session-timeout$1', regex: /auth\/config\/session-timeout(.*)/ },
  management: { regex: /(.*\/gateway\/management\/.*)/ } // don't want to replace just track
}

interface Headers {
  Authorization?: string
  'Content-Type': string
  'X-XSRF-TOKEN'?: string
  'X-CSRFToken'?: string
}

class FetchPatchService {
  private fetchUnregister?: (() => void) | null

  private basePath = PLUGIN_BASE_PATH

  private csrfToken?: string

  constructor() {
    this.setupFetch()
  }

  setupFetch() {
    if (this.fetchUnregister) return // Nothing to do

    this.fetchUnregister = fetchIntercept.register({
      request: (url, requestConfig) => {
        /*
         * Restrict the interceptor to only intercepting
         * hawtio management gateway urls
         */
        let hawtioUrl = ''
        for (const fetchPath of Object.values(hawtioFetchPaths)) {
          if (! url.match(fetchPath.regex))
            continue

          if (! fetchPath.path) {
            hawtioUrl = url
          } else {
            hawtioUrl = url.replace(fetchPath.regex, `${this.basePath}/${fetchPath.path}`)
          }

          break
        }

        if (hawtioUrl.length === 0) {
          // Not a hawtio url so return without modification
          return [url, requestConfig]
        }

        let headers: Headers = {
          'Content-Type': 'application/json'
        }

        // Required token for protected authenticated access
        // to cluster from the console
        this.csrfToken = getCSRFToken()

        if (this.csrfToken) {
          headers = {
            ...headers,
            'X-CSRFToken': this.csrfToken,
          }
        }

        /*
         * if requestConfig exists and already has a set of headers
         */
        if (requestConfig && requestConfig.headers) {
          headers = { ...requestConfig.headers, ...headers }
        }

        // headers must be 2nd so that it overwrites headers property in requestConfig
        return [hawtioUrl, { ...requestConfig, headers }]
      },
    })
  }

  destroy() {
    // Unregister this fetch handler before logging out
    this.fetchUnregister?.()
    this.fetchUnregister = null
  }

  getBasePath() {
    return this.basePath
  }
}

export const fetchPatchService = new FetchPatchService()
