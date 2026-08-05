// Only import leaf files that do not re-import other code
// - danger is an import of something that uses 'fetch' while
// webpack is trying to replace it, eg. @hawtio/react
import { getCSRFToken } from './utils/https'
import { PLUGIN_BASE_PATH } from './constants'

// Polyfill AbortSignal.timeout for browsers that don't support it
// (Chrome <103, Firefox <100, Safari <16.4)
if (typeof AbortSignal !== 'undefined' && !AbortSignal.timeout) {
  AbortSignal.timeout = function (ms: number): AbortSignal {
    const controller = new AbortController()
    setTimeout(() => {
      controller.abort(new DOMException('TimeoutError', 'TimeoutError'))
    }, ms)
    return controller.signal
  }
}

type HawtioFetchPath = {
  path?: string
  regex: RegExp
}

type HawtioFetchPaths = Record<string, HawtioFetchPath>

// Regex definitions
const hawtioFetchPaths: HawtioFetchPaths = {
  presetConnections: { path: 'preset-connections', regex: /(?:\/)*preset-connections$/ },
  hawtconfig: { path: 'hawtconfig.json', regex: /(?:\/)*hawtconfig\.json$/ },
  sessionTimeout: { path: 'auth/config/session-timeout$1', regex: /(?:\/)*auth\/config\/session-timeout(.*)/ },
  management: { regex: /(.*\/gateway\/management\/.*)/ },
}

export const basePath = PLUGIN_BASE_PATH

// Default timeout for Hawtio requests (30 seconds)
const DEFAULT_FETCH_TIMEOUT_MS = 30000

async function waitForCsrfToken(retries = 10, delay = 200): Promise<string | undefined> {
  for (let i = 0; i < retries; i++) {
    const token = getCSRFToken()
    if (token) return token
    await new Promise(r => setTimeout(r, delay))
  }
  return undefined
}

/**
 * Creates an AbortSignal with a timeout, merging with any existing signal from init
 */
function createTimeoutSignal(init?: RequestInit, timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS): AbortSignal {
  // If init already has a signal, we need to merge it with our timeout
  if (init?.signal) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs)

    // If the original signal aborts, abort our controller too
    init.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId)
      controller.abort(init.signal!.reason)
    })

    // Clean up timeout if request completes
    controller.signal.addEventListener('abort', () => clearTimeout(timeoutId))

    return controller.signal
  }

  // No existing signal, just create a simple timeout signal
  return AbortSignal.timeout(timeoutMs)
}

export const scopedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  // Normalize the URL to a string, handling Request objects
  let hawtioUrl: string

  if (typeof input === 'string') {
    hawtioUrl = input
  } else if ('url' in input) {
    // It's a Request object
    hawtioUrl = input.url
  } else {
    // It's an URL object
    hawtioUrl = input.toString()
  }

  /*
   * Restrict the scoped fetch to
   * hawtio management gateway urls
   */
  let isHawtioRequest = false
  for (const fetchPath of Object.values(hawtioFetchPaths)) {
    if (!hawtioUrl.match(fetchPath.regex)) continue

    isHawtioRequest = true

    if (fetchPath.path) {
      hawtioUrl = hawtioUrl.replace(fetchPath.regex, `${basePath}/${fetchPath.path}`)
    }
    break
  }

  /*
   * If it's not an hawtio url, pass it to the REAL window.fetch
   * CRITICAL: pass 'input' (the original) not 'hawtioUrl' to
   * preserve Request object properties if any
   */
  if (!isHawtioRequest) {
    return window.fetch(input, init)
  }

  // It IS an hawtio request. Handle the CSRF Token (Wait if needed)
  let token = getCSRFToken()
  if (!token) {
    // eslint-disable-next-line no-console
    console.debug('(scoped-fetch) Token missing, waiting...')
    token = await waitForCsrfToken()
  }

  /*
   * Construct Headers
   * We must merge headers carefully.
   */
  const headers = new Headers(init?.headers || {})

  /*
   * If input was a Request object, it might have headers too.
   * But usually, the init object takes precedence or we are just
   * setting auth headers.
   * For safety, we just ensure our required headers are present.
   */
  headers.set('Content-Type', 'application/json')
  if (token) {
    headers.set('X-CSRFToken', token)
  }

  /*
   * Add timeout support to all Hawtio requests
   */
  const timeoutSignal = createTimeoutSignal(init)
  const fetchOptions = { ...init, headers, signal: timeoutSignal }

  /*
   * Handle Request objects to preserve Body/Method
   */
  if (input instanceof Request) {
    // Explicitly carry over the method
    if (!fetchOptions.method) {
      fetchOptions.method = input.method
    }

    /*
     * Explicitly carry over the body if it wasn't provided in 'init'
     * Note: can't easily read 'input.body' if it's a stream,
     * but can pass the Request object itself if hadn't changed the URL.
     * Since CHANGED the URL, must create a new Request.
     */
    return window.fetch(
      new Request(hawtioUrl, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: init?.body, // If init has a body, use it
        credentials: input.credentials,
        cache: input.cache,
        mode: input.mode,
        redirect: input.redirect,
        referrer: input.referrer,
        referrerPolicy: input.referrerPolicy,
        integrity: input.integrity,
        keepalive: input.keepalive,
        signal: timeoutSignal,
      }),
    )
  }

  /*
   * Call the real window.fetch with new URL string and Headers
   * Use 'hawtioUrl' here because path might been have rewritten
   */
  return window.fetch(hawtioUrl, fetchOptions)
}
