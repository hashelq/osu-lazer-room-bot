import {
  Client,
  GatewayIntentBits
} from "discord.js"

export default class DiscordBot {

  osu = null
  logsChannel = null

  constructor({
    token,
    logsChannelId
  }) {
    this.token = token
    this.bot = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    })
    this.logsChannelId = logsChannelId
  }

  setOsuBot(bot) {
    this.osu = bot
  }

  async handleLog(text) {
    await this.logsChannel.send(text)
  }

  async launch() {
    await this.bot.login(this.token)
    this.logsChannel = await this.bot.channels.fetch(this.logsChannelId)
  }
}
