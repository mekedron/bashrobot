'use strict'

const Telegram = require('telegram-node-bot')
const BaseStorage = Telegram.BaseStorage
const fast = require('fast.js')
const mongoose = require('mongoose')
const Schema = mongoose.Schema

mongoose.Promise = global.Promise

class MongooseStorage extends BaseStorage {

  constructor(options) {
    super()

    options = options || {}

    let chatSchema = new Schema({
      chatId: String,
      type: String,
      keys: [{
        name: String,
        value: Schema.Types.Mixed
      }],
    })

    this.Chat = mongoose.model('Chat', chatSchema)
  }

  /**
   * split key for type and chatid and keyname
   * @param {string} storage
   * @param {string} key
   */
  _formatKey(storage, key) {
    let _1 = key.indexOf('_')
    let _2 = _1 + 1
    return {
      storage: storage,
      type: key.slice(0, _1).toLowerCase(),
      chatId: key.slice(_2, key.indexOf('_', _2)).toLowerCase(),
      key: key.slice(key.indexOf('_', _2) + 1).toLowerCase()
    }
  }

  /**
   * @param {string} storage
   * @param {string} key
   * @returns {Promise<Object>}
   */
  get(storage, key) { 
    let params = this._formatKey(storage, key)
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
    return this.Chat.findOne({
      chatId: params.chatId,
      type: params.type
    })
    .exec()
    .then(chat => {
      if (!chat)
        chat = new this.Chat({
          chatId: params.chatId,
          type: params.type,
          keys: []
        })

      let edited = false
      fast.forEach(chat.keys, el => {
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
    return this.Chat.findOne({
      chatId: params.chatId,
      type: params.type
    })
    .exec()
    .then((chat) => {
      let keyInd = false
      fast.forEach(chat.keys, (el, ind) => {
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