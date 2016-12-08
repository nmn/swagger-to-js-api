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
var _ = require('lodash')
var chalk = require('chalk')

module.exports = function (swaggerObj, options) {
  const basePath = swaggerObj.basePath.replace(/\/$/, '')
  const operations = Object.keys(swaggerObj.paths)
    .map(function (path) {
      // flatten the path objects into an array of pathObjects
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

  const operationIds = _.groupBy(operations, 'operationId')
  const duplicatedOps = Object.keys(operationIds)
    .filter(key => operationIds[key].length > 1)

  if (duplicatedOps.length) {
    throw new Error(`
${chalk.red(`The Swagger JSON contains duplicate operationIds for different endpoints.
The following are duplicated:`)}
${JSON.stringify(duplicatedOps, null, 2)}
    `)
  }

  operations.forEach(pathObj => {
    if (!pathObj.summary && !pathObj.description) {
      console.warn(`${chalk.yellow('WARNING:')} Summary and discription missing for ${chalk.bold(pathObj.operationId)}`)
    }
  })

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
    path.join(options.output, 'helpers/', 'makeFormData.js'),
    fs.readFileSync(path.join(__dirname, './helpers/', 'makeFormData.js'), 'utf-8')
  )
  fs.writeFileSync(
    path.join(options.output, 'types/', 'AjaxObject.js.flow'),
    fs.readFileSync(path.join(__dirname, './helpers/', 'AjaxObject.js'), 'utf-8')
  )

  const toFindDuplicates = {}
  Object.keys(swaggerObj.definitions)
    .map(function (defName) {
      if (toFindDuplicates[defName.toLowerCase()]) {
/* eslint-disable */
console.error(`
${chalk.red('ERROR:')}
There are two different types with the name ${defName}, that only differ in case.
This will cause the files to overwrite each other on case-insensitve file systems
like the one on macOS.
`)
/* eslint-enable */
      }
      toFindDuplicates[defName.toLowerCase()] = true
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
      var imports = _.uniq(tuple[2])
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
      console.log(':: ', name)
      var code = tuple[1]
      fs.writeFileSync(
        path.join(options.output, 'types/', name + '.js'),
        '// @flow\n\n' + code,
        'utf-8'
      )
    })

  var paths = operations
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

  var indexFile = _.uniq(paths.map(function (arr) { return arr[0] }))
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
