// Setup file for Jest tests
/* eslint-disable @typescript-eslint/no-require-imports */
require('jest-fetch-mock').enableMocks()

// Mock webpack DefinePlugin constants
global.HAWTIO_ONLINE_PACKAGE_PLUGIN_NAME = '@hawtio/online-console-plugin'
global.HAWTIO_ONLINE_PACKAGE_VERSION = '0.9.0'
global.HAWTIO_ONLINE_PUBLIC_PATH = '/api/hawtio-online-console-plugin/'

// Mock window.location
delete window.location
window.location = {
  origin: 'http://localhost:9000',
  href: 'http://localhost:9000',
  protocol: 'http:',
  host: 'localhost:9000',
  hostname: 'localhost',
  port: '9000',
  pathname: '/',
  search: '',
  hash: '',
}

// Polyfill AbortSignal.timeout for older Node versions
if (!AbortSignal.timeout) {
  AbortSignal.timeout = function (ms) {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new Error('TimeoutError')), ms)
    return controller.signal
  }
}
