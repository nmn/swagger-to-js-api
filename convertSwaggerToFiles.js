'use strict'

var fs = require('fs')
var path = require('path')
var pathObjToAST = require('./pathObjToAST')
var t = require('babel-types')
var babel = require('babel-core')
var generate = require('babel-generator').default
var es2015 = require('babel-preset-es2015')
var flow = require('babel-plugin-transform-flow-strip-types')
var swaggerTypeToFlowType = require('./swaggerTypeToFlowType')

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
    path.join(options.output, 'helpers/', 'AjaxPipe.js.flow'),
    fs.readFileSync(path.join(__dirname, './helpers/', 'AjaxPipe.js.flow'), 'utf-8')
  )
  fs.writeFileSync(
    path.join(options.output, 'helpers/', 'makeQuery.js'),
    fs.readFileSync(path.join(__dirname, './helpers/', 'makeQuery.js'), 'utf-8')
  )
  fs.writeFileSync(
    path.join(options.output, 'types/', 'AjaxObject.js.flow'),
    fs.readFileSync(path.join(__dirname, './helpers/', 'AjaxObject.js'), 'utf-8')
  )

  var basePath = swaggerObj.basePath.replace(/\/$/, '')

  Object.keys(swaggerObj.definitions)
    .map(function (defName) {
      return Object.assign(swaggerObj.definitions[defName], {name: defName})
    })
    .map(function (typeDef) {
      var name = typeDef.name
      var imports = []
      return [
        name,
        swaggerTypeToFlowType(typeDef, imports),
        imports
      ]
    })
    .map(function (tuple) {
      var name = tuple[0]
      var typeAst = tuple[1]
      var imports = tuple[2]
      var mainExport = t.ExportNamedDeclaration(
        {
          type: 'TypeAlias',
          id: t.Identifier(name),
          typeParameters: null,
          right: typeAst
        },
        []
      )
      var program = t.Program(
        imports.map(function (name) {
          var importStatement = t.ImportDeclaration(
            [t.ImportSpecifier(t.Identifier(name), t.Identifier(name))],
            t.StringLiteral('./' + name)
          )
          importStatement.importKind = 'type'

          return importStatement
        }).concat([mainExport])
      )
      return [name, program]
    })
    .map(function (tuple, i) {
      var name = tuple[0]
      var ast = tuple[1]
      return [name, generate(ast, {quotes: 'single'}).code]
    })
    .forEach(function (tuple) {
      var name = tuple[0]
      var code = tuple[1]
      fs.writeFileSync(
        path.join(options.output, 'types/', name + '.js'),
        '// @flow\n\n' + code,
        'utf-8'
      )
    })

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
    .map(function (arr) {
      var name = arr[0]
      var ast = arr[1]
      return [name, generate(ast, {quotes: 'single'}).code]
    })

  paths
  .forEach(
    function (arr) {
      var name = arr[0]
      var code = arr[1]
      fs.writeFileSync(
        path.join(options.output, 'src/', name + '.js.flow'),
        `// @flow\n\nimport type {AjaxObject} from '../types/AjaxObject';\n${code}\n`,
        'utf-8'
      )
    }
  )

  paths
    .map(([name, code]) => [name, babel.transform(code, {
      presets: [es2015], plugins: [flow]
    }).code])
    .forEach(
      function (arr) {
        var name = arr[0]
        var code = arr[1]
        fs.writeFileSync(
          path.join(options.output, 'src/', name + '.js'),
          code + '\n',
          'utf-8'
        )
      }
    )

  var indexFile = paths
    .map(function (arr) { return arr[0] })
    .map(function (name) { return `${name}: require('./src/${name}.js').default` })
    .join(',\n  ')

  indexFile = '// @flow\n\nmodule.exports = {\n  ' + indexFile + '\n}\n'

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
