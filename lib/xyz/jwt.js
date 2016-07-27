'use strict'

const log = require('loglevel'),
      fs  = require('fs')

module.exports = function() {
  const home = process.env.HOME || '~'
  const file = home + '/.dimebox/xyz/auth.jwt'

  let token = ""

  try {
    token = fs.readFileSync(file).toString()
  } catch (e) {
    log.error(e)
    log.error(`Cannot load ${file}. Perhaps run dimebox xyz auth first?`)
    process.exit(1)
  }

  token = token.replace(/\n/,"")

  return token;
}
