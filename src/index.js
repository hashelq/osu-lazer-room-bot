import dotenv from 'dotenv'
import pino from "pino"
import Timeout from 'await-timeout';
import StaticProvider from "./static.js"
import OsuClient from "./client.js"
import Helpers from "./helpers.js"
import ApiRequests from "./api-requests.js"
import ModDifficulties from "./mod-difficulties.js"

const throwit = (e) => {
  throw e
}

const getAllowedMods = (requiredMods = []) => {
  let obj = {}
  StaticProvider.allMods.forEach(mod => obj[mod] = true)

  for (const mod of requiredMods) {
	const acronym = mod.acronym
	delete obj[acronym]

	const incompatibleMods = StaticProvider.incompatibleMods[acronym]

	if (incompatibleMods !== undefined)
	  for (const incompatibleMod of incompatibleMods)
		delete obj[incompatibleMod]
  }

  return Object.keys(obj).map(acronym => { return { acronym } })
}

class RoomBot {
  active = true

  knownUsers = {}
  skippingNow = false

  playerStates = {}
  playersReady = 0
  playersSpectate = 0

  playlistItemsCount = 1
  playlist = {}

  wantsToSkip = {}

  maxMapLength = process.env.LENGTH_MAX_SECS ?? StaticProvider.defaultMaxLength

  me = null
  room = null

  constructor({ client, logger, difficultyRange = { min: 3.99, max: 7.99 } }) {
  	this.client = client
	this.logger = logger
	this.difficultyRange = difficultyRange
  }

  async getUserInfo(userID) {
	if (this.knownUsers[userID] !== undefined)
	  return this.knownUsers[userID]
	else
	  return this.knownUsers[userID] = await this.client.apiExecute(ApiRequests.getUser(userID))
  }

  async loadMe() {
  	this.me = await this.client.apiExecute(ApiRequests.me())
  	return this.me
  }

  async pollMessages() {
  	const messages = await this.client.apiExecute(ApiRequests.getMessages({ channelId: this.room.channel_id, since: this.lastMessageId ?? 0 }), false)
	if (messages.length === 0)
	  return

	this.lastMessageId = messages[messages.length - 1].message_id

	for (const message of messages) {
	  if (message.sender_id === this.me.id)
		continue

	  this.getUserInfo(message.sender_id)
		.catch(throwit)
		.then((user) => {
		  this.logger.debug(`Message ${ user.username }: ${ message.content }`)
		  if (message.content.startsWith("!"))
			this.handleCommand(user, message)
		  }) 
	}
  }

  async handleCommand(user, message) {
	if (this.active !== true) return

	const args = message.content.split(" ")
	const command = args.shift().substring(1).toLowerCase()
	
	let handler = this.userCommands[command]

	if (handler === undefined && user.id == process.env.OWNER_ID) {
	  handler = this.adminCommands[command]
	}

	if (handler === undefined) {
	  this.sendMessage(`Unknown command: ${ command }`)
	  return
	}

	await handler.call(this, user, args)
  }

  async sendMessage(message, isAction, retry = false) {
	if (this.room === null)
	  return
	if (!retry)
	  this.logger.info(`Sending message to channel ${ this.room.channel_id }: ${ message }`)
	let msg
	try {
	  msg = await this.client.apiExecute(ApiRequests.sendMessage({
	  	channelId: this.room.channel_id,
	  	message,
	  	isAction
	  }))
	} catch(e) {
	  if (e === "You cannot send messages while silenced, restricted or banned.") {
		throw e
	  }

	  this.logger.debug(`Retrying sending message ${e}`)
	  if (retry)
		throw "Failed to send message: " + e
	  // timeout for 1-5 secs
	  await Timeout.set(Math.floor(Math.random() * 1000 * 4) + 1000)
	  msg = await this.sendMessage(message, isAction, true)
	}
	return msg;
  }

