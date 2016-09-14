'use strict'

var fs = require('fs')
var path = require('path')
var pathObjToAST = require('./pathObjToAST')
var babel = require('babel-core')
var generate = require('babel-generator').default
var es2015 = require('babel-preset-es2015')
var flow = require('babel-plugin-transform-flow-strip-types')

module.exports = function (swaggerObj, options) {
  fs.mkdirSync(path.join(options.output, 'src/'))
  fs.mkdirSync(path.join(options.output, 'helpers/'))
  fs.mkdirSync(path.join(options.output, 'types/'))
  fs.mkdirSync(path.join(options.output, 'dist/'))
  fs.writeFileSync(
    path.join(options.output, 'helpers/', 'AjaxPipe.js'),
    fs.readFileSync(path.join(__dirname, './helpers/', 'AjaxPipe.js'), 'utf-8')
  )
  fs.writeFileSync(
    path.join(options.output, 'helpers/', 'makeQuery.js'),
    fs.readFileSync(path.join(__dirname, './helpers/', 'makeQuery.js'), 'utf-8')
  )

  var basePath = swaggerObj.basePath.replace(/\/$/, '')
  var paths = Object.keys(swaggerObj.paths)
    .map(function (path) {
      return Object.keys(swaggerObj.paths[path])
        .map(function (method) {
          var config = swaggerObj.paths[path][method]
          config.method = method
          config.path = basePath + path
          return config
        })
    })
    .reduce(function (soFar, current) {
      return soFar.concat(current)
    }, [])
    .map(pathObjToAST)
    .map(([name, ast]) => [name, generate(ast, {quotes: 'single'}).code])

  paths
  .forEach(
    ([name, code]) =>
      fs.writeFileSync(
        path.join(options.output, 'src/', name + '.js.flow'),
        code,
        'utf-8'
      )
  )

  paths
    .map(([name, code]) => [name, babel.transform(code, {
      presets: [es2015], plugins: [flow]
    }).code])
    .forEach(
      ([name, code]) =>
        fs.writeFileSync(
          path.join(options.output, 'src/', name + '.js'),
          code,
          'utf-8'
        )
    )

  var indexFile = paths
    .map(([name]) => name)
    .map(name => `${name}: require('./src/${name}.js').default`)
    .join(',\n  ')

  indexFile = 'module.exports = {\n  ' + indexFile + '\n}\n'

  fs.writeFileSync(
    path.join(options.output, 'index.js'),
    indexFile,
    'utf-8'
  )

  fs.writeFileSync(
    path.join(options.output, 'package.json'),
    JSON.stringify({
      name: options.name,
      description: 'auto-generater api from Swagger.json',
      version: options.version,
      main: 'index.js',
      license: 'MIT',
      dependencies: {}
    }, null, 2),
    'utf-8'
  )

  fs.writeFileSync(
    path.join(options.output, 'bower.json'),
    JSON.stringify({
      name: options.name,
      description: 'auto-generater api from Swagger.json',
      version: options.version,
      main: ['dist/index.js'],
      license: 'MIT',
      ignore: [
        'node_modules',
        'src',
        'helpers',
        'types'
      ]
    }, null, 2),
    'utf-8'
  )
}
