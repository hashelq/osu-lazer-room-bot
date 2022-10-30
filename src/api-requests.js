import Helpers from "./helpers.js"

export default {
  me: () => {
	return {
	  endpoint: "me",
	  method: "GET",
	  data: null
	}
  },

  lookupBeatmap: (beatmapId) => {
	return {
	  endpoint: `beatmaps/lookup?id=` + beatmapId,
	  method: "GET",
	  data: null
	}
  },

  getBeatmapAttributes: (id) => {
	return {
	  endpoint: `beatmaps/${id}/attributes`,
	  method: "POST",
	  data: Helpers.toJSON({ ruleset: "osu" })
	}
  },

  getUser: (userId) => {
	return {
	  endpoint: `users/${userId}`,
	  method: "GET",
	  data: null
	}
  },

  getMessages: ({ channelId, since }) => {
	return {
	  endpoint: `chat/channels/${channelId}/messages?since=` + since,
	  method: "GET",
	  data: null
	}
  },

  sendMessage: ({ channelId, message, isAction = false }) => {
	return {
	  endpoint: `chat/channels/${channelId}/messages`,
	  method: "POST",
	  data: Helpers.toJSON({
		message,
		is_action: isAction
	  })
	}
  },

  createRoom: (data) => {
	return { endpoint: "rooms", method: "POST", data: Helpers.toJSON({
		password: "",
	  	ends_at: null,
	  	channel_id: 0,
	  	duration: null,
	  	queue_mode: "host_only",
	  	type: "head_to_head",
	  	category: "normal",
	  	auto_skip: false,
	  	...data
	  })
	}
  }
}
