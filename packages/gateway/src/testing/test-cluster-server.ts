import express from 'express'
import * as fs from 'fs'
import * as https from 'https'
import path from 'path'
import { expressLogger, logger } from '../logger'
import { testData } from './gateway-test-inputs'

/*
/******************************************
 * T E S T   C L U S T E R   S E R V E R
 ******************************************/

export const CLUSTER_HOST = 'localhost'
export const CLUSTER_PORT = 10443
export const CLUSTER_BASE_ADDRESS = `https://${CLUSTER_HOST}:${CLUSTER_PORT}`

const clusterServer = express()
clusterServer.use(expressLogger)
clusterServer.use(express.json())

/*
 * Route for getting the pod IP
 * Returns the Cluster hostname so the jolokia route can be tested
 */
clusterServer.route('/api/*').get((req, res) => {
  res.status(201).json(JSON.stringify(testData.pod.resource))
})

/*
 * Route for getting subject access reviews
 */
clusterServer.route('/apis/authorization*').post((req, res) => {
  if (testData.authorization.forbidden) {
    res.status(403).send()
    return
  }

  if (!req.body || !req.body.verb) {
    const msg = `ERROR: No authorization body or no verb provided in authorization body`
    logger.error(msg)
    res.status(502).send({ error: msg })
    return
  }

  switch (req.body.verb) {
    case 'get':
      if (testData.authorization.viewerAllowed)
        res.status(200).json(JSON.stringify(testData.authorization.allowedResponse))
      else res.status(200).json(JSON.stringify(testData.authorization.notAllowedResponse))

      return
    case 'update':
      if (testData.authorization.adminAllowed)
        res.status(200).json(JSON.stringify(testData.authorization.allowedResponse))
      else res.status(200).json(JSON.stringify(testData.authorization.notAllowedResponse))

      return
  }

  const msg = 'ERROR: Failure part reached in authorization response'
  logger.error(msg)
  res.status(502).send({ error: msg })
})

/*
 * Direct the jolokia path back to this cluster
 * In reality, it would point to the real ip address of the pod
 */
clusterServer.route(`${testData.metadata.jolokia.path}*`).all((req, res) => {
  const reqPayload = JSON.stringify(req.body)

  if (req.method === 'GET') {
    // TODO handle when dealing with jolokia get requests
    res.status(502).send('Test not implemented')
  } else if (req.method === 'POST') {
    let k: keyof typeof testData.jolokia
    for (k in testData.jolokia) {
      const td = testData.jolokia[k]

      // Test if payload matches the initial test data request
      if (reqPayload === JSON.stringify(td.request)) {
        res.status(200).send(td.response)
        return
      }

      if (Object.hasOwn(td, 'intercepted') && reqPayload === JSON.stringify(td.intercepted.request)) {
        res.status(200).send(td.intercepted.response)
        return
      }
    }

    const msg = `ERROR: Proxy request body not expected: (${JSON.stringify(req.body)})`
    logger.error(msg)
    res.status(502).send(msg)
    return
  }

  // Invalid method called
  const msg = `ERROR: Proxy Handler request method not recognized: ${req.method}`
  logger.error(msg)
  res.status(502).send({ error: msg })
})

/*
 * Cluster will always be HTTPS
 * so add the keys and certificates
 */
const clusterHttpsServer = https.createServer(
  {
    ca: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'CA', 'unit.test-ca.crt')),
    key: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'private', 'server.unit.test.key')),
    cert: fs.readFileSync(path.resolve(__dirname, '..', '..', 'test-tls', 'certs', 'server.unit.test.crt')),
    requestCert: true,
    rejectUnauthorized: false,
  },
  clusterServer,
)

/*
 * Start the cluster server listening ready for the tests
 */
export const runningClusterServer = clusterHttpsServer.listen(CLUSTER_PORT, () => {
  logger.info(`INFO: Test cluster server listening on port ${CLUSTER_PORT}`)
})
