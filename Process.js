const _ = require("lodash");
const uuid = require("uuid/v4");
const publicIp = require("public-ip");
const detect = require("detect-port");
const q = require("Q");

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);

const logger = require("./logger");
const Req = require("./Messaging/Req");
const Router = require("./Messaging/Router");
const Election = require("./Messages/Election");
const SubmitWork = require("./Messages/SubmitWork");
const RequestWork = require("./Messages/RequestWork");
const Coordinate = require("./Messages/Coordinate");
const computeEditDistance = require("./computeEditDistance");

const TIMEOUT = 10000;
const STRING_PROCESSING_TIMEOUT = 10000;
const START_PORT = 3000;

const S3_SOURCE_BUCKET = "distributed-election";
const S3_BUCKET = "distributed-election-run";
const S3_RESULTS_BUCKET = "string-pair-results";
const S3_PENDING_BUCKET = "string-pair-pending";
const S3_PROCESSES_FOLDER = "processes";
const S3_STRING_PAIR_FOLDER = "string-pairs";

class Process {
  constructor(binding) {
    this.id = uuid();
    this.logger = logger.getLogger(this.id);

    this.requestHandler = this.handleRequest;

    // Get list of other nodes from S3
    this.nodes = [];
    this.coordinator = null;

    this.isCoordinator = false;
    this.isWorking = false;

    // TODO: put all requests on here and resend to new coordinator if
    // an election is done before requests are satisfied
    this.pendingRequests = [];
    this.pendingStrings = {};

    this.initialize();
  }
  
  initialize() {
    publicIp.v4().then((ip) => {
      detect(START_PORT, (err, port) => {
        if (err) {
          this.logger.error(err);
          return;
        }
        
        this.binding = {
          ip: "localhost", //ip,
          port: port
        };
        this.logger.info("Binding to:", this.binding.ip, this.binding.port);
        this.socket = new Router(this.binding);
        this.socket.on((data, id) => {
          this.logger.info("Got request:", data);
          this.requestHandler(data, id);
        });
        
        q.all([this.updateProcessList(), this.putProcess(this.id, this.binding)])
          .then((results) => {
            this.startElection();
          })
          .catch((er) => {
            this.logger.error(er);
            process.exit();
          });
      });
    });
  }

  getObjects(bucket, directory) {
    return this.getDirectoryListing(bucket, directory)
      .then((results) => {
        let promises = [];
        for (let i = 0; i < results.length; i++) {
          let params = {
            Bucket: bucket,
            Key: results[i].Key
          };
          promises.push(s3.getObject(params).promise()
            .then((object) => {
              return {
                key: results[i].Key.slice(results[i].Key.lastIndexOf("/") + 1),
                data: JSON.parse(object.Body.toString())
              };
            }));
        }

        return q.all(promises);
      });
  }

  getDirectoryListing(bucket, directory) {
    let params = {
      Bucket: bucket
    };
    if (directory) {
      params.Prefix = directory + "/";
      params.Delimiter = "/";
    }
  
    return s3.listObjects(params).promise().then((data) => {
      return data.Contents;
    });
  }
  
  getFolderKey(folder, string) {
    return [folder, string].join("/");
  }
  
  submitResult(data) {
    let params = {
      Bucket: S3_RESULTS_BUCKET,
      Key: data.stringPairKey,
      Body: data.distance.toString()
    };
    return s3.putObject(params).promise()
      .then(() => {
        this.logger.info("Put result:", data.stringPairKey, data.distance);
      })
      .catch((er) => {
        this.logger.error("Failed to put result:", data.stringPairKey, data.distance, er);
      });
  }

  removeProcess(key) {
    let params = {
      Bucket: S3_BUCKET,
      Key: this.getFolderKey(S3_PROCESSES_FOLDER, key)
    };
    return s3.deleteObject(params).promise()
      .then(() => this.logger.info("Removed stale process:", key))
      .catch(() => this.logger.error("Failed to remove stale process:", key))
  }

