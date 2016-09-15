'use strict'

var t = require('babel-types')
var _ = require('lodash')

module.exports = function (pathObj) {
  pathObj.parameters = pathObj.parameters || []
  var hasQuery = !!(pathObj.parameters || []).filter(function (param) { return param.in === 'query' }).length
  var hasBody = !!(pathObj.parameters || []).filter(function (param) { return param.in === 'formData' || param.in === 'body' }).length

  // prepare a template string for the URL that may contain 0 or more url params
  var urlParts = pathObj.path.split(/(\}|\{)/)
    .reduce(function (compiled, current) {
      if (current === '{') {
        return _.assign({}, compiled, {mode: 'variable'})
      }
      if (current === '}') {
        return _.assign({}, compiled, {mode: 'string'})
      }
      if (compiled.mode === 'string') {
        compiled.quasis.push(t.TemplateElement({raw: current, cooked: current}))
        return compiled
      }
      if (compiled.mode === 'variable') {
        compiled.expressions.push(t.Identifier(current))
        return compiled
      }
    }, {quasis: [], expressions: [], mode: 'string'})

  // If the endpoint accepts query params, + a queryString at the end of the pathname
  var pathExpression = hasQuery
    ? t.BinaryExpression('+',
      t.TemplateLiteral(urlParts.quasis, urlParts.expressions),
      t.CallExpression(
        t.Identifier('makeQuery'),
        [t.Identifier('query')]
      )
    )
    : t.TemplateLiteral(urlParts.quasis, urlParts.expressions)

  // Create the properties that will put on the returned object
  var objectProperties = [
    t.objectProperty(t.Identifier('method'), t.StringLiteral(pathObj.method.toUpperCase())),
    t.objectProperty(
      t.Identifier('url'),
      t.BinaryExpression(
        '+',
        t.Identifier('hostname'),
        pathExpression
      )
    )
  ]

  // if the endpoint takes a post-body, add that as a key to the object
  if (hasBody) {
    objectProperties.push(t.objectProperty(t.Identifier('data'), t.Identifier('data')))
  }

  // the body of the function.
  // Take the object prepared so far and use it to initialize a AjaxPipe.
  // AjaxPipe will be used to maintain the types for response objects.
  // Soon.
  var body = t.BlockStatement([
    t.ReturnStatement(
      t.NewExpression(
        t.Identifier('AjaxPipe'),
        [
          t.ObjectExpression(objectProperties)
        ]
      )
    )
  ])

  // make the actual function.
  // always accept a hostname.
  // accept all path params as individual arguments
  // also accept `query` and `data` as the last two arguments if API accepts
  var fn = t.ExportDefaultDeclaration(
    t.FunctionDeclaration(
      t.Identifier(pathObj.operationId),
      [t.Identifier('hostname')]
        .concat(
          pathObj.parameters
          .filter(param => param.in === 'path' && param.required)
          .map(paramToName)
        )
        .concat(hasQuery ? t.Identifier('query') : [])
        .concat(hasBody ? t.Identifier('data') : []),
      body
    )
  )

  // declare imports for the helpers that are used in the function.
  var imports = []
  if (hasQuery) {
    imports.push(t.ImportDeclaration([t.ImportDefaultSpecifier(t.Identifier('makeQuery'))], t.StringLiteral('../helpers/makeQuery')))
  }
  imports.push(t.ImportDeclaration([t.ImportDefaultSpecifier(t.Identifier('AjaxPipe'))], t.StringLiteral('../helpers/AjaxPipe')))

  // Create a AST object for `Program` that includes the imports and function
  // and returns it along with the name of the function so it can be written to
  // a file.
  return [pathObj.operationId, t.Program(imports.concat([fn]))]
}

function paramToName (param) { return t.Identifier(param.name) }
