const { TelegramBaseController } = require('telegram-node-bot')
const Middleware = require('./Middleware')
const MiddlewareCatcher = require('./MiddlewareCatcher')

// TODO: add jsdoc and refactor

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

        if (args[0])
          return args[0].then($ => {
            return new Promise((resolve, reject) => {
              args.shift() // delete chain promise
              resolve(func.apply(self, [$/*, resolve, reject*/].concat(args)))
            })
            .catch(err => {
              this.catch(err, $)
            })
          })
      }
    }

    //redeclare all possible controller route functions

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

  before($, catcher) {
    let scope = $ // for passing scope in reject functions
    // $.errors = []

    if (this.mwBefore)
      this._middlewares.unshift(this.mwBefore)

    if (this.mwAfter)
      this._middlewares.push(this.mwAfter)

    //making chain of middlewares
    let chain = new Promise(resolve => { resolve(scope) })

    this._middlewares.forEach(middleware => {

      //if middlewares is a catcher
      if (middleware instanceof MiddlewareCatcher) 
        return chain = chain.catch(err => {
          return middleware.catch(err, scope)
        })

      //check middleware for array, if the array its controller
      // if (middleware instanceof Array)
      //   return chain = chain.then($ => {
      //     scope = $

      //     if ((!$.ended) || (!$.next) || ((typeof $.next === 'string') && ($.next === middleware[1])))
      //       return new Promise((resolve, reject) => {
      //         let controller = middleware[0]
      //         let newArgs = [$, resolve, reject]

      //         if (typeof middleware[1] === 'string') {
      //           let rotue = middleware[1]
      //           let args = middleware[2] || []

      //           if (controller.routes)
      //             return controller[controller.routes[route]].apply(controller, newArgs.concat(args))

      //           return controller[route].apply(controller, newArgs.concat(args))
      //         }

      //         return controller['handle'].apply(controller, newArgs.concat(middleware[1] || []))
      //       })

      //     return Promise.resolve($)
      //   })

      //check middleware for instance of Middleware class
      if (middleware instanceof Middleware)
        return chain = chain.then($ => {
          scope = $

          //end check also in the handle, but we can check end there for not to doing unnecessary actions
          if (!$.ended)
            return middleware._handle($)

          return Promise.resolve($)
        })

      //check middleware for function
      if (typeof middleware === 'function')
        return chain = chain.then($ => {
          scope = $

          if ((!$.ended) || (!$.next))
            return new Promise((resolve, reject) => {
              return middleware($, resolve, reject)
            })

          return Promise.resolve($)
        })
    })

    chain = chain.then($ => {
      if ($.errors)
        return Promise.reject($.errors)

      return Promise.resolve($)
    })

    chain = chain.catch(err => {
      if (catcher)
        return catcher.catch(err, scope)

      return this.catch(err, scope)
    })

    return chain // insted of real $ return the chain promise, real $ will return in the promise
  }

  catch(err, $) {
    console.error(err)
  }

  middleware() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] instanceof Array) {
        this._middlewares.concat(arguments[i])
        continue;
      }
      this._middlewares.push(arguments[i])
    }
    return this
  }
}

module.exports = MiddlewareBaseController