  removePending(stringPairKey) {
    if (this.pendingStrings[stringPairKey]) {
      clearTimeout(this.pendingStrings[stringPairKey]);
      delete this.pendingStrings[stringPairKey];
    }

    let removePendingParams = {
      Bucket: S3_PENDING_BUCKET,
      Key: stringPairKey
    };
    s3.deleteObject(removePendingParams).promise()
      .then(() => {
        this.logger.info("Removed pending:", stringPairKey);
      })
      .catch(() => {
        this.logger.error("Failed to remove pending:", stringPairKey);
      })
  }
  
  getStringPair(stringPairKey) {
    let params = {
      Bucket: S3_SOURCE_BUCKET,
      Key: stringPairKey
    };
    return s3.getObject(params).promise();
  }
  
  putProcess(id, binding) {
    let params = {
      Bucket: S3_BUCKET,
      Key: this.getFolderKey(S3_PROCESSES_FOLDER, id),
      Body: JSON.stringify(binding)
    };
    s3.putObject(params).promise()
      .then((result) => {
        this.logger.info("Put process:", data.stringPairKey);
        return result;
      })
      .catch((er) => {
        this.logger.error("Failed to put process:", data.stringPairKey, er);
        throw er;
      })
  }
  
  putPendingString(stringPairKey) {
    let params = {
      Bucket: S3_PENDING_BUCKET,
      Key: stringPairKey
    };
    return s3.putObject(params).promise()
      .then((result) => {
        this.logger.info("Put pending:", data.stringPairKey);
        return result;
      })
      .catch((er) => {
        this.logger.error("Failed to put pending:", data.stringPairKey, er);
        throw er;
      })
  }
  
  getProcesses() {
    return this.getObjects(S3_BUCKET, S3_PROCESSES_FOLDER);
  }

  updateProcessList() {
    return this.getProcesses().then((processes) => this.processes = processes);
  }

  handleRequest(data, id) {
    if (data.type === "election") {
      this.socket.send("election", id);
      this.startElection();
    } else if (data.type === "coordinate") {
      this.socket.send("coordinated", id);
      this.coordinatorId = data.coordinator;
      this.coordinator = _.find(this.processes, { key: data.coordinator });
      if (!this.coordinator) {
        this.updateProcessList().then(() => {
          this.coordinator = _.find(this.processes, { key: data.coordinator });
          this.startWorker();
        });
      } else {
        this.startWorker();
      }
    }
  }

  startElection() {
    this.logger.info("Starting election");
    this.updateProcessList().then(() => {
      let promises = [];
      for (const process of this.processes) {
        if (process.key !== this.id && this.binding.ip === process.data.ip && this.binding.port === process.data.port) {
          // Another process in the list has the same IP and port as this one. Since this one is alive, the other must have died.
          // Remove it from the list
          this.removeProcess(process.key);
        } else if (process.key !== this.id && process.key > this.id) {
          this.logger.info("Sent election message to:", process.key);
          promises.push(new Req(process.data, TIMEOUT, 0).send(new Election()));
        }
      }

      if (promises.length > 0) {
        q.all(promises)
          .then(() => {
            this.logger.info("Got election response");
            this.startWorker();
          })
          .catch((er) => {
            this.logger.warn("Send election failed:", er);
            this.startCoordinator();
          });
      } else {
        this.startCoordinator();
      }
    });
  }

  // COORDINATOR

