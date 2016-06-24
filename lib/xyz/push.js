'use strict'

const fs = require('node-fs-extra'),
      epochUtils = require('../util/epochs'),
      dirs = require('../util/dirs'),
      _ = require('underscore'),
      chalk = require('chalk'),
      yaml = require('js-yaml'),
      Q = require('q'),
      log = require('loglevel'),
      Table = require('cli-table');


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

  const startTime = "blah"
  const finishTime = "blah"
    
  let job = loadRaw(md.job)
  console.log("jobfile", md.job)
  let raw = loadRaw(dirs.results(epoch, res.name))

  return {
    name: res,
    status: stat,
    startTime: startTime,
    finishTime: finishTime,
    raw: raw,
    job: job
  }
}

function experiment(epoch) {
  const stat = epochUtils.status(epoch)

  const vc = loadYAML(dirs.jobs(epoch, 'vc.yml'))
  const machine = loadYAML(dirs.jobs(epoch, 'machine.yml'))

  const results = _.map(stat.expected, res => { return foo(res, epoch) })

  const structured = loadJSON(dirs.results(epoch, ".parsed", "results.json"))

  const overallStatus = 2

  const generated = fs.statSync(dirs.jobs(epoch)).mtime

  return {
    epoch: epoch,
    desc: stat.desc,
    generated: generated,
    vc: vc,
    machine: machine,
    status: overallStatus,
    structured: structured,
    results: results
  }
}

function gather() {
  const epochs = fs.readdirSync(dirs.jobs())

  // Bail if empty experiment set
  if (epochs.length == 0)
    return;

  const experiments =  _.map(epochs, experiment);

  return {
    experiments: experiments
  }
}

module.exports = function(epoch) {
  const payload = gather()

  console.log(JSON.stringify(payload))
}
