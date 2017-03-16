class Middleware {
  handle ($) {
    //making chain of middlewares
    let chain = new Promise(resolve => { resolve($) })

    this.order.forEach(middleware => {
      if (($.goto) && (middleware === $.goto)) {
        return chain = chain.then(($) => {
          return new Promise(resolve => $)
        })
      }

      if (this.catchers.indexOf(middleware) > -1)
        return chain = chain.catch(this[middleware])

      return chain = chain.then($ => {
        return new Promise((resolve, reject) => {
          return this[middleware]($, resolve, reject)
        })
      })
    })

    chain = chain.catch((wtf) => {
      console.log(wtf)
    })

    return chain
  }

  get order() {
    return []
  }

  get catchers() {
    return []
  }
}

module.exports = Middleware