/* eslint-env node */
const webpack = require('webpack')
const { merge } = require('webpack-merge')
const dotenv = require('dotenv')
const path = require('path')
const express = require('express')
const { common } = require('./webpack.config.common.js')
const { devDependencies } = require('./package.json')

// this will update the process.env with environment variables in .env file
dotenv.config({ path: path.join(__dirname, '.env') })

module.exports = (env, argv) => {
  //
  // No support for the dev server providing a default router prefix
  // so need to specify here.
  //
  // If this is to be changed then also need to change the same value
  // in the public/hawtconfig.json file
  //
  const publicPath = '/hawtio'

  return merge(common('development', publicPath, env), {
    devtool: 'eval-source-map',
    stats: 'errors-warnings',

    module: {
      rules: [
        {
          test: /\.js$/,
          enforce: 'pre',
          use: [
            {
              loader: 'source-map-loader',
              options: {
                filterSourceMappingUrl: (url, resourcePath) => {
                  if (/.*@hawtio\/react.*/i.test(resourcePath)) {
                    console.log(`Loading source maps for ${resourcePath}`)
                    return true
                  }

                  return false
                },
              },
            },
          ],
        },
      ],
    },

    devServer: {
      liveReload: true,
      port: 9444,
      server: {
        type: 'https',
        options: {
          ca: './tls-certificates/certificate-authority.crt',
          key: './tls-certificates/server.localhost.key',
          cert: './tls-certificates/server.localhost.crt',
        },
      },

      static: [
        './dist',
        {
          publicPath: publicPath,
          directory: path.join(__dirname, 'public'),
        },
      ],

      // Allow Bridge running in a container to connect to the plugin dev server.
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Authorization',
      },

      historyApiFallback: {
        disableDotRule: true,
        index: publicPath,
      },

      devMiddleware: {
        publicPath: publicPath,
        writeToDisk: true,
      },

      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
          throw new Error('webpack-dev-server is not defined')
        }

        /*
         * Ensure that dev server properly handles json in request body
         * Important to keep a high limit as the default of 100kb can be
         * exceeded by request bodies resulting in the parser transmitting
         * an empty body.
         */
        devServer.app.use(express.json({ type: '*/json', limit: '50mb', strict: false }))
        devServer.app.use(express.urlencoded({ extended: false }))

        // Redirect / or /${publicPath} to /${publicPath}/
        devServer.app.get('/', (_, res) => res.redirect(`${publicPath}/`))
        devServer.app.get(`/${publicPath}$`, (_, res) => res.redirect(`${publicPath}/`))

        /* Fetch the preset-connections */
        devServer.app.get(`${publicPath}/preset-connections`, (_, res) => {
          res.set('Content-Type', 'application/javascript')
          res.send(JSON.stringify({}))
        })

        /*
         * Function to construct the session-monitor config
         * and make it available
         */
        const sessionTimeout = (_, res) => {
          const sessionConfig = {
            timeout: -1,
          }

          res.set('Content-Type', 'application/javascript')
          res.send(JSON.stringify(sessionConfig))
        }

        /* Fetch the session timeout from the app's own public url path */
        devServer.app.get(`${publicPath}/auth/config/session-timeout`, sessionTimeout)

        return middlewares
      },
    },

    devtool: 'eval-source-map',

    optimization: {
      chunkIds: 'named',
      minimize: true,
    },
  })
}
