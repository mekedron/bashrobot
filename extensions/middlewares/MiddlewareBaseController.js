const { TelegramBaseController } = require('telegram-node-bot')
const Middleware = require('./Middleware')

// TODO: add jsdoc

class MiddlewareBaseController extends TelegramBaseController {
  constructor() {
    super()

    this._middlewares = []
    
    let self = this
    let chainHandler = function (func) {
      return function () {
        let args = [];
        for (let i = 0; i < arguments.length; i++) {
          args[i] = arguments[i];
        }

        if (args[0].chain)
          return args[0].chain.then($ => {
            args.shift()
            args.unshift($)
            return new Promise(resolve => {
              resolve(func.apply(self, args))
            })
          })
          .catch(this.catch)

        return new Promise(resolve => {
          resolve(func.apply(self, args))
        })
        .catch(this.catch)
      }
    }

    if (this.handle) {
      let func = this.handle
      this.handle = chainHandler(func)
    }

    for (let routeName in this.routes) {
      if(!this.routes.hasOwnProperty(routeName)) return
      let route = this.routes[routeName]
      let func = this[route]
      this[route] = chainHandler(func)
    }
  }

  before($) {
    $.errors = []

    if (this.mwBefore)
      this._middlewares.unshift(this.mwBefore)

    if (this.mwAfter)
      this._middlewares.push(this.mwAfter)

    //making chain of middlewares
    let chain = new Promise(resolve => { resolve($) })

    this._middlewares.forEach(middleware => {
      if (middleware instanceof Middleware)
        return chain = chain.then($ => {
          return middleware.handle($)
        })

      // if middleware is a function, just call it with scope
      if (typeof middleware === 'function')
        return chain = chain.then($ => {
          return new Promise((resolve, reject) => {
            return middleware($, resolve, reject)
          })
        })
    })

    chain = chain.catch(this.catch)

    $.chain = chain
    return $
  }

  catch(err) {
    console.error(err)
  }

  middleware() {
    for (var i = 0; i < arguments.length; i++) {
      this._middlewares.push(arguments[i])
    }
    return this
  }
}

module.exports = MiddlewareBaseController