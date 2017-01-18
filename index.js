'use strict'

var parseArgs = require('command-line-args')
var printUsage = require('command-line-usage')
var resolvePath = require('./resolvePath')
var browserify = require('browserify')
var convertSwaggerToFiles = require('./convertSwaggerToFiles')
var fs = require('fs')
var path = require('path')
var _ = require('lodash')
var packageJson = require('./package.json')

var optionDefs = [
  {name: 'input', alias: 'i', description: 'Path to Swagger JSON file to convert', type: String},
  {name: 'output', alias: 'o', description: 'Folder path To Output generator package to', type: String},
  {name: 'name', alias: 'n', description: 'Name for the generated package', type: String},
  {name: 'version', alias: 'v', description: 'Version number for the generator NPM/Bower modules', type: String},
  {name: 'help', alias: 'h', description: 'Prints this usage guide', type: Boolean, defaultOption: false}
]

var usageGuide = [
  {
    header: 'Swagger to Javascript API generator',
    content: 'Takes a Swagger JSON file and generates UMD NPM and bower package to be used in Javascript applications.'
  },
  {
    header: 'Options',
    optionList: optionDefs
  }
]

var options = parseArgs(optionDefs)

options.version = options.version || '1.0.' + (process.env.BUILD_NUMBER || Math.floor(Math.random() * 1000))

if (options.help) {
  console.log('swagger-to-js-api — v' + packageJson.version)
  console.log(printUsage(usageGuide))
  process.exit(1)
}

if (!options.input) {
  console.error('Need path to JSON file as input. Please use the `-i` flag to pass it in.')
  process.exit(1)
}

if (!options.output) {
  console.error('Need path to destination folder. Please use the `-o` flag to pass it in.')
  process.exit(1)
}

if (!options.name) {
  console.error('Need a name for the generated pacakge. Please use the `-n` flag to pass it in.')
  process.exit(1)
}

options.input = resolvePath(options.input)
options.output = resolvePath(options.output)

var jsonFile = JSON.parse(fs.readFileSync(options.input, 'utf-8'))
convertSwaggerToFiles(jsonFile, options)

browserify({standalone: _.camelCase(options.name)})
  .add(path.join(options.output, './index.js'))
  .bundle()
  .pipe(fs.createWriteStream(path.join(options.output, './dist/index.js')))
