'use strict'

var path = require('path')

module.exports = function (folderPath) {
  if (folderPath[0] === '/' || folderPath[0] === '~') {
    return folderPath
  }
  return path.join(process.cwd(), folderPath)
}
