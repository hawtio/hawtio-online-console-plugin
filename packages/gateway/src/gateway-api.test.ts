/* eslint-disable import/first */

/*
 * Tell testing node environment to allow self-signed certificates
 */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

/*
 * Uncomment this to enable tracing of
 * functions while running tests
 */
process.env.LOG_LEVEL = 'trace'

import request from 'supertest'
import path from 'path'
import { CLUSTER_BASE_ADDRESS, CLUSTER_HOST, CLUSTER_PORT, runningClusterServer, jolokiaUri, testData } from './testing'
import { enableRbac, isOptimisedCachedDomains, setClusterAddr } from './jolokia-agent'
import { cloneObject } from './utils'

process.env['HAWTIO_ONLINE_GATEWAY_APP_PORT'] = '11443'
process.env['HAWTIO_ONLINE_GATEWAY_SSL_KEY'] = path.resolve(
  __dirname,
  '..',
  'test-tls',
  'private',
  'server.unit.test.key',
)
process.env['HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE'] = path.resolve(
  __dirname,
  '..',
  'test-tls',
  'certs',
  'server.unit.test.crt',
)
process.env['HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE_CA'] = path.resolve(
  __dirname,
  '..',
  'test-tls',
  'CA',
  'unit.test-ca.crt',
)
process.env['HAWTIO_ONLINE_GATEWAY_SSL_PROXY_KEY'] = path.resolve(
  __dirname,
  '..',
  'test-tls',
  'private',
  'proxy.unit.test.key',
)
process.env['HAWTIO_ONLINE_GATEWAY_SSL_PROXY_CERTIFICATE'] = path.resolve(
  __dirname,
  '..',
  'test-tls',
  'certs',
  'proxy.unit.test.crt',
)

// Have to have import statement come after the setting of the node property
import { gatewayServer, runningGatewayServer } from './gateway-api'

/*
 * Override the cluster master in the jolokia agent
 */
setClusterAddr(CLUSTER_BASE_ADDRESS)

/***********************************
 *            T E S T S
 ***********************************/

afterAll(done => {
  let total = 0

  runningGatewayServer.addListener('close', function () {
    if (total < 1) ++total
    else done()
  })
  runningGatewayServer.close()

  runningClusterServer.addListener('close', function () {
    if (total < 1) ++total
    else done()
  })
  runningClusterServer.close()
})

beforeEach(() => {
  // Reset TestOptions
  testData.authorization.forbidden = false
  testData.authorization.adminAllowed = true
  testData.authorization.viewerAllowed = true
  enableRbac(true)

  /*
   * Override jolokia URI components so that the final
   * jolokia request is circled back to the cluster test server
   */
  testData.pod.resource.status.podIP = CLUSTER_HOST
  testData.metadata.jolokia.port = CLUSTER_PORT
})

function appPost(uri: string, body: Record<string, unknown> | Record<string, unknown>[]) {
  return request(gatewayServer)
    .post(uri)
    .send(JSON.stringify(body))
    .set('location-rule', 'MANAGEMENT')
    .set('X-Frame-Options', 'SAMEORIGIN')
    .set('Content-Type', 'application/json')
    .set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    .set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'self'; form-action 'self'; ")
}

