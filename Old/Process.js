const _ = require("lodash");
const q = require("q");
const publicIp = require("public-ip");
const AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);
const s3 = new AWS.S3();
const fs = require("fs");
const detect = require("detect-port");

const logger = require("./logger");
const Req = require("./Messaging/Req");
const VectorTimestamp = require("./Messaging/VectorTimestamp");

class Process {
  constructor(options) {
    this.type = options.type;
    this.id = options.id;
    this.coordinator = {
      ip: options.coordinatorIp,
      port: options.coordinatorPort
    };
    this.name = this.id;
    this.logger = logger.getLogger(this.name);
    this.vectorTimestamp = new VectorTimestamp(this.id);

    // Get configuration from coordinator first
    let sock = new Req(this.coordinator);
    let params = {
      id: this.id,
      msgType: "requestConfiguration"
    };
    sock.on((data) => this.handleConfig(data));
    sock.send(params);

    setInterval(() => this.sendLogs(), 30000);
  }

  sendLogs() {
    var myBucket = 'bbonar-simulated-disease-surveillance';
    var name = this.id + ".log";
    var file = fs.readFileSync("./logs/" + name, "utf8");
  
    let params = { Bucket: myBucket, Key: name, Body: file };
    s3.putObject(params, () => {});
  }

  requestName(name) {
    let deferred = q.defer();
    let req = new Req(this.coordinator);
    req.on((data) => deferred.resolve(data));
    req.send({
      name: name,
      msgType: "requestName"
    });
    
    return deferred.promise;
  }

  ready(config) {
    let req = new Req(this.coordinator);
    req.send({
      msgType: "ready",
      id: this.id
    });
    req.on((data) => {
      this.start(config);
    });
  }
  
  handleConfig(config) {
    if (this.gotConfig) {
      return;
    }

    this.gotConfig = true;
    // TODO: clean this up
    this.logger.debug("Got config: " + JSON.stringify(config, null, 2));
    let left = _.size(config.bindings);

    if (_.size(config.bindings) > 0) {
      publicIp.v4().then((ip) => {
        _.each(config.bindings, (binding, name) => {
          detect(binding.port, (err, _port) => {
            if (err) {
              console.log(err);
              this.logger.error(err);
            }

            if (binding.port !== _port) {
              this.logger.debug("Port ", binding.port, " in use. Using port ", _port);
            }
            
            binding.port = _port;
            let req = new Req(this.coordinator);
            this.logger.debug("Register Binding: " + name, ip, binding.port);
            req.send({
              msgType: "register",
              name: [this.id, name].join("."),
              binding: {
                ip: ip,
                port: binding.port
              },
              type: this.type
            });
            req.on((data) => {
              this.logger.debug("Registered: " + name);
              left -= 1;
              if (left === 0) {
                this.logger.debug("Ready");
                this.ready(config);
              }
            });
          });
        });
      });
    } else {
      this.ready(config);
    }
  }
}

module.exports = Process;
