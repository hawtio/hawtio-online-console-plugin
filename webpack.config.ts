/* eslint-env node */

const webpack = require('webpack')
const { ConsoleRemotePlugin } = require('@openshift-console/dynamic-plugin-sdk-webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const DotenvPlugin = require('dotenv-webpack')
const dotenv = require('dotenv')
const path = require('path')
const express = require('express')
const { devDependencies } = require('./package.json')

// this will update the process.env with environment variables in .env file
dotenv.config({ path: path.join(__dirname, '.env') })

const isProd = process.env.NODE_ENV === 'production'

//
// No support for the dev server providing a default router prefix
// so need to specify here.
//
// If this is to be changed then also need to change the same value
// in the public/hawtconfig.json file
//
const publicPath = '/hawtio'


module.exports = (env, argv) => {

  // hawtio-online-console-plugin
  const pluginName = env.PLUGIN_NAME.replace('@', '').replace('/', '-')
  const packageVersion = env.PACKAGE_VERSION

  console.log(`Compilation Mode: ${process.env.NODE_ENV}`)
  console.log(`Public Path: ${publicPath}`)
  console.log(`Plugin Name: ${pluginName}`)
  console.log(`Package Version: ${packageVersion}`)

  const config = {
    context: path.resolve(__dirname, 'src'),

    // No regular entry points needed.
    // All plugin related scripts are generated via ConsoleRemotePlugin.
    entry: {},

    mode: isProd ? 'production' : 'development',
    module: {
      rules: [
        {
          test: /\.js$/,
          enforce: "pre",
          use: [
            {
              loader: "source-map-loader",
              options: {
                filterSourceMappingUrl: (url, resourcePath) => {
                  if (/.*@hawtio\/react.*/i.test(resourcePath)) {
                    console.log(`Loading source maps for ${resourcePath}`)
                    return true
                  }

                  return false
                }
              }
            }
          ]
        },
        {
          test: /\.(jsx?|tsx?)$/,
          exclude: /\/node_modules\//,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: path.resolve(__dirname, 'tsconfig.json'),
              },
            },
          ],
        },
        {
          test: /\.(css)$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg|woff2?|ttf|eot|otf)(\?.*$|$)/,
          type: 'asset/resource',
          generator: {
            filename: isProd ? 'assets/[contenthash][ext]' : 'assets/[name][ext]',
          },
        },
        {
          test: /\.(m?js)$/,
          resolve: {
            fullySpecified: false,
          },
        },
      ]
    },
    plugins: [
      new ConsoleRemotePlugin({
        validateSharedModules: true,
        pluginMetadata: {
          name: pluginName,
          version: packageVersion,
          displayName: "HawtIO OpenShift Console Plugin",
          description: "HawtIO Plugin serving integrated UI in OpenShift Console.",
          exposedModules: {
            ExamplePage: "./pages/ExamplePage",
            HawtioMainTab: "./pages/HawtioMainTab"
          },
          dependencies: {
            "@console/pluginAPI": "*"
          }
        }
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: path.resolve(__dirname, 'locales'), to: 'locales' }],
      }),
      new DotenvPlugin({
        safe: true,
        allowEmptyValues: true,
        defaults: true,
        systemvars: true,
        ignoreStub: true,
      }),
      new HtmlWebpackPlugin({
        inject: true,
        template: path.resolve(__dirname, 'public', 'index.html'),
        favicon: path.resolve(__dirname, 'public', 'favicon.ico'),
        publicPath: publicPath,
      }),
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(process.env),
        HAWTIO_ONLINE_PACKAGE_PLUGIN_NAME: JSON.stringify(pluginName),
        HAWTIO_ONLINE_PACKAGE_VERSION: JSON.stringify(packageVersion),
        HAWTIO_ONLINE_PUBLIC_PATH: JSON.stringify(publicPath),
      }),
    ],
    output: {
      path: path.resolve(__dirname, 'dist'),
      // Set base path to desired publicPath
      publicPath: publicPath,
      pathinfo: true,
      filename: isProd ? '[name]-bundle-[hash].min.js' : '[name]-bundle.js',
      chunkFilename: isProd ? '[name]-chunk-[chunkhash].min.js' : '[name]-chunk.js',
    },
    resolve: {
      modules: ['node_modules'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      fallback: {
        http: require.resolve("stream-http"),
        url: require.resolve("url"),
      },
    },
    stats: 'errors-warnings',

    devServer: {
      liveReload: true,
      port: 9001,

      static: [
        './dist',
        {
          publicPath: publicPath,
          directory: path.join(__dirname, 'public')
        }
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
            timeout: -1
          }

          res.set('Content-Type', 'application/javascript')
          res.send(JSON.stringify(sessionConfig))
        }

        /* Fetch the session timeout from the app's own public url path */
        devServer.app.get(`${publicPath}/auth/config/session-timeout`, sessionTimeout)



        return middlewares
      },
    },

    devtool: isProd ? false : 'eval-source-map',

    optimization: {
      chunkIds: isProd ? 'deterministic' : 'named',
      minimize: isProd,
    },
  }

  return config
}
