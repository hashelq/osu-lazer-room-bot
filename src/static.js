import { LogLevel } from "@microsoft/signalr"

export default {
  endpoint: "https://osu.ppy.sh",
  multiplayerEndpoint: "https://spectator.ppy.sh/multiplayer",
  defaultHeaders: { "User-Agent": "osu!" },
  randomMapWorkers: 8,
  mapSearchingTimeout: 60,
  githubSourceUrl: "https://github.com/hashelq/osu-lazer-room-bot",
  signalRLogLeversToPino: {
	[LogLevel.Information]: "info",
	[LogLevel.Trace]: "trace",
	[LogLevel.Debug]: "debug",
	[LogLevel.Warning]: "warn",
	[LogLevel.Error]: "error",
	[LogLevel.Critical]: "fatal"
  },

  allMods: ['EZ','NF','HR','SD','PF','HD','FL','BL','ST','TP','DA','CL','RD','MR','AL','SG','RX','AP','SO','TR','WG','SI','GR','DF','TC','BR','AD','MU','NS','MG','RP']
}
