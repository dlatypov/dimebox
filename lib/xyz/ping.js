'use strict'

const log = require('loglevel'),
      fs  = require('fs'),
      request = require('request'),
      moment = require('moment'),
      getJWT = require('./jwt')


module.exports = function() {
  const jwt = getJWT()

  const opts = {
    method: 'GET',
    url: "http://dimebox.xyz/api/v1/ping",
    headers: {
      authorization: `Bearer ${jwt}`
    }
  }

  //console.log(opts)

  request(opts, (error, response, body) => {
    if (error) {
      log.error("Error connecting to endpoint", opts.url)
      process.exit(1)
    }

   if (response.statusCode == 401) {
      log.error("Not authorized.")
      process.exit(1)
   }

   if (response.statusCode != 200) {
      log.error("Received unexpected status code", response.statusCode)
      process.exit(1)
   }

   const b = JSON.parse(body)

   if (b.status == "OK") {
     console.log("Authorized")
     log.info("User:", b.users.sub)
     log.info("Expires:", moment.unix(b.users.exp).format())
   }
  })
}

