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
    trim: true
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
    if (!msg.source) 
      return respond(new Error('Source config not found'))

    let method = msg.source.method || 'get'
    let query = msg.source.query || {}

    TinyRequest[method]({
        url: msg.source.url + msg.source.linkpar,
        query: query,
        binary: true,
        headers: msg.source.headers || {}
      }, (body, res, err) => {
      if (err) 
        return respond(err)

      if (res.statusCode != 200) 
        return respond(new Error('Cannot parse, try few minutes later'))

      body = iconv.decode(Buffer.from(body, 'binary'), msg.source.encoding);

      let $ = cheerio.load(body)

      let result = ''
      let randomInd = Math.floor(Math.random() * $(msg.source.parsel).length)
      $(msg.source.parsel).each((i, elem) => {
        // elem = $(elem).html().replace(/<(?:.|\n)*?>/gm, '\n')
        //   .replace(/&apos;/ig, '\'')
        //   .replace(/\n\n\n/g, '')
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

        if (elem.length < 10) return;

        if (i === randomInd) 
          result = elem
        let quote = new Quote({
          sourceName: msg.source.name,
          text: elem,
          viewedBy: ((i === randomInd) && msg.chatId) ? [msg.chatId] : []
        })
        quote.save()
      })

      respond({
        quote: result
      })
    })
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