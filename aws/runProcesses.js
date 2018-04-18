const AWS = require("aws-sdk");
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);
const ssm = new AWS.SSM();
const _ = require("lodash");

function getCommand(config, process) {
  return "cd /home/ec2-user/sds; sudo touch /etc/ld.so.conf; export LD_LIBRARY_PATH=/usr/local/lib; " +
  "sudo ldconfig; ./node ./startProcess.js --type " + process.type + " --coordinator-ip " +
  config.coordinator.ip + " --coordinator-port " + config.coordinator.port + " --id " + process.id; 
}

function runCoordinator(config, process) {
  let params = {
    DocumentName: "AWS-RunShellScript", /* required */
    Comment: "Run Process: " + process.id,
    TimeoutSeconds: 60,
    InstanceIds: [
      process.instanceId
    ],
    Parameters: {
      "commands": [
        "cd /home/ec2-user/sds; sudo touch /etc/ld.so.conf; export LD_LIBRARY_PATH=/usr/local/lib; " +
          "sudo ldconfig; ./node ./startProcess.js --type coordinator;"
        /* more items */
      ],
      /* '<ParameterName>': ... */
    },
  };
  ssm.sendCommand(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log("Successful Command:", process.id);           // successful response
  });
}

function runProcess(config, process) {
  let params = {
    DocumentName: "AWS-RunShellScript", /* required */
    Comment: "Run Process: " + process.id,
    TimeoutSeconds: 60,
    InstanceIds: [
      process.instanceId
    ],
    Parameters: {
      "commands": [
        getCommand(config, process)
        /* more items */
      ],
      /* '<ParameterName>': ... */
    },
  };
  ssm.sendCommand(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log("Successful Command:", process.id, process.instanceId);           // successful response
  });
}

function runProcesses(config) {
  console.log(JSON.stringify(config, null, 2));
  _.each(config.processes, (process) => {
    if (process.type === "coordinator") {
      runCoordinator(config, process);
    } else {
      runProcess(config, process);
    }
  });
}

module.exports = runProcesses;
//runCoordinator();
