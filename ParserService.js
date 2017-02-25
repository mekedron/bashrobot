const mongoose = require('mongoose')
const Schema = mongoose.Schema

const QuoteSchema = new Schema({ 
  sourceName: String,
  idFromSource: String,
  text: String,
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

modules.exports = function quote() {
  this.add('role:quote,cmd:parseAndReturnRandom', function (msg, respond) {
    if (!msg.source) 
      return respond(new Error('Source config not found'))
    
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
          cmd: 'parseAndGetRandom',
          source: msg.source,
          chatId: msg.chatId
        }, respond)
      if (quote && msg.chatId) {
        quote.viewedBy.push(msg.chatId)
        quote.save()
      }
      respond(quote.text)
    })
  })
}