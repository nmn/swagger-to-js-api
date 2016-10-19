'use strict'

var t = require('babel-types')
var _ = require('lodash')
var swaggerTypeToFlowType = require('./swaggerTypeToFlowType')

module.exports = function (pathObj) {
  var typeImports = []
  var imports = []
  pathObj.parameters = pathObj.parameters || []
  var hasQuery = !!(pathObj.parameters || []).filter(function (param) { return param.in === 'query' }).length
  var bodyParamJson = (pathObj.parameters || []).filter(function (param) { return param.in === 'formData' || param.in === 'body' })[0]
  var hasBody = !!(pathObj.parameters || []).filter(function (param) { return param.in === 'formData' || param.in === 'body' }).length

  var responseType = {
    type: 'TypeAlias',
    id: t.Identifier('Response'),
    typeParameters: null,
    right: t.AnyTypeAnnotation()
  }

  if (_.get(pathObj, 'responses.200.schema')) {
    responseType.right = swaggerTypeToFlowType(_.get(pathObj, 'responses.200.schema'), typeImports)
  }

  // prepare a template string for the URL that may contain 0 or more url params
  var urlParams = []
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
        urlParams.push(current)
        compiled.expressions.push(t.Identifier(current))
        return compiled
      }
    }, {quasis: [], expressions: [], mode: 'string'})

  var pathParams = pathObj.parameters
    .filter(param => param.in === 'path' && param.required)
    .map(param => param.name)

  var paramsUsed = urlParams.sort()
  var paramsProvided = pathParams.sort()

  if (!_.isEqual(paramsUsed, paramsProvided)) {
    throw new Error(`
      There is a problem in the operation ${pathObj.operationId}.

      The URL of the operation is: ${pathObj.path} which has the following params:
      ${JSON.stringify(paramsUsed)}

      But the params actually specified are:
      ${JSON.stringify(paramsProvided)}
    `)
  }
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

  var hostnameParam = t.Identifier('hostname')
  hostnameParam.typeAnnotation = t.TypeAnnotation(
    t.StringTypeAnnotation()
  )
  var queryParam = hasQuery ? t.Identifier('query') : []
  var bodyParam = hasBody ? t.Identifier('data') : []

  if (hasQuery) {
    queryParam.typeAnnotation = t.TypeAnnotation(
      t.GenericTypeAnnotation(
        t.Identifier('Object'),
        null
      )
    )
  }

  if (bodyParamJson && hasBody) {
    if (bodyParamJson.schema) {
      bodyParam.typeAnnotation = t.TypeAnnotation(
        swaggerTypeToFlowType(bodyParamJson.schema, typeImports)
      )
    } else if (bodyParamJson.type) {
      bodyParam.typeAnnotation = t.TypeAnnotation(
        swaggerTypeToFlowType(bodyParamJson, typeImports)
      )
    }
  }

  // make the actual function.
  // always accept a hostname.
  // accept all path params as individual arguments
  // also accept `query` and `data` as the last two arguments if API accepts
  var fnStatement = t.FunctionDeclaration(
    t.Identifier(pathObj.operationId),
    [hostnameParam]
      .concat(
        pathObj.parameters
        .filter(param => param.in === 'path' && param.required)
        .map(paramToName)
      )
      .concat(queryParam)
      .concat(bodyParam),
    body
  )

  fnStatement.returnType = t.TypeAnnotation(
    t.GenericTypeAnnotation(
      t.Identifier('AjaxPipe'),
      t.TypeParameterInstantiation([
        t.GenericTypeAnnotation(t.Identifier('AjaxObject'), null),
        t.GenericTypeAnnotation(t.Identifier('Response'), null)
      ])
    )
  )

  var fn = t.ExportDefaultDeclaration(fnStatement)

  // declare imports for the helpers that are used in the function.
  if (hasQuery) {
    imports.push(t.ImportDeclaration([t.ImportDefaultSpecifier(t.Identifier('makeQuery'))], t.StringLiteral('../helpers/makeQuery')))
  }
  imports.push(t.ImportDeclaration([t.ImportDefaultSpecifier(t.Identifier('AjaxPipe'))], t.StringLiteral('../helpers/AjaxPipe')))

  // Create a AST object for `Program` that includes the imports and function
  // and returns it along with the name of the function so it can be written to
  // a file.
  typeImports = _.uniq(typeImports).map(function (name) {
    var importStatement = t.ImportDeclaration(
      [t.ImportSpecifier(t.Identifier(name), t.Identifier(name))],
      t.StringLiteral('../types/' + name)
    )
    importStatement.importKind = 'type'

    return importStatement
  })
  return [
    pathObj.operationId,
    t.Program(
      imports
      .concat(typeImports)
      .concat([responseType])
      .concat([fn])
    )
  ]
}

function paramToName (param) {
  var paramName = t.Identifier(param.name)
  if (param.schema) {
    paramName.typeAnnotation = t.TypeAnnotation(
      swaggerTypeToFlowType(param.schema)
    )
  } else if (param.type) {
    paramName.typeAnnotation = t.TypeAnnotation(
      swaggerTypeToFlowType(param)
    )
  }
  return paramName
}