  restartReadyness () {
	for (const key in this.playerStates) {
	  const value = this.playerStates[key]
	  if (value === "Ready")
		this.playerStates[key] = "Idle"
	}

	this.playersReady = 0
	this.wantsToSkip = {}
  }

  async startMatch() {
	if (this.playersReady === 0) return
	this.logger.info("Starting match")
	this.clearStartingTimer()	
	await this.client.invoke("ChangeState", 8)
	await this.client.invoke("StartMatch").catch(e => {
	  this.logger.error("Failed to start match: " + e)
	  return
	})
  }

  clearStartingTimer() {
	this.logger.debug("Clearing starting timer")
	if (this.startingTimer !== undefined) {
	  clearTimeout(this.startingTimer)
	  this.startingTimer = undefined
	}
	this.fastStart = undefined
  }

  setStartingTimer(message, seconds) {
	this.logger.debug(`Setting starting timer for ${ seconds } seconds`)
	this.clearStartingTimer()
	
	this.startingTimer = setTimeout(() => this.startMatch(), seconds * 1000)

	this.sendMessage(message, true).catch(throwit)
  }

  checkStartingAvailability() {
	if (this.active !== true || this.skippingNow) return
	
	this.logger.debug(`Checking starting availability: ${ this.playersReady } ready, ${ this.playersSpectate } spectating, states: ${ JSON.stringify(this.playerStates) }`)
	
	const cancel = () => {
	  this.logger.debug(`Cancelling starting timer.`)
	  this.clearStartingTimer()
	  this.sendMessage("Fast start aborted.", true)
	}

	const needForStart = Object.keys(this.playerStates).length - this.playersSpectate
	const needHalf = Math.round(needForStart / 2)

	if (this.fastStart) {
	  if (this.playersReady !== needForStart)
		cancel()
	} else if (this.playersReady === needForStart && this.playersReady >= 1) {
	  this.setStartingTimer("All players are ready, starting match in 5 seconds!", 5)
	  this.fastStart = true
	  return
	}

	if (this.startingTimer !== undefined) {
	  this.logger.debug(`Checking if we should cancel the starting timer.`)
	  if (this.playersReady < needHalf)
		cancel()
	} else if (this.playersReady >= needHalf && this.playersReady >= 2)
	  this.setStartingTimer(`${ this.playersReady } players are ready, starting match in 30 seconds!`, 30)
  }

  cacheUserState({ userID, state }) {
	if (!this.playerStates[userID]) {
	  this.playerStates[userID] = state
	  return
	}
	let cstate = this.playerStates[userID]
	switch (cstate) {
	  case "Ready":
		this.playersReady--
		break
	  case "Spectating":
		this.playersSpectate--
		break
	}

	if (state !== "None") {
	  switch (state) {
	    case "Ready":
		 this.playersReady++
		 break
	    case "Spectating":
		 this.playersSpectate++
		 break
	  }
	  this.playerStates[userID] = state
	} else
	  delete this.playerStates[userID]

	this.checkStartingAvailability()
  }

  async addRandomMap({ orDefault, onlyIfNeed } = { orDefault: null, onlyIfNeed: true }) {
	let map = await this.getRandomMap({ onlyIfNeed })

	if (!map) {
	  if (orDefault === null) {
		return this.sendMessage("Seems like this case does not include a default map for some reason. It will spam a lot. Please ping zerodesu.")
	  }
	  map = orDefault
	  this.sendMessage("Could not find a map, enjoy the default map.").catch(throwit)
	}
	
	await this.client.invoke("AddPlaylistItem", {
	  beatmapID: map.id,
	  rulesetID: 0,
	  beatmapChecksum: map.checksum,
	  allowedMods: getAllowedMods()
	})
  }