  startCoordinator() {
    this.logger.info(this.id, "is coordinator");

    for (const process of this.processes) {
      if (process.key !== this.id && this.binding.ip === process.data.ip && this.binding.port === process.data.port) {
        // Another process in the list has the same IP and port as this one. Since this one is alive, the other must have died.
        // Remove it from the list
        this.removeProcess(process.key);
      } else if (process.key !== this.id) {
        this.logger.info("Sent coordinate message to:", process.key);
        new Req(process.data).send(new Coordinate(this.id));
      }
    }
    if (this.isCoordinator) {
      // Already coordinator, no need to do anything else
      return;
    }

    this.isCoordinator = true;
    this.requestHandler = this.handleCoordinatorRequests;
    this.coordinatorReady = q.defer();

    q.all([this.getDirectoryListing(S3_SOURCE_BUCKET, S3_STRING_PAIR_FOLDER),
          this.getDirectoryListing(S3_PENDING_BUCKET),
          this.getDirectoryListing(S3_RESULTS_BUCKET)])
      .then((results) => {
        this.logger.info("Coordinator ready");
        let stringPairs = results[0].slice(1).map((content) => content.Key);
        let pendingPairs = results[1].map((content) => content.Key);
        let finishedPairs = results[2].map((content) => content.Key);
        this.stringPairs = _.difference(stringPairs, pendingPairs, finishedPairs);
        this.coordinatorReady.resolve();
      });
  }

  handleWorkRequest(id) {
    let stringPairKey = this.getNextString();
    if (stringPairKey) {
      this.putPendingString(stringPairKey);
      _.pull(this.stringPairs, stringPairKey);
      this.logger.info("Sent work response:", stringPairKey);
      this.socket.send({ stringPairKey: stringPairKey }, id);
      
      this.pendingStrings[stringPairKey] = setTimeout(() => {
        this.logger.warn("String pair processing timed out:", stringPairKey);
        this.stringPairs.push(stringPairKey);
        this.removePending(stringPairKey);
      }, STRING_PROCESSING_TIMEOUT);
    } else {
      // No more strings to compute
      this.socket.send({ terminate: true }, id);
    }
  }

  handleCoordinatorRequests(data, id) {
    this.handleRequest(data, id);
    
    if (data.type === "requestWork") {
      this.coordinatorReady.promise.then(() => this.handleWorkRequest(id));
    } else if (data.type === "submitWork") {
      this.removePending(data.stringPairKey);
      this.submitResult(data);
      this.socket.send("submitted", id);
    }
  }

  getNextString() {
    if (this.stringPairs.length === 0) {
      return false;
    }
    return this.stringPairs[0];
  }

  // WORKER

  handleWorkerRequests(data, id) {
    this.handleRequest(data, id);
  }

  computeAndSubmitEditDistance(stringPairKey, stringPair) {
    let strings = stringPair.Body.toString().split("\n");
    let distance = computeEditDistance(strings[0], strings[1]);

    this.logger.info("Finished computing edit distance, sending result:", stringPairKey, distance);
    new Req(this.coordinator.data, TIMEOUT, 0)
      .send(new SubmitWork(stringPairKey, distance))
      .then(() => this.requestWork())
      .catch((er) => {
        this.logger.error("Error in submit work response:", er);
        this.startElection()
      });

    this.isWorking = false;
  }

  startWork(data) {
    this.logger.info("Starting work on string pair:", data.stringPairKey);
    this.getStringPair(data.stringPairKey)
      .then((stringPairObject) => {
        this.computeAndSubmitEditDistance(data.stringPairKey, stringPairObject);
      })
      .catch((er) => this.logger.error("Failed to get string pair:", data.stringPairKey, er))
  }

  handleRequestWorkResponse(data) {
    this.logger.info("Got request work response");
    if (data.terminate) {
      this.logger.info("No more work, terminating...");
      process.exit();
    } else if (data.stringPairKey) {
      this.startWork(data);
    } else {
      this.logger.error("Got invalid string pair key");
      this.requestWork();
    }
  }

  requestWork() {
    if (this.coordinator && !this.isWorking) {
      this.logger.info("Requesting work");
      this.isWorking = true;
      new Req(this.coordinator.data, TIMEOUT, 0)
        .send(new RequestWork())
        .then((data) => this.handleRequestWorkResponse(data))
        .catch((er) => {
          this.logger.error("Error in request work response:", er);
          this.isWorking = false;
          this.startElection()
        });
    }
    // else get processes list?
  }

  startWorker() {
    this.logger.info(this.id, "is worker");
    this.isCoordinator = false;
    this.requestHandler = this.handleWorkerRequests;
    if (!this.isWorking) {
      this.requestWork();
    }
  }
}

module.exports = Process;
