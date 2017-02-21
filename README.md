# swagger-to-js-api
Generates a Javascript functional API to consume a Swagger based REST API

# Usage

```js
import * as api from 'generated-api'

api.createUser(hostname, {name: 'bob'}) // the argument types are being checked here
  .pipeThrough(axios)
  .then(res => res.data)
  .then(user => {/* user has types here */})
```

## Things it does:
- Provides a nice CLI with docs to consume a swagger JSON file and output to a folder.
- Creates a JS API that doesn't rely on any library and doesn't assume you use
  any specific AJAX library.
  It only assumes that you have a function that accepts objects the same as `$http` and makes ajax calls for you.
- It uses Babel core, to create JS code using AST.
- The original code is generated with inline Flow type definitions based on the Swagger JSON.
- The original code is given the extension `.js.flow` while it is compiled to remove Flow types
  and the compiled files are given the `.js` extension.
  This way you get to use compiled standard Javascript code, but the flow types are there if you
  use them.
  The flow types give you autocomplete while making API calls and check for mistakes when you pass the wrong types to the functions.
- The flow types give you errors when you pass in the wrong types of params, and also gives you
  the type definitions for the response object once you `pipeThrough` a function.
- A `package.json` file is generated and points to the one main file that requires all the
  functions. This makes the output folder compatible with NPM.
- Browserify is used to make a standalone file that is written to the `dist` folder within
  the output folder. This file is usable with CommonJS, RequireJS or just a browser Global.
- A `bower.json` file is generated which points to this standalone build for use in codebases
  that don't use commonJS (usually with NPM)

# TODO

- Add type for the `query` param
