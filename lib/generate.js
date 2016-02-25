'use strict'

let yaml   = require('js-yaml'),
    fs     = require('fs'),
    _      = require('underscore'),
    moment = require('moment')

function cartesianProductOf(xs) {
    return _.reduce(xs, function(a, b) {
        return _.flatten(_.map(a, function(x) {
            return _.map(b, function(y) {
                return x.concat([y]);
            });
        }), true);
    }, [ [] ]);
};


function createJobFiles(template, exp) {
  const walltime = exp.wall || '00:30:00'
  const name = exp.name || 'job'
  const optargsKeys = Object.keys(exp.optargs)
  const epoch = moment().format('YYYYMMDD-HHmmss')

  // Create dir for jobfiles and results
  fs.mkdirSync(`experiments/jobs/${epoch}`)
  fs.mkdirSync(`experiments/results/${epoch}`)
  fs.mkdirSync(`experiments/results/${epoch}/stderr`)
  fs.mkdirSync(`experiments/results/${epoch}/stdout`)

  // get all combination of args
  let optargsValues = optargsKeys.map(k => { return exp.optargs[k] })
  optargsValues.push(exp.p)
  let options = cartesianProductOf(optargsValues)
  //console.log(options)

  // For a certain combination of args
  options.map(opt => {
    const p = opt[opt.length-1]
    // parse optional args and export them to script
    let exports = '';
    let i = 0;
    for (var key in exp.optargs) {
      exports += `${key}=${opt[i]}\n`
      i++;
    }

    // job name
    let jobNameArgs = [name]
    Array.prototype.push.apply(jobNameArgs, opt)
    const jobName = jobNameArgs.join('-')
        
    // Command that will be run by the job. Start off by exporting experimental args.
    let cmd = exports
    cmd += `\ncd ${process.cwd()}\n`

    // get commands
    exp.cmds.map(c => {

      // get name of command
      for (const cmdName in c) {
        let resultFile = `experiments/results/${epoch}/${cmdName}-${opt.join('-')}`
        cmd += `\n$MPIRUN ${c[cmdName]} &> ${resultFile}` 
      }
    });

    // Generate job file
    const generatedJob = template(jobName, p, walltime, epoch, cmd)

    // Write job file
    const filename = `experiments/jobs/${epoch}/${jobName}.job`
    fs.writeFile(filename, generatedJob, (err) => { if (err) throw err });
  });

  console.log(epoch)

  fs.writeFile(`experiments/jobs/${epoch}/run.yml`, yaml.safeDump(exp), (err) => { if (err) throw err });
  fs.writeFile(`experiments/results/${epoch}/run.yml`, yaml.safeDump(exp), (err) => { if (err) throw err });
}


module.exports = function(machine, experiment) {
  // read experiment YAML
  try {
    var exp = yaml.safeLoad(fs.readFileSync(experiment))
    console.log(exp)
  } catch (e) {
    console.log(`Error reading experiment file ${experiment}.`)
    process.exit(1)
  }
  
  // read machine vars
  let machineVars = require('./templates/' + machine);
  let jobTemplate = machineVars.template

  if (!exp.p) {
    console.log('Processor counts needs to be specified')
    process.exit(2)
  }

  createJobFiles(jobTemplate, exp)
}