describe.each([
  { title: 'proxyJolokiaAgentWithoutRbac', rbac: false },
  { title: 'proxyJolokiaAgentWithRbac', rbac: true },
])('$title', ({ title, rbac }) => {
  const testAuth = rbac ? 'RBAC Enabled' : 'RBAC Disabled'

  it(`${testAuth}: Bare path`, async () => {
    enableRbac(rbac)
    const path = '/management/'
    return appPost(path, testData.jolokia.search.request).expect(404)
  })

  it(`${testAuth}: Authorization forbidden`, async () => {
    enableRbac(rbac)
    testData.authorization.forbidden = true
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.search.request).expect(403)
  })

  it(`${testAuth}: Authorization not allowed`, async () => {
    enableRbac(rbac)
    testData.authorization.adminAllowed = false
    testData.authorization.viewerAllowed = false
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.search.request)
      .expect(403)
      .then(res => {
        expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.rejectedResponse))
      })
  })

  it(`${testAuth}: Authorization Post search`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.search.request)
      .expect(200)
      .then(res => {
        expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.search.response))
      })
  })

  it(`${testAuth}: Authorization Post registerList`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.registerList.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = testData.jolokia.registerList.response

        expect(received.request).toStrictEqual(expected.request)

        if (rbac) {
          expect(isOptimisedCachedDomains(received.value)).toBe(true)
          const expDomains = Object.getOwnPropertyNames(expected.value.domains)
          const recDomains = Object.getOwnPropertyNames(received.value.domains)
          expect(expDomains.length).toEqual(recDomains.length)
        } else {
          // No RBAC then there is no interception or optimisation
          expect(expected.value.domains).toEqual(expected.value.domains)
        }
      })
  })

  it(`${testAuth}: Authorization Post canInvokeMap`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.canInvokeMap.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = cloneObject(testData.jolokia.canInvokeMap.response)

        // Neutralise the timestamps as they are always going to be different
        received.timestamp = 0
        expected.timestamp = 0

        expect(received).toEqual(expected)
      })
  })

  it(`${testAuth}: Authorization Post canInvokeSingleAttribute`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.canInvokeSingleAttribute.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = cloneObject(testData.jolokia.canInvokeSingleAttribute.response)

        // Neutralise the timestamps as they are always going to be different
        received.timestamp = 0
        expected.timestamp = 0

        expect(received).toEqual(expected)
      })
  })

  it(`${testAuth}: Authorization Post canInvokeSingleOperation`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.canInvokeSingleOperation.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = cloneObject(testData.jolokia.canInvokeSingleOperation.response)

        // Neutralise the timestamps as they are always going to be different
        received.timestamp = 0
        expected.timestamp = 0

        expect(received).toEqual(expected)
      })
  })

  it(`${testAuth}: Authorization Post bulkRequestWithInterception`, async () => {
    enableRbac(rbac)
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.bulkRequestWithInterception.request)
      .expect(200)
      .then(res => {
        const received = JSON.parse(res.text)
        const expected = cloneObject(testData.jolokia.bulkRequestWithInterception.response)

        // Neutralise the timestamps as they are always going to be different
        received.forEach((r: Record<string, unknown>) => (r.timestamp = 0))
        expected.forEach((r: Record<string, unknown>) => (r.timestamp = 0))

        expect(received).toEqual(expected)
      })
  })

  it(`${testAuth}: Authorization Post operationWithArgumentsAndViewerRoleOnly`, async () => {
    // RBAC enabled depending on test suite
    enableRbac(rbac)

    // Only viewer role allowed
    testData.authorization.adminAllowed = false
    testData.authorization.viewerAllowed = true

    //
    // WithRBAC: the 'viewer' role is not allowed for this operation
    // WithoutRBAC: the 'viewer' role is not high enough for ANY request
    //
    const expectedStatus = 403

    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.operationWithArgumentsAndViewerRole.request)
      .expect(expectedStatus)
      .then(res => {
        if (rbac)
          expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.operationWithArgumentsAndViewerRole.response))
        else expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.rejectedResponse))
      })
  })

  it(`${testAuth}: Authorization Post bulkRequestWithViewerRole`, async () => {
    enableRbac(rbac)

    // Only viewer role allowed
    testData.authorization.adminAllowed = false
    testData.authorization.viewerAllowed = true

    //
    // WithoutRBAC: the 'viewer' role is not high enough for ANY request
    //
    const expectedStatus = rbac ? 200 : 403

    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.bulkRequestWithViewerRole.request)
      .expect(expectedStatus)
      .then(res => {
        if (rbac) expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.bulkRequestWithViewerRole.response))
        else expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.rejectedResponse))
      })
  })

  it(`${testAuth}: Authorization Post requestOperationWithArgumentsAndNoRole`, async () => {
    // RBAC enabled depending on test suite
    enableRbac(rbac)

    // No role allowed
    testData.authorization.adminAllowed = false
    testData.authorization.viewerAllowed = false

    const expectedStatus = 403

    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.requestOperationWithArgumentsAndNoRole.request)
      .expect(expectedStatus)
      .then(res => {
        expect(res.text).toStrictEqual(JSON.stringify(testData.authorization.rejectedResponse))
      })
  })
})
