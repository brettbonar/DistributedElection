const AWS = require('aws-sdk');
const s3 = new AWS.S3();
// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);

const _ = require("lodash");
const fs = require("fs");
const options = require("commander");
const Router = require("./Messaging/Router");
const logger = require("./logger");
const launchProcess = require("./launchProcess");

function getDeployedConfig() {
  var myBucket = 'bbonar-simulated-disease-surveillance';
  var myKey = 'deployed.json';

  let params = { Bucket: myBucket, Key: myKey };
  return s3.getObject(params).promise();
}

class Coordinator {
  constructor(options) {
    this.bindings = {};
    this.processes = {};
    this.logger = logger.getLogger("Coordinator");
    this.readyReqs = [];

    this.logger.debug("Get config");
    getDeployedConfig().then((config) => {
      this.logger.info("Loaded config: ", config.Body.toString());
      this.config = JSON.parse(config.Body.toString());
      this.config.processes.coordinator.ready = true;

      _.each(this.config.processes, (proc) => proc.simulation = this.config.simulation);
      
      this.socket = new Router(this.config.processes.coordinator.bindings.coordinator);
      this.socket.on((data, id) => this.handleRequest(data, id));
    });

    setInterval(() => this.sendLogs(), 30000);
  }

  sendLogs() {
    var myBucket = 'bbonar-simulated-disease-surveillance';
    var name = "Coordinator.log";
    var file = fs.readFileSync("./logs/" + name, "utf8");
  
    let params = { Bucket: myBucket, Key: name, Body: file };
    s3.putObject(params, () => {});
  }

  handleRequest(data, id) {
    if (data.msgType === "requestConfiguration") {
      let process = this.config.processes[data.id];
      this.logger.debug("Sent config to: " + data.id);
      this.logger.debug(JSON.stringify(process, null, 2));
      this.socket.send(process, id);
    } else if (data.msgType === "register") {
      this.logger.debug("Register request: " + JSON.stringify(data, null, 2));
      this.register(data);
      this.socket.send({ registered: true }, id);
    } else if (data.msgType === "requestName") {
      this.logger.debug("Name request: " + JSON.stringify(data, null, 2));
      let name = data.name.split(".")[0];
      this.socket.send(_.get(this.bindings, data.name, ""), id);
    } else if (data.msgType === "ready") {
      this.logger.debug("Ready: " + data.id);
      this.config.processes[data.id].ready = true;
      this.readyReqs.push(id);
      if (_.every(this.config.processes, (process) => process.ready)) {
        this.logger.debug("All Ready. Starting...");
        for (const reqId of this.readyReqs) {
          this.socket.send("", reqId);
        }
        this.readyReqs.length = 0;
      }
    }
  }

  register(data) {
    _.set(this.bindings, data.name, data.binding);

    let path = data.name.split(".");
    let typePath = path.slice(1).join(".");
    let list = _.get(this.bindings[data.type], typePath);
    let binding = {
      name: data.name,
      ip: data.binding.ip,
      port: data.binding.port
    };
    if (!list) {
      _.set(this.bindings, [data.type, typePath].join("."), [binding]);
    } else {
      list.push(binding);
    }
  }
}

module.exports = Coordinator;
