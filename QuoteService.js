const mongoose = require('mongoose')
const Schema = mongoose.Schema
const cheerio = require('cheerio')
const iconv = require('iconv-lite')
const request = require('request')
const he = require('he')

const QuoteSchema = new Schema({ 
  sourceName: String,
  text: {
    type: String,
    trim: true
  },
  viewedBy: [String]
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

    request({
        url: msg.source.url + msg.source.linkpar,
        encoding: 'binary'
      }, (err, res, body) => {
      if (err) 
        return respond(err)

      if (res.statusCode != 200) 
        return respond(new Error('Cannot parse, try few minutes later'))

      body = iconv.decode(new Buffer(body, 'binary'), msg.source.encoding);

      let $ = cheerio.load(body)

      let result = ''
      $(msg.source.parsel).each((i, elem) => {
        elem = $(elem).html().replace(/<(?:.|\n)*?>/gm, '\n')
          .replace(/&apos;/ig, '\'')
          .replace(/\n\n\n/g, '')
        if (i === 0) 
          result = elem
        let quote = new Quote({
          sourceName: msg.source.name,
          text: elem,
          viewedBy: (i === 0) ? [msg.chatId] : []
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

      if (!quote)
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