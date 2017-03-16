const mongoose = require('mongoose')
const Schema = mongoose.Schema
const cheerio = require('cheerio')
const iconv = require('iconv-lite')
const TinyRequest = require('tiny_request')
const he = require('he')

const QuoteSchema = new Schema({ 
  sourceName: String,
  text: {
    type: String,
    trim: true,
    minlength: 10
  },
  votes: [{
    chatId: String,
    value: {
      type: Number,
      min: -1, max: 1,
      get: v => Math.round(v),
      set: v => Math.round(v)
    }
  }],
  viewedBy: [String],
  addedAt : {
    type: Date,
    default: Date.now
  }
})

QuoteSchema.statics.random = function(criteria, callback) {
  this.count(criteria, function(err, count) {
    if (err) {
      return callback(err)
    }
    var rand = Math.floor(Math.random() * count)
    this.findOne(criteria).skip(rand).exec(callback)
  }.bind(this))
}

const Quote = mongoose.model('Quote', QuoteSchema);

module.exports = function quote() {
  this.add('role:quote,cmd:parseAndReturnRandom', function (msg, respond) {
    if (!msg.source || !msg.source.url || !msg.source.linkpar) 
      return respond(new Error('Source config not found'))

    let method = msg.source.method || 'get'
    let url = msg.source.url + msg.source.linkpar

    // TODO: refactor

    new Promise((resolve, reject) => {
      if (msg.source.paginpar && msg.source.paginel) {
        TinyRequest[method]({
          url: msg.source.url + msg.source.paginpar,
          query: msg.source.query || {},
          headers: msg.source.headers || {}
        }, (body, res, err) => {
          if (err) 
            reject(err)

          if (res.statusCode != 200) 
            reject(new Error('Cannot parse, try few minutes later'))

          let $ = cheerio.load(body)
          let page = $($(msg.source.paginel)[0])
          // console.log(page)
          if (msg.source.pageattr) {
            page = page.attr(msg.source.pageattr)
          } else {
            page = page.text()
          }
          page = parseInt(page.replace(/[^0-9]/g, ''))
          resolve(
            url.replace(
              '%d', 
              Math.floor(Math.random() * (page - 1)) + 1
            )
          )
        })
      } else {
        resolve(url)
      }
    })
    .then(url => new Promise((resolve, reject) => {
      // console.log(url)
      TinyRequest[method]({
          url: url,
          query: msg.source.query || {},
          headers: msg.source.headers || {},
          binary: true
        }, (body, res, err) => {
        if (err) 
          reject(err)

        if (res.statusCode != 200) 
          reject(new Error('Cannot parse, try few minutes later'))

        body = iconv.decode(Buffer.from(body, 'binary'), msg.source.encoding);

        let $ = cheerio.load(body)
        let result = false
        let quotesCount = $(msg.source.parsel).length

        $(msg.source.parsel).each((i, elem) => {
          elem = $(elem).html()
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/(p|div)>/gi, '\n\n')
                .replace(/<(?:.|\n)*?>/g, '')
                .replace(/\n\n\n/g, '\n')
          elem = he.decode(elem)
          elem = elem
                .replace(/\&/g, '&amp;')
                .replace(/\</g, '&lt;')
                .replace(/\>/g, '&gt;')
          elem = elem.trim()
                .replace(/\s\s/g, ' ')

          if (elem.length < 15)
            return

          if (!result && ((Math.random() > 0.5) || (i === (quotesCount - 1))))
            result = elem

          let quote = new Quote({
            sourceName: msg.source.name,
            text: elem,
            viewedBy: ((result === elem) && msg.chatId) ? [msg.chatId] : []
          })
          quote.save()
        })

        if (result)
          resolve(
            respond({
              quote: result
            })
          )
        else
          reject(new Error('Nothing found'))
      })
    }))
    .catch(respond)
  })

  this.add('role:quote,cmd:random', function (msg, respond) {
    let criteria = {}
    if (msg.chatId)
      criteria.viewedBy = { 
        '$ne': msg.chatId
      }
    if (msg.source && msg.source.name)
      criteria.sourceName = msg.source.name

    Quote.random(criteria, (err, quote) => {
      if (err)
        return respond(err)

      if (!quote && msg.source)
        return this.act({
          role: 'quote',
          cmd: 'parseAndReturnRandom',
          source: msg.source,
          chatId: msg.chatId
        }, respond)

      if (quote && msg.chatId) {
        quote.viewedBy.push(msg.chatId)
        quote.save()
      }

      respond({
        quote: quote.text
      })
    })
  })
}