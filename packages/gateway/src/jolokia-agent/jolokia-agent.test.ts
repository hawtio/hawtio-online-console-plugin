/* eslint-disable import/first */

import request from 'supertest'
import express from 'express'
import * as fs from 'fs'
import * as https from 'https'
import path from 'path'

/*
 * Tell testing node environment to allow self-signed certificates
 */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

/*
 * Uncomment this to enable tracing of
 * functions while running tests
 */
process.env.LOG_LEVEL = 'trace'

import { expressLogger } from '../logger'
import {
  CLUSTER_BASE_ADDRESS,
  CLUSTER_HOST,
  CLUSTER_PORT,
  runningClusterServer,
  jolokiaUri,
  testData,
  jolokiaUri2,
} from '../testing'
import { processRBACEnvVar, proxyJolokiaAgent, podIpCache, rbacCache, clearCaches } from './jolokia-agent'
import { isOptimisedCachedDomains, setClusterAddr, SSLOptions } from './globals'
import { cloneObject } from '../utils'

/*
 * Override the cluster master in the jolokia agent
 */
setClusterAddr(CLUSTER_BASE_ADDRESS)

/******************************************
 * T E S T   A P P   S E R V E R
 ******************************************/

/*
 * App server for carrying the jolokia agent for testing purposes
 * Allows for correct creation of requests / responses
 */
const appServer = express()
appServer.use(expressLogger)
appServer.use(express.json())
appServer.use(express.urlencoded())

/*
 * Single route as provided by the gateway server
 */
appServer
  .route('/management/*')
  .get((req, res) => {
    proxyJolokiaAgent(req, res, proxySSLOptions)
  })
  .post((req, res) => {
    proxyJolokiaAgent(req, res, proxySSLOptions)
  })

/*
 * Provide SSL Options as gateway is SSL only
 */
const proxySSLOptions: SSLOptions = {
  certCA: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'CA', 'unit.test-ca.crt')),
  proxyKey: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'private', 'proxy.unit.test.key')),
  proxyCert: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'certs', 'proxy.unit.test.crt')),
}

/*
 * Create the server but it will be fired up in the tests using supertest
 */
const appHttpsServer = https.createServer(
  {
    ca: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'CA', 'unit.test-ca.crt')),
    key: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'private', 'server.unit.test.key')),
    cert: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'certs', 'server.unit.test.crt')),
    requestCert: true,
    rejectUnauthorized: false,
  },
  appServer,
)

/***********************************
 *            T E S T S
 ***********************************/
// Defined by jest env vars in .jestEnvVars.js
const defaultACLFile = `${process.env.HAWTIO_ONLINE_RBAC_ACL}`

describe('processRBACEnvVar', () => {
  it('RBAC Enabled - Default File', () => {
    expect(() => {
      const rbacEnabled = processRBACEnvVar(defaultACLFile)
      expect(rbacEnabled).toBe(true)
    }).not.toThrow()
  })

  it('RBAC Disabled', () => {
    expect(() => {
      const rbacEnabled = processRBACEnvVar(defaultACLFile, 'disabled')
      expect(rbacEnabled).toBe(false)
    }).not.toThrow()
  })

  it('RBAC Enabled - Custom File Not Found', () => {
    expect(() => {
      processRBACEnvVar(defaultACLFile, 'notFoundFilePath')
    }).toThrow('Failed to read the ACL file at notFoundFilePath')
  })

  it('RBAC Enabled - Custom File Invalid', () => {
    const invalidYamlACLPath = `${path.dirname(__filename)}/test.invalid.ACL.yaml`
    expect(() => {
      processRBACEnvVar(defaultACLFile, invalidYamlACLPath)
    }).toThrow(`Failed to parse the ACL file at ${invalidYamlACLPath}`)
  })

  it('RBAC Enabled - Custom File Valid', () => {
    const validYamlACLPath = `${path.dirname(__filename)}/test.ACL.yaml`

    expect(() => {
      const rbacEnabled = processRBACEnvVar(defaultACLFile, validYamlACLPath)
      expect(rbacEnabled).toBe(true)
    }).not.toThrow()
  })
})

afterAll(() => {
  runningClusterServer.close()
})

