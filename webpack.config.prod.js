/* eslint-env node */
const webpack = require('webpack')
const { merge } = require('webpack-merge')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')
const { common } = require('./webpack.config.common.js')

const CompressionPlugin = require('compression-webpack-plugin')

module.exports = (env, argv) => {

  //
  // Prefix path will be determined by the installed web server platform
  //
  const publicPath = '/'

  return merge(common('production', publicPath, env), {

    devtool: 'source-map',

    plugins: [
      new CopyWebpackPlugin({
        patterns: [ { from: path.resolve(__dirname, 'public', 'hawtio-logo.svg'), to: 'hawtio-logo.svg' }],
      }),
      new CompressionPlugin({
        threshold: 8192,
      }),
    ]
  })
}
