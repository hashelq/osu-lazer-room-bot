import {
  LogLevel
} from "@microsoft/signalr"

export default {
  endpoint: "https://osu.ppy.sh",
  multiplayerEndpoint: "https://spectator.ppy.sh/multiplayer",
  defaultHeaders: {
    "User-Agent": "osu!"
  },
  randomMapWorkers: 16,
  mapSearchingTimeout: 60,
  githubSourceUrl: "https://github.com/hashelq/osu-lazer-room-bot",
  defaultMaxLength: 600,
  defaultMap: {
    id: 117379,
    checksum: "5ad7319701409f19fac437b165875964"
  },
  signalRLogLevelsToPino: {
    [LogLevel.Information]: "info",
    [LogLevel.Trace]: "trace",
    [LogLevel.Debug]: "debug",
    [LogLevel.Warning]: "warn",
    [LogLevel.Error]: "error",
    [LogLevel.Critical]: "fatal"
  },

  incompatibleMods: {
    "HR": ["EZ", "MR", "DA"]
  },
  allMods: ['EZ', 'NF', 'HR', 'SD', 'PF', 'HD', 'FL', 'BL', 'ST', 'TP', 'DA', 'CL', 'RD', 'MR', 'AL', 'SG', 'RX', 'AP', 'SO', 'TR', 'WG', 'SI', 'GR', 'DF', 'TC', 'BR', 'AD', 'MU', 'NS', 'MG', 'RP', 'FR']
}