function appPost(uri: string, body: Record<string, unknown> | Record<string, unknown>[]) {
  return request(appHttpsServer)
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

  beforeEach(() => {
    // Reset TestOptions
    testData.authorization.forbidden = false
    testData.authorization.adminAllowed = true
    testData.authorization.viewerAllowed = true
    if (rbac) processRBACEnvVar(defaultACLFile)
    else processRBACEnvVar(defaultACLFile, 'disabled')

    /*
     * Override jolokia URI components so that the final
     * jolokia request is circled back to the cluster test server
     */
    testData.pod.resource.status.podIP = CLUSTER_HOST
    testData.metadata.jolokia.port = CLUSTER_PORT

    // Clear the caches
    clearCaches()
  })

  it(`${testAuth}: Bare path`, async () => {
    const path = '/management/'
    return appPost(path, testData.jolokia.search.request).expect(404)
  })

  it(`${testAuth}: Authorization forbidden`, async () => {
    testData.authorization.forbidden = true
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.search.request).expect(403)
  })

  it(`${testAuth}: Authorization not allowed`, async () => {
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
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.search.request)
      .expect(200)
      .then(res => {
        expect(res.text).toStrictEqual(JSON.stringify(testData.jolokia.search.response))
      })
  })

  it(`${testAuth}: Authorization Post registerList`, async () => {
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

describe('masking ip addresses', () => {
  beforeEach(() => {
    // Reset TestOptions
    testData.authorization.forbidden = false
    testData.authorization.adminAllowed = true
    testData.authorization.viewerAllowed = true
    processRBACEnvVar(defaultACLFile)

    /*
     * Override jolokia URI components so that the final
     * jolokia request is circled back to the cluster test server
     */
    testData.pod.resource.status.podIP = CLUSTER_HOST
    testData.metadata.jolokia.port = CLUSTER_PORT

    clearCaches()
  })

  afterEach(() => {
    process.env.HAWTIO_ONLINE_MASK_IP_ADDRESSES = 'false'
  })

  it('IP address masking off by default', async () => {
    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.listMBeans.request)
      .expect(200)
      .then(res => {
        expect(res.text).toContain('jolokia')
        const response = JSON.parse(res.text)
        expect(response.value.jolokia).toBeTruthy()
        for (const k in response.value.jolokia) {
          expect(k).toContain('10.217.0.214')
          expect(k).not.toContain('***.***.***.***')
        }
      })
  })

  it('IP address masked when masking enabled', async () => {
    process.env.HAWTIO_ONLINE_MASK_IP_ADDRESSES = 'true'

    const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
    return appPost(path, testData.jolokia.listMBeans.request)
      .expect(200)
      .then(res => {
        expect(res.text).toContain('jolokia')
        const response = JSON.parse(res.text)
        expect(response.value.jolokia).toBeTruthy()
        for (const k in response.value.jolokia) {
          expect(k).not.toContain('10.217.0.214')
          expect(k).toContain('***.***.***.***')
        }
      })
  })
})

describe('LRUCache Tests', () => {
  beforeEach(() => {
    // Reset TestOptions
    testData.authorization.forbidden = false
    testData.authorization.adminAllowed = true
    testData.authorization.viewerAllowed = true
    processRBACEnvVar(defaultACLFile)

    /*
     * Override jolokia URI components so that the final
     * jolokia request is circled back to the cluster test server
     */
    testData.pod.resource.status.podIP = CLUSTER_HOST
    testData.metadata.jolokia.port = CLUSTER_PORT

    // Clear the caches
    clearCaches()
  })

  describe('podIpCache', () => {
    // Spy on cache operations
    const origPodIpCacheGet = podIpCache.get
    const origPodIpCacheSet = podIpCache.set

    beforeEach(() => {
      podIpCache.get = jest.fn(origPodIpCacheGet)
      podIpCache.set = jest.fn(origPodIpCacheSet)
    })

    afterEach(() => {
      // Restore original methods
      podIpCache.get = origPodIpCacheGet
      podIpCache.set = origPodIpCacheSet
    })

    it('should cache pod IP on first request', async () => {
      const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
      const response1 = await appPost(path, testData.jolokia.listMBeans.request)
      expect(response1.status).toBe(200)
      // No pod ip will have been cached
      expect(podIpCache.get).toHaveBeenCalledTimes(0)
      // pod ip will be cached
      expect(podIpCache.set).toHaveBeenCalledTimes(1)

      // Second request should use cached IP
      const response2 = await appPost(path, testData.jolokia.listMBeans.request)
      expect(response2.status).toBe(200)
      // Pod ip fetched from cache
      expect(podIpCache.get).toHaveBeenCalledTimes(1)
      // No new caching as ip returned from cache
      expect(podIpCache.set).toHaveBeenCalledTimes(1)
    })

    it('should return cached pod IP on subsequent requests', async () => {
      const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`

      // First request - cache miss
      const response1 = await appPost(path, testData.jolokia.listMBeans.request)
      expect(response1.status).toBe(200)
      expect(podIpCache.get).toHaveBeenCalledTimes(0)
      expect(podIpCache.set).toHaveBeenCalledTimes(1)

      // Second request - cache hit
      const response2 = await appPost(path, testData.jolokia.listMBeans.request)
      expect(response2.status).toBe(200)
      expect(podIpCache.get).toHaveBeenCalledTimes(1)
      expect(podIpCache.set).toHaveBeenCalledTimes(1)
    })

    it('should handle different pods with different IPs', async () => {
      const path1 = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`
      const path2 = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri2()}`

      const response1 = await appPost(path1, testData.jolokia.listMBeans.request)
      expect(response1.status).toBe(200)
      expect(podIpCache.get).toHaveBeenCalledTimes(0)
      expect(podIpCache.set).toHaveBeenCalledTimes(1)

      const response2 = await appPost(path2, testData.jolokia.listMBeans.request)
      expect(response2.status).toBe(200)
      expect(podIpCache.get).toHaveBeenCalledTimes(0)
      expect(podIpCache.set).toHaveBeenCalledTimes(2)
    })

    it('should cache pod IP consistently for same pod', async () => {
      const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`

      // Make multiple requests to same pod
      const iterations = 3
      const promises = []
      for (let i = 0; i < iterations; i++) {
        promises.push(appPost(path, testData.jolokia.listMBeans.request))
      }

      const responses = await Promise.all(promises)

      // All responses should be successful
      responses.forEach(res => {
        expect(res.status).toBe(200)
      })

      // Because requests ran concurrently, stampede protection caught them!
      // The first request missed and set the promise.
      // The other 2 requests hit '.get' while it was pending.
      expect(podIpCache.get).toHaveBeenCalledTimes(iterations - 1)
      expect(podIpCache.set).toHaveBeenCalledTimes(1)
    })
  })

  describe('rbacCache', () => {
    const origRbacCacheGet = rbacCache.get
    const origRbacCacheSet = rbacCache.set

    beforeEach(() => {
      // Spy on cache operations
      rbacCache.get = jest.fn(origRbacCacheGet)
      rbacCache.set = jest.fn(origRbacCacheSet)
    })

    afterEach(() => {
      // Restore original methods
      rbacCache.get = origRbacCacheGet
      rbacCache.set = origRbacCacheSet
    })

    it('should cache RBAC authorization result on first request', async () => {
      const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`

      // First request - cache miss
      const response1 = await appPost(path, testData.jolokia.search.request)
      expect(response1.status).toBe(200)
      expect(rbacCache.get).toHaveBeenCalledTimes(0)
      expect(rbacCache.set).toHaveBeenCalledTimes(1)

      // Second request - cache hit
      const response2 = await appPost(path, testData.jolokia.search.request)
      expect(response2.status).toBe(200)
      expect(rbacCache.get).toHaveBeenCalledTimes(1)
      expect(rbacCache.set).toHaveBeenCalledTimes(1)
    })

    it('should cache RBAC for same namespace/pod/verb combination', async () => {
      const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`

      // Make multiple requests with same parameters
      const responses = []
      const iterations = 5
      for (let i = 0; i < iterations; i++) {
        const response = await appPost(path, testData.jolokia.search.request)
        responses.push(response)
      }

      // All responses should be successful
      responses.forEach(res => {
        expect(res.status).toBe(200)
        expect(rbacCache.get).toHaveBeenCalledTimes(iterations - 1)
        expect(rbacCache.set).toHaveBeenCalledTimes(1)
      })
    })

    it('should handle RBAC cache with viewer role', async () => {
      testData.authorization.adminAllowed = false
      testData.authorization.viewerAllowed = true

      const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`

      const response1 = await appPost(path, testData.jolokia.bulkRequestWithViewerRole.request)
      expect(response1.status).toBe(200)
      expect(rbacCache.get).toHaveBeenCalledTimes(0)
      // Called twice - once testing for admin then the second testing for viewer
      expect(rbacCache.set).toHaveBeenCalledTimes(2)

      const response2 = await appPost(path, testData.jolokia.bulkRequestWithViewerRole.request)
      expect(response2.status).toBe(200)
      expect(rbacCache.get).toHaveBeenCalledTimes(2)
      expect(rbacCache.set).toHaveBeenCalledTimes(2)
    })

    it('should handle RBAC cache with admin role', async () => {
      testData.authorization.adminAllowed = true
      testData.authorization.viewerAllowed = true

      const path = `/management/namespaces/${testData.metadata.namespace}/pods/${jolokiaUri()}`

      const response1 = await appPost(path, testData.jolokia.bulkRequestWithInterception.request)
      expect(response1.status).toBe(200)
      expect(rbacCache.get).toHaveBeenCalledTimes(0)
      expect(rbacCache.set).toHaveBeenCalledTimes(1)

      const response2 = await appPost(path, testData.jolokia.bulkRequestWithInterception.request)
      expect(response2.status).toBe(200)
      expect(rbacCache.get).toHaveBeenCalledTimes(1)
      expect(rbacCache.set).toHaveBeenCalledTimes(1)
    })
  })
})
