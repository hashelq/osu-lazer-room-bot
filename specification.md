# Protocol
OSU lazer uses Rest for different sort of operations and Micro$oft SignalR for instant interactions.

I don't know why the hell in the world someone decided to load messages by longpolling the rest.

If you wonder how to load them, you know now.

OSU HTTP Rest is opensource and can be found [here](https://github.com/ppy/osu-web).

OSU Multiplayer server (signalR) is proprietary and to reverse it, you need to go through the source code of official lazer client [source code](https://github.com/ppy/osu)

Also.. Afaik.

**If for some reason you want to know how to write code for bancho, just DOWNLOAD any MITMPROXY server.**

Afaik, bancho DOES NOT support encryption and can be easily hijacked.

# Signals and Methods
Signals ([source](https://github.com/ppy/osu/blob/1262c44dfbff3de4bbabaf4d6603b83814e7860d/osu.Game/Online/Multiplayer/OnlineMultiplayerClient.cs#L49)):
* RoomStateChanged
* UserJoined
* UserLeft
* UserKicked
* HostChanged
* SettingsChanged
* UserStateChanged
* LoadRequested
* GameplayStarted
* LoadAborted
* ResultsReady
* UserModsChanged
* UserBeatmapAvailabilityChanged
* MatchRoomStateChanged
* MatchUserStateChanged
* MatchEvent
* PlaylistItemAdded
* PlaylistItemRemoved
* PlaylistItemChanged

Methods ([source](https://github.com/ppy/osu/blob/1262c44dfbff3de4bbabaf4d6603b83814e7860d/osu.Game/Online/Multiplayer/OnlineMultiplayerClient.cs)):
* JoinRoom(long roomId, string? password = null)
* LeaveRoom(void)
* TransferHost(int userId)
* KickUser(int userId)
* ChangeSettings(MultiplayerRoomSettings settings)
* ChangeState(MultiplayerUserState newState)
* ChangeBeatmapAvailability(BeatmapAvailability newBeatmapAvailability)
* ChangeUserMods(Vector<APIMod> newMods)
* SendMatchRequest(MatchUserRequest request)
* StartMatch()
* AbortGameplay()
* AddPlaylistItem(MultiplayerPlaylistItem item)
* EditPlaylistItem(MultiplayerPlaylistItem item)
* RemovePlaylistItem(long playlistItemId)
