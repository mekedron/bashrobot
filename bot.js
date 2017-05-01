'use strict'

const cluster = require('cluster')
const fs = require('fs')

const Telegram = require('telegram-node-bot')
const TinyRequest = require('tiny_request')
const TelegramBaseController = Telegram.TelegramBaseController
const TextCommand = Telegram.TextCommand
const BaseScopeExtension = Telegram.BaseScopeExtension
const MongooseStorage = require('./extensions/storages/MongooseStorage')

const Middleware = require('./extensions/middlewares/Middleware')
const MiddlewareBaseController = require('./extensions/middlewares/MiddlewareBaseController')

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
  .use('QuoteServices')
  .listen()
} else if (cluster.isWorker) {
  seneca
  .client()
}

// TODO: add jsdoc

class UpdateLastActivityMW extends Middleware {
  updateLastActivity($, resolve, reject) {
    let set = $.idFromGroupChat ? 'setChatSession' : 'setUserSession';
    let get = $.idFromGroupChat ? 'getChatSession' : 'getUserSession';

    $[get]('totalRequests')
    .then(totalRequests => {
      if (!totalRequests)
        return $[set]('totalRequests', 1)
      return $[set]('totalRequests', ++totalRequests)
    })
    .then(() => $[set]('lastActivity', Date.now()))
    .then(() => resolve($))
  }

  get order() {
    return ['updateLastActivity']
  }
}

class DoNotHandleOldMessages extends Middleware {
  doNotHandleOldMessages($, resolve, reject) {
    let difference = $.message.date - Math.floor(Date.now() / 1000);
    if (difference >= -30 && difference <= -5) {
      return reject('Almost new')
    } else if (difference < -30) {
      return reject('Old')
    }
    return resolve($)
  }

  get order() {
    return ['doNotHandleOldMessages']
  }
}

// TODO: refactor this trash

class QuoteController extends MiddlewareBaseController {
  constructor(config) {
    super()

    this.source = config.source || {}
    this.sources = config.sources || [[{}]]
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
        reply_markup: JSON.stringify({
          ForceReply: {
            force_reply: true,
            selective: true
          }
        }),
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
          reply_markup: JSON.stringify({
            ForceReply: {
              force_reply: true,
              selective: true
            }
          }),
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

class StartController extends MiddlewareBaseController {
  startHandler($) {
    $.sendMessage('Добро пожаловать!\n\nЧтобы посмотреть все команды, нажми /help')
  }

  get routes() {
      return {
        'startCommand': 'startHandler'
      }
  }
}

class HelpController extends MiddlewareBaseController {
  constructor(additionalCommands) {
    super()

    this.additionalCommands = additionalCommands || ''
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
        reply_markup: JSON.stringify({
          ForceReply: {
            force_reply: true,
            selective: true
          }
        }),
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

class OtherwiseController extends MiddlewareBaseController {
  handle($) {
    if (!$.idFromGroupChat)
      $.sendMessage('Воспользуйтесь командой /help для просмотра списка возможных команд', {
        reply_markup: JSON.stringify({
          ForceReply: {
            force_reply: true,
            selective: true
          }
        })
      })
  }
}

let router = tg.router
let updateLastActivityMW = new UpdateLastActivityMW()
let doNotHandleOldMessages = new DoNotHandleOldMessages()

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
      .middleware(updateLastActivityMW)
      .middleware(doNotHandleOldMessages)
    )
  })
})

router = router
  .when(
    new TextCommand('random', 'randomQuoteCommand'),
    new QuoteController({
      sources: sources
    })
    .middleware(updateLastActivityMW)
    .middleware(doNotHandleOldMessages)
  )
  .when(
    new TextCommand('start', 'startCommand'),
    new StartController()
    .middleware(updateLastActivityMW)
    .middleware(doNotHandleOldMessages)
  )
  .when(
    new TextCommand('help', 'helpCommand'),
    new HelpController(fast.map(sources, variations => {
      return fast.map(variations, source => {
        return '/' + source.name.replace(/\s/g, ' ').toLowerCase()
             + ' - ' + source.desc
      }).join('\n')
    }).join('\n'))
    .middleware(updateLastActivityMW)
    .middleware(doNotHandleOldMessages)
  )
  .otherwise(
    new OtherwiseController()
    .middleware(updateLastActivityMW)
    .middleware(doNotHandleOldMessages)
  )