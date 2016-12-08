/* eslint-disable spaced-comment */
'use strict'

module.exports = function (obj/*: Object*/)/*: string*/ {
  if (!obj) {
    return ''
  }

  var keys = Object.keys(obj)
  if (!keys.length) {
    return ''
  }

  return '?' +
    keys.map(function (key) {
      var value = obj[key]
      if (typeof value === 'object') {
        value = JSON.stringify(value)
      }
      return encodeURIComponent(key) + '=' + encodeURIComponent(value)
    })
    .join('&')
}