  async getRandomMap({ onlyIfNeed } = { onlyIfNeed: true}) {
	this.logger.info("Trying to find a random map")

	const startedWhen = Date.now()

	let resolved = false
	return new Promise((resolve, _) => {
	  const doFind = async () => {
		if (Date.now() - startedWhen > StaticProvider.mapSearchingTimeout * 1000 && !resolved) {
		  resolve(null)
		  resolved = true

		  this.logger.error("Failed to find a map: TooLong")
		  this.sendMessage("Sorry, it takes too long to find a map. Probably because of diffs.").catch(throwit)
		}

	  	if (onlyIfNeed && onlyIfNeed === true && this.playlistItemsCount !== 0)
	  	  return

		if (resolved) return resolve(null)

	  	const id = Math.floor(Math.random() * 3787482)

	  	let bmap
	  	try {
	  	  bmap = await this.client.apiExecute(ApiRequests.lookupBeatmap(id), false)
	  	} catch (_) {
	  	  return await doFind()
	  	}
	  	if (["ranked", "loved", "approved"].includes(bmap.status) === false || bmap.mode != "osu")
	  	  return await doFind()

	  	const difficulty = bmap.difficulty_rating
	  	
	  	if (difficulty < this.difficultyRange.min || difficulty > this.difficultyRange.max || this.maxMapLength < this.total_length) {
	  	  return await doFind()
	  	}

	  	this.logger.info(`Found map ${ id }`)

		if (!resolved) {
		  resolved = true
		  resolve({ id, checksum: bmap.checksum })
		}
	  }

	  for (let i = 0; i < StaticProvider.randomMapWorkers; i++) {
	  	doFind()
	  }
	})
  }

  async skipCurrentMap() {
	this.logger.info("Skipping the current map.")
	this.skippingNow = true
	if (Object.keys(this.playlist).length === 1) {
	  await this.addRandomMap({ orDefault: StaticProvider.defaultMap, onlyIfNeed: false })
	}
	// FIXME: playlistOrder === 0
	// Somehow you need to find out why playlistOrder is not 0
	let first = null
	let min = null
	for (const id in this.playlist) {
	  const obj = this.playlist[id]
	  if (min === null || min > obj.playlistOrder) {
		min = obj.playlistOrder
		first = obj
	  }
	}
	if (first) {
	  this.client.invoke("RemovePlaylistItem", first.id).catch(e => {
		throw `Cannot remove the current playlist item while there is another next (or no?): ${e}`
	  })
	  delete this.playlist[first.id]
	} else {
	  this.logger.fatal(`FIRST MAP NOT FOUND! ${Helpers.toJSON(this.playlist)}`)
	}

	this.playersReady = 0
	this.skippingNow = false
	this.restartReadyness()
  }

  async checkIfSkip() {
	const needForStart = Object.keys(this.playerStates).length - this.playersSpectate
	if (Object.keys(this.wantsToSkip).length >= needForStart / 2 && !this.skippingNow) {
	  this.sendMessage("Most players voted to skip the current map, skipping...")
	  this.skipCurrentMap()
	  this.clearStartingTimer()
	  return true
	} else {
	  return false
	}
  }

  async checkIfWeNeedARandomMap() {
	if (this.active !== true) return
	this.logger.debug(`Checking if we need a random map, ${ this.playlistItemsCount } items in playlist.`)
	
	if (this.playlistItemsCount == 0)
	  this.addRandomMap({orDefault: StaticProvider.defaultMap})
  }

