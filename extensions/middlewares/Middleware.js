class Middleware {
  _handle ($) {
    let scope = $
    //making chain of middlewares
    let chain = Promise.resolve($)

    this.order.forEach(mw => {
      let middleware = mw

      if (this.catchers.indexOf(middleware) > -1) {
        return chain = chain.catch(err => {
          this[middleware](err, scope)
        })
      }

      return chain = chain.then($ => {
        scope = $
        if ((!$.ended) || (!$.next) || ((typeof $.next === 'string') && ($.next === middleware))) {
          return new Promise((resolve, reject) => {
            return this[middleware]($, resolve, reject)
          })
        }
        return $
      })
    })

    // chain = chain.catch((cunt) => {
    //   console.log(cunt)
    // })

    return chain
  }

  get order() {
    return ['handle']
  }

  get catchers() {
    return []
  }
}

module.exports = Middleware