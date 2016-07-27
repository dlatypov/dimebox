'use strict'

const fs = require('node-fs-extra'),
      epochUtils = require('../util/epochs'),
      dirs = require('../util/dirs'),
      _ = require('underscore'),
      chalk = require('chalk'),
      yaml = require('js-yaml'),
      Q = require('q'),
      log = require('loglevel'),
      request = require('request'),
      getJWT = require('./jwt')


function loadYAML(filename) {
  let o = {}
  try {
    o = yaml.safeLoad(fs.readFileSync(filename))
  } catch (e) { }

  return o;
}

function loadJSON(filename) {
  let o = ""
  try {
    o = fs.readJsonSync(filename)
  } catch (e) { }

  return o;
}

function loadRaw(filename) {
  let str = ""
  try {
    str = fs.readFileSync(filename).toString()
  } catch (e) { }

  return str;
}

function foo(res, epoch) {
  const resultFile = dirs.results(epoch, '.started', res.name)
  const doneFile = dirs.results(epoch, '.done', res.name)
  const failedFile = dirs.results(epoch, '.fail', res.name)
  const mdFile = dirs.results(epoch, '.md', `${res.name}.yml`)

  const md = loadYAML(mdFile)

  // hasn't started
  let stat = 0;
  // done
  if (fs.existsSync(doneFile))
    stat = 1
  // failed
  else if (fs.existsSync(failedFile))
    stat = 2
  // still running
  else if (fs.existsSync(resultFile))
    stat = 3

  const startTime = res.modified
  const finishTime = res.modified
    
  let job = loadRaw(md.job)
//  console.log("jobfile", md.job)
  let raw = loadRaw(dirs.results(epoch, res.name))

  return {
    name: res.name,
    status: stat,
    startTime: startTime,
    finishTime: finishTime,
    raw: raw,
    job: job
  }
}

function experimentStatus(results) {
  const statuses = _.map(results, r => Number(r.status))

  // If everything is successful, return success
  if (_.every(statuses, s => s == 1))
    return 1

  // If one failed, it's failed
  if (_.some(statuses, s => s == 2))
    return 2
 
  // If one is running, it's mixed
  if (_.some(statuses, s => s == 3))
    return 3

  // Otherwise, nothing started
  return 0
}

function experiment(epoch) {
  const stat = epochUtils.status(epoch)

  const vc = loadYAML(dirs.jobs(epoch, 'vc.yml'))
  const machine = loadYAML(dirs.jobs(epoch, 'machine.yml')) || {}
  const expfile = loadRaw(dirs.jobs(epoch, 'run.yml'))

  const results = _.map(stat.expected, res => { return foo(res, epoch) })

  const structured = loadJSON(dirs.results(epoch, ".parsed", "results.json")) || {}

  const overallStatus = experimentStatus(results)

  const generated = fs.statSync(dirs.jobs(epoch)).mtime

  return {
    epoch: epoch,
    desc: stat.desc,
    generated: generated,
    expfile: expfile,
    vc: vc,
    machine: machine,
    status: overallStatus,
    observations: structured,
    results: results
  }
}

function vcInfo(experiments) {
  const first = experiments[0]

  if (first.vc.git) {
    return {
      vcs: "git",
      remote: first.vc.git.remotes[0]
    }
  } else {
    return {
      vcs: "-",
      remote: "-"
    }
  }
}

function machineInfo(experiments) {
  const first = experiments[0]

  return first.machine
}

function gather() {
  const epochs = fs.readdirSync(dirs.jobs())

  // Bail if empty experiment set
  if (epochs.length == 0)
    return;

  const metadata = loadYAML("experiments/.dimebox.yml")

  const experiments =  _.map(epochs, experiment);

  const vc = vcInfo(experiments)

  //console.log("vc", vc)
  const machine = machineInfo(experiments)

  return {
    id: metadata.id,
    desc: metadata.desc,
    vc: vc,
    machine: machine,
    experiments: experiments,
  }
}

module.exports = function(epoch) {
  const payload = gather()
  const jwt = getJWT()

  const opts = {
    method: 'POST',
    url: 'http://dimebox.xyz/api/v1/expset',
    headers: {
      authorization: `Bearer ${jwt}`
    },
    json: payload
  }

  console.log("Sending payload of size", JSON.stringify(payload).length)
//  console.log(JSON.stringify(payload))

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

   
   console.log("Received ", body)
  })

}