  async start() { 
	// Token obtaining
	await this.client.obtainToken()
  
	this.logger.info("Token obtained")
	// Load user info
  	await this.loadMe().catch(throwit).then(() => {
  	  this.logger.info(`User loaded, username: ${ this.me.username }`)
  	})

	// Connect to the server
	await this.client.connectToMultiplayerServer()

	this.logger.info("Connected to the server")
  
	// Create a room
	let roomName = `auto ${ this.difficultyRange.min }- ${ this.difficultyRange.max }* !help`
	let roomPassword = ""

	if (process.env.DEVELOPMENT && process.env.DEVELOPMENT === "true") {
	  roomName = process.env.DEVELOPMENT_ROOM_NAME
	  roomPassword = process.env.DEVELOPMENT_ROOM_PASSWORD
	}

	const map = await this.getRandomMap({ orDefault: StaticProvider.defaultMap, onlyIfNeed: false })

	if (!map) {
	  throw "Could not find a map for start"
	}

	const id = map.id

	const item = {
      beatmap_id: id,
  	  ruleset_id: 0,
	  allowed_mods: getAllowedMods(),
	  playlistOrder: 0
  	}

  	this.room = await this.client.apiExecute(ApiRequests.createRoom({
  	  name: roomName,
  	  password: roomPassword,
  	  queue_mode: "all_players_round_robin",
  	  auto_skip: true,
  	  playlist: [
  	    item
  	  ]
  	}))

	this.room.playlist[0].playlistOrder = 0
	this.playlist = { [this.room.playlist[0].id]: this.room.playlist[0] }

	// Server restart?
	this.client.connection.onclose(async () => {
	  await this.client.connectToMultiplayerServer()
	  await this.client.joinRoomWithPassword(this.room.id, roomPassword)
	})
  
	this.logger.info(`Room created, id: ${ this.room.id }`)
  	
	// Join the room
	await this.client.joinRoomWithPassword(this.room.id, roomPassword)

	this.logger.info(`Room joined`)	

	const serverHadlers = {
  	  UserJoined: async ({ userID }) => {
		const user = await this.getUserInfo(userID)
  	    this.logger.info(`User joined: ${ user.username }`)
		this.cacheUserState({ userID, state: "Idle" })
		this.sendMessage(`+${ user.username }`)
  	  },
  	  
  	  UserLeft: async ({ userID }) => {
		const user = await this.getUserInfo(userID)
  	    this.logger.info(`User left: ${ user.username }`)
		this.cacheUserState({ userID, state: "None" })

		const keys = Object.keys(this.wantsToSkip)
	  	if (keys.includes(user.id)) {
	  	  delete this.wantsToSkip[user.id]
	  	  this.checkIfSkip()
	  	}
  	  },

	  LoadRequested: () => {},
	  
	  GameplayStarted: () => {},
	  
	  LoadAborted: () => {},

	  ResultsReady: () => {},

	  UserModsChanged: () => {},

	  MatchRoomStateChanged: () => {},

	  MatchUserStateChanged: () => {},

	  MatchEvent: () => {},

  	  PlaylistItemAdded: (item) => {
  	    this.logger.info(`Playlist item added: ${ Helpers.toJSON(item) }`)

		this.playlist[item.id] = item

		this.playlistItemsCount++
  	  },

  	  PlaylistItemRemoved: (item) => {
  	    this.logger.info(`Playlist item removed: ${ Helpers.toJSON(item) }`)

		delete this.playlist[item.id]

		this.playlistItemsCount--
		this.checkIfWeNeedARandomMap()
  	  },

  	  PlaylistItemChanged: async (item) => {
  	    this.logger.info(`Playlist item changed: ${ Helpers.toJSON(item) }`)
		if (item.playlistOrder != 65535)
		  this.playlist[item.id] = item

		if (item.playedAt !== null)
		  return delete this.playlist[item.id]
		
		if (this.active !== true) return
		if (item.ownerID === this.me.id)
		  return

		const user = await this.getUserInfo(item.ownerID)
		
		// Check required mods and diff
		const map = await this.client.apiExecute(ApiRequests.lookupBeatmap(item.beatmapID))
		const mods = item.requiredMods
		let stars = map.difficulty_rating

		const replaceWithARandomMap = async (e) => {
		  this.logger.error(`Failed to revome item: ${e} ${ Helpers.toJSON(e) }`)
		  this.sendMessage(`${ user.username }, please don't violate restrictions. Type !violation for more info.`).catch(throwit)
		  this.sendMessage("Guys, please wait a bit. I gotta find an alternative for the current map.")

		  const map = await this.getRandomMap({ onlyIfNeed: false })

		  if (map === null)
			return

		  const newitem = { ...item, beatmapID: map.id, beatmapChecksum: map.checksum, allowedMods: getAllowedMods(mods), rulesetID: 0 }

		  await this.client.invoke("EditPlaylistItem", newitem).catch((err) => {
			this.logger.error(err)
		  })
		  this.playlist[item.id] = newitem
		}

		const removeItem = (message) => {
		  this.sendMessage(`Sorry, ${user.username}, but ${message}`).catch(throwit)
		  this.client.invoke("RemovePlaylistItem", item.id).catch(replaceWithARandomMap)
		  delete this.playlist[item.id]
		  return
		}

		if (map.total_length > this.maxMapLength) {
		  return removeItem("Your map is too long. Max length is " + Helpers.fmtMSS(this.maxMapLength) + "")
		}

		for (const mod of mods) {
		  const acronym = mod.acronym
		  const mixin = ModDifficulties[acronym]
		  if (mixin)
			stars = mixin(stars, mod.settings)
		  else
			return removeItem(`${ acronym } is not allowed. Check the list of allowed mods by typing !mods.`)
		}

		if (stars < this.difficultyRange.min || stars > this.difficultyRange.max)
		  return removeItem(`the beatmap (that is ${ stars.toFixed(2) }* hard) is not in range of availabile difficulties. Check !diffs`)

		// Check if not all mods are allowed
		const allowedMods = item.allowedMods
		let hasAll = true
  		for (const mod of StaticProvider.allMods) {
  		  if (!allowedMods.map(e => e.acronym).includes(mod)) {
  		    hasAll = false
  		    break 
  		  }
  		}

		if (!hasAll) {
  		  item.allowedMods = getAllowedMods(mods)
  		  await this.client.invoke("EditPlaylistItem", item).catch((err) => {
			this.logger.error(err)
		  })
  		}
	  },

  	  HostChanged: (userID) => {
  	    this.logger.info(`Host changed: ${ Helpers.toJSON(userID) }`)

		if (userID === this.me.id) {
		  this.active = true
		  this.logger.info(`I am the host now!`)
		  
		  this.sendMessage("I am the host now").catch(throwit)
		}
  	  },

	  UserBeatmapAvailabilityChanged: () => {},
	  
	  SettingsChanged: () => {},

  	  UserStateChanged: (userID, stateRaw) => {
		if (userID == this.me.id)
		  return

		const state = {0: "Idle", 1: "Ready", 8: "Spectating"}[stateRaw]
		if (state === undefined)
		  return // probably "ingame" or something... we don't care about that

		  this.logger.info(`User state changed: ${ userID }, ${ state }`)
		  this.cacheUserState({ userID, state: state })
	  },

	  RoomStateChanged: (state) => {
  	    this.logger.info(`Room state changed: ${ Helpers.toJSON(state) }`)

		if (state === 1) {
		  this.sendMessage("Match started!", true) 
		  
		  this.restartReadyness()
		}

		if (state === 2) {
		  this.playlistItemsCount--
		  this.checkIfWeNeedARandomMap()
		}
  	  }
  	}
  	
  	// Called when a user is kicked from the room.
  	serverHadlers.UserKicked = serverHadlers.UserLeft
  	
  	this.client.setServerHandlers(serverHadlers)

	this.messagePollingIntreval = setInterval(() => {
	  this.pollMessages()
	}, 1000)
  }

