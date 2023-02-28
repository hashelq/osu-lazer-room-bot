import { Telegraf, Markup } from 'telegraf'

export default class TelegramBot {
  constructor({ token, userId }) {
	this.token = token
	this.userId = userId
	this.bot = new Telegraf(this.token)
  }

  setOsuBot(bot) {
	this.osu = bot
  }

  _notify(message) {
	return this.bot.telegram.sendMessage(this.userId, message)
  }

  handleNewChatMessage({ username, content }) {
	return this._notify(`${username}@ ${content}`)
  }

  handleLog(text) {
	return this._notify(text)
  }

  _bind() {
	this.bot.use(async (ctx, next) => {
	  if (ctx.update.message.from.id === this.userId)
		await next()
	})
	
	this.bot.command("chat", (ctx) => {
	  if (!ctx.update.message)
		return

	  this.osu.sendMessage(`@ ${ctx.update.message.text.slice(6)}`)
	})
	
	this.bot.command("start", _ => {
	  this.osu.startMatch()
	})

	this.bot.command("players", ctx => {
	  const l = Array.from(this.osu.getPlayersSet()).map(element => element.username).join("\n")

	  ctx.reply(`Players:\n${l}`)
	})
  }

  launch() {
	this._bind()
	return this.bot.launch()
  }
}
