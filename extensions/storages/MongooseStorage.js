'use strict'

const Telegram = require('telegram-node-bot')
const BaseStorage = Telegram.BaseStorage
const mongoose = require('mongoose')
const Schema = mongoose.Schema

mongoose.Promise = global.Promise

class MongooseStorage extends BaseStorage {

  static get BotStorageSchema() {
    return new Schema({
      chatId: String,
      type: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      keys: [{
        name: String,
        value: Schema.Types.Mixed
      }],
    })
  }

  constructor(options) {
    super()

    options = options || {}
    let modelName = options.modelName || 'chats'

    this.BotStorage = mongoose.model(modelName, this.constructor.BotStorageSchema)
  }

  /**
   * split key for type and chatid and keyname
   * @param {string} storage
   * @param {string} key
   */
  _formatKey(storage, key) {
    let splittedKey = key.split('_', 3)
    return {
      storage: storage,
      type: splittedKey[0].toLowerCase(),
      chatId: splittedKey[1].toLowerCase(),
      key: splittedKey[2].toLowerCase()
    }
  }

  /**
   * @param {string} storage
   * @param {string} key
   * @returns {Promise<Object>}
   */
  get(storage, key) { 
    let params = this._formatKey(storage, key)
    return this.BotStorage.findOne({
      chatId: params.chatId,
      type: params.type,
      'keys.name': params.key
    })
    .exec()
    .then(chat => new Promise((resolve, reject) => {
      if (chat)
        resolve(chat.keys.filter(key => key.name == params.key)[0].value)
      else
        resolve(false)
    }))
  }

  /**
   * @param {string} storage
   * @param {string} key
   * @param {Object} data
   * @returns {Promise<>}
   */
  set(storage, key, data) {
    let params = this._formatKey(storage, key)
    return this.BotStorage.findOne({
      chatId: params.chatId,
      type: params.type
    })
    .exec()
    .then(chat => {
      if (!chat)
        chat = new this.BotStorage({
          chatId: params.chatId,
          type: params.type,
          keys: []
        })

      let edited = false
      chat.keys.forEach(el => {
        if (el.name == params.key){
          el.value = data
          edited = true
        }
      })

      if (!edited)
        chat.keys.push({
          name: params.key,
          value: data
        })

      return chat.save()
    })
  }

  /**
   * @param {string} storage
   * @param {string} key
   * @returns {Promise<>}
   */
  remove(storage, key) { 
    let params = this._formatKey(storage, key)
    return this.BotStorage.findOne({
      chatId: params.chatId,
      type: params.type
    })
    .exec()
    .then((chat) => {
      let keyInd = false
      chat.keys.forEach((el, ind) => {
        if (el.name == params.name) {
          keyInd = ind
          return
        }
      })
      let removed = chat.keys.splice(keyInd, 1)
      return chat.save()
    })
  }
}

module.exports = MongooseStorage