  userCommands = {
	"help": async _ => {
	  let message = "Available commands: "
	  for (let command in this.userCommands)
	    message += `!${ command }, `
	  message = message.slice(0, -2)
	  this.sendMessage(message)
	},
	"roll": (user, args) => {
	  let min = args[0] ? parseInt(args[0]) || 0 : 0
	  let max = args[1] ? parseInt(args[1]) || 100 : 100
	  if (min != 0 && max == 100) {
		max = min
		min = 0
	  }

	  if (min < 0)
		min = 0

	  if (max <= min) {
		return this.sendMessage("Invalid arguments. Usage: !roll <min> <max>   -OR-   !roll <max>")
	  }

	  let num = Math.floor(Math.random() * (max-min+1)) + min

	  return this.sendMessage(`${user.username} rolls ${num} point(s).`)
	},
	"skip": async user => {
	  if (this.skippingNow)
		return

	  const needForStart = Object.keys(this.playerStates).length - this.playersSpectate
	  const keys = Object.keys(this.wantsToSkip)
	  const voted = keys.length
	  if (!keys.includes(user.id)) {
		this.wantsToSkip[user.id] = true
		const more = needForStart / 2 - voted - 1
		if (await this.checkIfSkip() === false) {
		  this.sendMessage(`${user.username} wants to skip the current map. Type !skip to vote. Need ${Math.ceil(more)} more players.`).catch(throwit)
		}
	  }
	},
	"diffs": async _ => {
	  await this.sendMessage(`Difficulty range is ${ this.difficultyRange.min } - ${ this.difficultyRange.max }*`)
	},
	"max-length": async _ => {
	  await this.sendMessage(`Max map length is ${ Helpers.fmtMSS(this.maxMapLength) }`)
	},
	"source": async _ => {
	  await this.sendMessage(StaticProvider.githubSourceUrl)
	},
	"discord": async _ => {
	  await this.sendMessage(process.env.DISCORD_LINK ?? "Owner has not set a discord link")
	},
	"mods": async _ => {
	  let message = "Available mods: "
	  for (let mod of StaticProvider.allMods)
	    message += `${ mod }, `
	  message = message.slice(0, -2)
	  await this.sendMessage(message)
	},
	"violation": _ => {
	  return this.sendMessage("When you add a map that you should not (wrong diff, mods, length) and there are no other maps, the bot cannot delete it, so it violates restrictions.")
	}
  }

