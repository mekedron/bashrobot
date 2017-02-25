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
  storage: new MongooseStorage()
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

// TODO: refactor before method

class QuoteController extends TelegramBaseController {
  constructor(config) {
    super()

    this.source = config.source || {}
    this.sources = config.sources || [[{}]]
  }

  before($) {
    $[$.idFromGroupChat ? 'setChatSession' : 'setUserSession']('lastActivity', Date.now())
    return $
  }

  randomQuoteForUserHandler($) {
    seneca
    .act({
      role: 'quote',
      cmd: 'random',
      chatId: $.chatId,
      source: this.source
    }, (err, res) => {
      $.sendMessage(res.quote || 'Whoops, something went wrong.', {
        parse_mode: 'html',
        disable_web_page_preview: true,
        reply_to_message_id: $.idFromGroupChat ? $.message.messageId : ''
      })
    })
  }

  randomQuoteHandler($) {
    let randomSourceInd = Math.floor(Math.random() * this.sources.length)
    let randomVariatInd = Math.floor(Math.random() * this.sources[randomSourceInd].length)
    seneca
    .act({
      role: 'quote',
      cmd: 'random',
      chatId: $.chatId,
      source: this.sources[randomSourceInd][randomVariatInd]
    }, (err, res) => {
      $.sendMessage(
        res.quote || 'Whoops, something went wrong. Data: ' + randomSourceInd + ', ' + randomVariatInd, 
        {
          parse_mode: 'html',
          disable_web_page_preview: true,
          reply_to_message_id: $.idFromGroupChat ? $.message.messageId : ''
        }
      )
    })
  }

  get routes() {
    return {
      'randomQuoteForUserCommand': 'randomQuoteForUserHandler',
      'randomQuoteCommand': 'randomQuoteHandler'
    }
  }
}

class StartController extends TelegramBaseController {
  before($) {
    $[$.idFromGroupChat ? 'setChatSession' : 'setUserSession']('lastActivity', Date.now())
    return $
  }

  startHandler($) {
    $.sendMessage('Добро пожаловать!\n\nЧтобы посмотреть все команды, нажми /help')
  }

  get routes() {
      return {
        'startCommand': 'startHandler'
      }
  }
}

class HelpController extends TelegramBaseController {
  constructor(additionalCommands) {
    super()

    this.additionalCommands = additionalCommands || ''
  }

  before($) {
    $[$.idFromGroupChat ? 'setChatSession' : 'setUserSession']('lastActivity', Date.now())
    return $
  }

  helpHandler($) {
    $.sendMessage(
      'Список команд:\n'
      + '/help - Помощь\n'
      + '/random - Случайная цитата\n'
      + '\nКоманды ниже отдают случайную цитату:\n'
      + this.additionalCommands
      + '\n\nIf you want to contribute, check out bot\'s github page:\nhttp://github.com/bitrixhater/bashrobot',
      {
        disable_web_page_preview: true,
        reply_to_message_id: $.idFromGroupChat ? $.message.messageId : ''
      }
    )
  }

  get routes() {
    return {
      'helpCommand': 'helpHandler'
    }
  }
}

class OtherwiseController extends TelegramBaseController {
  before($) {
    $[$.idFromGroupChat ? 'setChatSession' : 'setUserSession']('lastActivity', Date.now())
    return $
  }

  handle($) {
    $.sendMessage('Воспользуйтесь командой /help для просмотра списка возможных команд')
  }
}

var router = tg.router

fast.forEach(sources, variations => {
  fast.forEach(variations, source => {
    router = router.when(
      new TextCommand(
        source.name.replace(/\s/g, ' ').toLowerCase(),
        'randomQuoteForUserCommand'
      ),
      new QuoteController({
        source: source
      })
    )
  })
})

router = router
  .when(
    new TextCommand('random', 'randomQuoteCommand'),
    new QuoteController({
      sources: sources
    })
  )
  .when(
    new TextCommand('start', 'startCommand'),
    new StartController()
  )
  .when(
    new TextCommand('help', 'helpCommand'),
    new HelpController(fast.map(sources, variations => {
      return fast.map(variations, source => {
        return '/' + source.name.replace(/\s/g, ' ').toLowerCase()
             + ' - ' + source.desc
      }).join('\n')
    }).join('\n'))
  )
  .otherwise(
    new OtherwiseController()
  )