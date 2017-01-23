'use strict';
var webpack = require('webpack');
var fs = require('fs');
var path = require('path');
// Builds example bundles
module.exports = {
    context: __dirname,
    entry: [
        './src/index.js'
    ],
    output: {
        path: __dirname + "/dist",
        filename: "bundle.js",
        sourceMapFilename: "bundle.map",
        publicPath: '/dist',
    },
    module: {
        loaders: [{
            test: /\.jsx?$/,
            loaders: ['babel'],
            include: path.join(__dirname, 'src')
        }]
    },
    plugins: [],
    resolve: {
      extensions: ["", ".js", ".jsx"],
    }
};