  adminCommands = {
	"start": async _ => {
	  await this.startMatch()
	},

	"host": async user => {
	  await this.client.invoke("TransferHost", user.id)
	  this.active = false

	  this.sendMessage(`Host transferred to ${ user.username }`).catch(throwit)
	},

	"set-max-length": async (_, args) => {
	  const usage = () => {
		return this.sendMessage("Invalid arguments. Usage: !set-max-length <M:SS>")
	  }
	  if (args.length != 1)
		return await usage()

	  const time = args[0].split(":")
	  if (time.length != 2)
		return await usage()
	  const mins = parseInt(time[0])
	  const secs = parseInt(time[1])

	  if (isNaN(mins) || isNaN(secs) || secs > 60 || secs < 0 || mins < 0)
		return await usage()

	  this.maxMapLength = mins*60 + secs

	  this.sendMessage(`Max map length is set to ${ Helpers.fmtMSS(this.maxMapLength) }`)
	},

	"setdiff": async (_, args) => {
	  if (args.length != 2)
	    return await this.sendMessage("Invalid arguments. Usage: !setdiff <min> <max>")

	  const min = parseFloat(args[0])
	  const max = parseFloat(args[1])

	  if (isNaN(min) || isNaN(max))
	    return await this.sendMessage("Invalid arguments. Usage: !setdiff <min> <max>")

	  this.difficultyRange = { min, max }
	  await this.sendMessage(`Difficulty range set to ${ min } - ${ max }*`)
	}
  }
}


const start = async (logger) => {
  const logindata = { username: process.env.USERNAME, password: process.env.PASSWORD }
  // Api instance creation
  let client = new OsuClient({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    logger,
	...logindata
  }) 

  // Bot instance creation
  const bot = new RoomBot({client, logger, difficultyRange: { min: process.env.DIFFICULTY_MIN, max: process.env.DIFFICULTY_MAX }})
  await bot.start()
}

// Initialization
dotenv.config()
const logger = pino({ level: process.env.LOG_LEVEL || 'debug' })

// run
await start(logger).catch((e) => {
  logger.fatal(e)
  logger.fatal("Server crashed")
  process.exit(-1)
})
