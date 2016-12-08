/* global File, FormData */
/* eslint-disable spaced-comment */
'use strict'

function isObject (value /*: any*/)/*: boolean*/ {
  return value === Object(value)
}

function isArray (value/*: any*/)/*: boolean*/ {
  return Array.isArray(value)
}

function isFile (value/*: any*/)/*: boolean*/ {
  return value instanceof File
}

function objectToFormData (obj/*: Object | Array*/, formData/*: ?FormData*/, preKey/*: ?string*/)/*: FormData*/ {
  formData = formData || new FormData()

  Object.keys(obj).forEach(function (prop) {
    var key = preKey ? (preKey + '[' + prop + ']') : prop

    if (isObject(obj[prop]) && !isArray(obj[prop]) && !isFile(obj[prop])) {
      objectToFormData(obj[prop], formData, key)
    } else if (isArray(obj[prop])) {
      obj[prop].forEach(function (value) {
        var arrayKey = key + '[]'

        if (isObject(value) && !isFile(value)) {
          objectToFormData(value, formData, arrayKey)
        } else {
          formData.append(arrayKey, value)
        }
      })
    } else {
      formData.append(key, obj[prop])
    }
  })

  return formData
}

module.exports = objectToFormData
