/* eslint-env node */

const webpack = require('webpack')
const { ConsoleRemotePlugin } = require('@openshift-console/dynamic-plugin-sdk-webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const DotenvPlugin = require('dotenv-webpack')
const dotenv = require('dotenv')
const path = require('path')
const { devDependencies } = require('./package.json')

const isProd = process.env.NODE_ENV === 'production'

module.exports = (wp) => {

  console.dir(wp)

  const config = {
    context: path.resolve(__dirname, 'src'),

    // No regular entry points needed.
    // All plugin related scripts are generated via ConsoleRemotePlugin.
    entry: {},

    mode: isProd ? 'production' : 'development',
    module: {
      rules: [
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
          name: "hawtio-online-console-plugin",
          version: "2.2.0",
          displayName: "HawtIO OpenShift Console Plugin",
          description: "HawtIO Plugin serving integrated UI in OpenShift Console.",
          exposedModules: {
            ExamplePage: "./components/ExamplePage",
            HawtioMainTab: "./components/HawtioMainTab"
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
    ],
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name]-bundle-[hash].min.js' : '[name]-bundle.js',
      chunkFilename: isProd ? '[name]-chunk-[chunkhash].min.js' : '[name]-chunk.js',
    },
    resolve: {
      modules: ['node_modules'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },

    devServer: {
      static: './dist',
      port: 9001,
      // Allow Bridge running in a container to connect to the plugin dev server.
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Authorization',
      },
      devMiddleware: {
        writeToDisk: true,
      },
    },

    devtool: isProd ? false : 'source-map',

    optimization: {
      chunkIds: isProd ? 'deterministic' : 'named',
      minimize: isProd,
    },
  }

  console.dir(config, {depth: null})

  return config
}
