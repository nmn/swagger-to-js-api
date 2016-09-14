'use strict'

function AjaxPipe (obj) {
  var that = this
  Object.keys(obj)
    .forEach(function (key) {
      that[key] = obj[key]
    })
}

AjaxPipe.prototype.pipeThrough = function (fn) {
  return fn(this)
}

module.exports = AjaxPipe
