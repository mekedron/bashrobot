'use strict'

const cluster = require('cluster')
const fs = require('fs')

const Telegram = require('telegram-node-bot')
const TinyRequest = require('tiny_request')
const TelegramBaseController = Telegram.TelegramBaseController
const TextCommand = Telegram.TextCommand
const BaseScopeExtension = Telegram.BaseScopeExtension
const MongooseStorage = require('./MongooseStorage')

const fast = require('fast.js')
const mongoose = require('mongoose')

const seneca = require('seneca')()

const sources = require('./sources')
const config = require('./config')

const tg = new Telegram.Telegram(require('./token').token, {
  webAdmin: {
    port: 3011,
    host: 'localhost'
  },
  //storage: new MongooseStorage()
})

if (cluster.isMaster) {
  mongoose.connect('mongodb://localhost/bashrobot')
  seneca
  .use('QuoteService')
  .listen()
} else if (cluster.isWorker) {
  seneca
  .client()
}

class QuoteController extends TelegramBaseController {
  constructor(config) {
    super()

    this.config = config
  }

  randomQuoteHandler($) {
    seneca
    .act({
      role: 'quote',
      cmd: 'random',
      chatId: $.chatId,
      source: this.config
    }, (err, res) => {
      $.sendMessage(res.quote, {
        parse_mode: 'html'
      })
    })
  }

  get routes() {
    return {
      'randomQuoteCommand': 'randomQuoteHandler'
    }
  }
}

class StartController extends TelegramBaseController {
  startHandler($) {
    $.sendMessage('Добро пожаловать!\n\nЧтобы посмотреть все комманды, нажми /help')
  }

  get routes() {
      return {
        'startCommand': 'startHandler'
      }
  }
}

class HelpController extends TelegramBaseController {
  helpHandler($) {
    $.sendMessage('Список комманд:\n'
      + '/help - Помощь\n'
      + '\nКомманды ниже отдают случайную цитату:\n'
      + '/bash\n'
      + '/ithappens\n'
      + '/zadolbali\n'
      + '/anecdote\n'
      + '/story\n'
      + '/aphorism\n'
      + '/poem\n'
      + '/deti\n'
      + '/xkcdb\n'
      )
  }

  get routes() {
    return {
      'helpCommand': 'helpHandler'
    }
  }
}

class OtherwiseController extends TelegramBaseController {
  handle($) {
    $.sendMessage('Команда не найдена!')
  }
}

var router = tg.router

fast.forEach(sources, variations => {
  fast.forEach(variations, source => {
    router = router.when(
      new TextCommand(
        source.name.replace(/\s/g, ' ').toLowerCase(),
        'randomQuoteCommand'
      ),
      new QuoteController(source)
    )
  })
})

router = router
  .when(
    new TextCommand('start', 'startCommand'),
    new StartController()
  )
  .when(
    new TextCommand('help', 'helpCommand'),
    new HelpController()
  )
  .otherwise(
    new OtherwiseController()
  )