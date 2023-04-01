import signalR from "@microsoft/signalr"
import uuid4 from "uuid4"
import fetch from "node-fetch"

import StaticProvider from "./static.js"
import Helpers from "./helpers.js"

export default class Api {
  // Constructor.
  constructor({
    clientId,
    clientSecret,
    username,
    password,
    logger,
    panicExitFunction
  }) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.username = username
    this.password = password
    this.token = null
    this.logger = logger
    this.panicExitFunction = panicExitFunction
  }

  // Obtains a token.
  //
  // Throws "invalid-credentials" if failed.
  async obtainToken() {
    //const refresh = this.token !== null
    const refresh = false

    const args = {
      "client_id": this.clientId,
      "client_secret": this.clientSecret,
      "grant_type": refresh ? "refresh_token" : "password",
      "username": refresh ? null : this.username,
      "password": refresh ? null : this.password,
      "scope": "*",
      "refresh_token": refresh ? this.token : null,
    }

    this.logger.debug(`token-obtain-request <HIDDEN>`)

    const response = await fetch(StaticProvider.endpoint + "/oauth/token", {
      method: "POST",
      body: Helpers.genFormData(args),
      headers: StaticProvider.defaultHeaders
    })

    const text = await response.text()
    try {
      const json = JSON.parse(text)
      this.token = json.access_token
      this.defaultHeaders = {
        "Authorization": "Bearer " + this.token,
        ...StaticProvider.defaultHeaders
      }
      this.expiresIn = json.expires_in

      this.logger.debug(`token-obtain-response ${ refresh ? "re" : "" }<HIDDEN>`)

      // Reobtain token before it expires.
      if (!refresh)
        this.refreshTimeout = setTimeout(() => this.obtainToken(), this.expiresIn * 0.9 * 1000)
    } catch (e) {
      this.logger.fatal(`token-obtain-failed ${ response.status } ${ e }`)
      throw "invalid-credentials"
    }
  }

  // Connect to the multiplayer server.
  async connectToMultiplayerServer() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(StaticProvider.multiplayerEndpoint, {
        headers: this.defaultHeaders
      })
      .configureLogging({
        log: (level, message) => this.logger[StaticProvider.signalRLogLevelsToPino[level]](message)
      })
      .build()

    await this.connection.start().then(() => {
      this.logger.info("Connected to multiplayer server.")
    })
  }

  async invoke() {
    const id = uuid4()
    this.logger.debug(`signalr-invoke-request ${ id } ${ Helpers.toJSON(Array.from(arguments)) }`)
    const result = await this.connection.invoke(...arguments)
    this.logger.debug(`signalr-invoke-response ${ id } ${ Helpers.toJSON(result) }`)
    return result
  }

  send() {
    this.logger.debug(`signalr-send-request ${ Helpers.toJSON(Array.from(arguments)) }`)
    return this.connection.send(...arguments)
  }

  // Makes a request to the osu! API.
  async apiRequest(endpoint, method, data = null, debug = true) {
    this.decorators.OnlyLoggedIn()

    let requestID = null
    if (debug) {
      requestID = uuid4()
      this.logger.debug(`api-request-request ${ requestID } ${ endpoint } ${ method } ${ Helpers.toJSON(data) }`)
    }
    let response;
    try {
      response = await fetch(StaticProvider.endpoint + "/api/v2/" + endpoint, {
        method: method,
        body: data,
        headers: {
          "Content-Type": "application/json",
          ...this.defaultHeaders
        }
      })
    } catch (_) {
      throw "api-request-fetch-failed"
    }

    let json
    try {
      json = await response.json()
    } catch (_) {
      throw "api-request-parse-failed"
    }
    if (debug)
      this.logger.debug(`api-request-response ${ requestID } ${ response.status } ${ Helpers.toJSON(json) }`)

    return json
  }

  async panicExit(reason) {
    this.panicExitFunction(reason);
  }

  async apiExecute(apiRequest, debug = true) {
    let triesLeft = 5;
    let response;
    while (triesLeft !== 0) {
      try {
        response = await this.apiRequest(apiRequest.endpoint, apiRequest.method, apiRequest.data, debug)
        break;
      } catch (e) {
        // We got a problem!
        this.logger.error(`api-execute-error ${ triesLeft } ${ Helpers.toJSON(e) }`)
        if (--triesLeft === 0) {
          let msg;
          switch (e) {
            case "api-request-fetch-failed":
              msg = "http request fetch failed";
              break;
            case "api-request-parse-failed":
              msg = "http request parse failed";
              break;
            default:
              msg = "unknown(???)";
              break;
          }
          return this.panicExit(msg);
        } else {
          continue
        }
      };
    }
    if (response.error !== undefined)
      throw response.error

    return response
  }

  async joinRoomWithPassword(roomID, password) {
    return await this.invoke("JoinRoomWithPassword", roomID, password)
  }

  async setServerHandlers(serverHandlers) {
    this.decorators.OnlyConnected()

    for (const key in serverHandlers) {
      this.connection.on(key, serverHandlers[key])
    }
  }

  decorators = {
    OnlyConnected: () => {
      if (this.connection.state !== signalR.HubConnectionState.Connected)
        throw "Client is not connected"
    },

    OnlyLoggedIn: () => {
      if (this.token === null)
        throw "Client is not logged in"
    }
  }
}
