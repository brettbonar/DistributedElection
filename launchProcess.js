const { spawn } = require("child_process");
const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const options = require("commander");

let children = [];

function launch(command, args) {
  let child = spawn(command, args);
  child.stdout.on("data", function(data) {
    console.log(data.toString());
  });
  child.stderr.on("data", function(data) {
    console.log(data.toString());
  });
  child.on("close", function(code) {
    console.log("closing code: " + code);
  });
  children.push(child);
}

// Clean log directory
// let logDir = "./logs";
// fs.readdir(logDir, (err, files) => {
//   if (err) throw err;

//   if (files) {
//     for (const file of files) {
//       fs.unlink(path.join(logDir, file), err => {
//         if (err) throw err;
//       });
//     }
//   }
// });

function launchProcess(options) {
  launch("node",  ["./startProcess.js", "--id", options.id, "--type", options.type,
    "--coordinator-ip", options.coordinator.ip, "--coordinator-port", options.coordinator.port]);
}

module.exports = launchProcess;
