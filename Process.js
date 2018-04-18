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
const Rep = require("./Messaging/Rep");
const Election = require("./Messages/Election");
const SubmitWork = require("./Messages/SubmitWork");
const RequestWork = require("./Messages/RequestWork");
const Coordinate = require("./Messages/Coordinate");
const computeEditDistance = require("./computeEditDistance");

const TIMEOUT = 10000;
const STRING_PROCESSING_TIMEOUT = 60000;
const START_PORT = 3000;

const S3_SOURCE_BUCKET = "distributed-election";
const S3_BUCKET = "distributed-election-run";
const S3_PROCESSES_FOLDER = "processes";
const S3_STRING_PAIR_FOLDER = "string-pairs";
const S3_RESULTS_FOLDER = "string-pair-results";
const S3_PENDING_FOLDER = "string-pair-pending";

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

    this.done = false;

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
        this.socket = new Rep(this.binding);
        this.socket.on((data) => {
          this.logger.info("Got request", data);
          this.requestHandler(data);
        });
        
        q.all([this.updateProcessList(), this.putProcess(this.id, this.binding)])
          .then((results) => {
            this.startElection();
          })
          .catch((er) => {
            this.logger.error(er);
            this.logger.error(er);
            this.done = true;
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
      Bucket: bucket,
      Delimiter: "/",
      Prefix: directory + "/"
    };
  
    return s3.listObjects(params).promise().then((data) => {
      // Ignore first result since it is just the directory
      return data.Contents;
    });
  }
  
  getFolderKey(folder, string) {
    return [folder, string].join("/");
  }
  
  submitResult(data) {
    let params = {
      Bucket: S3_BUCKET,
      Key: this.getFolderKey(S3_RESULTS_FOLDER, data.stringPairKey),
      Body: data.distance.toString()
    };
    return s3.putObject(params).promise()
      .then(() => {
        this.logger.info("Put result", data.stringPairKey, data.distance);
      })
      .catch((er) => {
        this.logger.error("Failed to put result", data.stringPairKey, data.distance, er);
      });
  }

  removePending(stringPairKey) {
    if (this.pendingStrings[stringPairKey]) {
      clearTimeout(this.pendingStrings[stringPairKey]);
      delete this.pendingStrings[stringPairKey];
    }

    let removePendingParams = {
      Bucket: S3_BUCKET,
      Key: this.getFolderKey(S3_PENDING_FOLDER, stringPairKey)
    };
    s3.deleteObject(removePendingParams).promise()
      .then(() => {
        this.logger.info("Removed pending", stringPairKey);
      })
      .catch(() => {
        this.logger.error("Failed to remove pending", stringPairKey);
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
        this.logger.info("Put pending", data.stringPairKey);
        return result;
      })
      .catch((er) => {
        this.logger.error("Failed to put pending", data.stringPairKey, er);
        throw er;
      })
  }
  
  putPendingString(stringPairKey) {
    let params = {
      Bucket: S3_BUCKET,
      Key: this.getFolderKey(S3_PENDING_FOLDER, stringPairKey)
    };
    return s3.putObject(params).promise()
      .then((result) => {
        this.logger.info("Put pending", data.stringPairKey);
        return result;
      })
      .catch((er) => {
        this.logger.error("Failed to put pending", data.stringPairKey, er);
        throw er;
      })
  }
  
  getProcesses() {
    return this.getObjects(S3_BUCKET, S3_PROCESSES_FOLDER);
  }

  updateProcessList() {
    return this.getProcesses().then((processes) => this.processes = processes);
  }

  handleRequest(data) {
    if (data.type === "election") {
      this.socket.send("election");
      this.startElection();
    } else if (data.type === "coordinate") {
      this.socket.send("coordinated");
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
        if (process.key !== this.id && process.key > this.id) {
          this.logger.info("Sent election message to", process.key);
          promises.push(new Req(process.data, TIMEOUT, 0).send(new Election()));
        }
      }

      if (promises.length > 0) {
        q.all(promises)
          .then(() => this.startWorker())
          .catch((er) => {
            this.logger.info(warn);
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
    this.isCoordinator = true;
    this.requestHandler = this.handleCoordinatorRequests;
    this.coordinatorReady = q.defer();

    for (const process of this.processes) {
      if (process.key !== this.id) {
        this.logger.info("Sent coordinate message to", process.key);
        new Req(process.data).send(new Coordinate(this.id));
      }
    }

    this.getDirectoryListing(S3_SOURCE_BUCKET, S3_STRING_PAIR_FOLDER)
      .then((stringPairs) => {
        this.stringPairs = stringPairs.slice(1).map((content) => content.Key);
        this.coordinatorReady.resolve();
      });
  }

  handleWorkRequest() {
    let stringPairKey = this.getNextString();
    if (stringPairKey) {
      this.putPendingString(stringPairKey);
      _.pull(this.stringPairs, stringPairKey);
      this.logger.info("Sent work response", stringPairKey);
      this.socket.send({ stringPairKey: stringPairKey });
      
      this.pendingStrings[stringPairKey] = setTimeout(() => {
        this.logger.warn("String pair processing timed out", stringPairKey);
        this.stringPairs.push(stringPairKey);
        this.removePending(stringPairKey);
      }, STRING_PROCESSING_TIMEOUT);
    } else {
      // No more strings to compute
      this.socket.send({ terminate: true });
    }
  }

  handleCoordinatorRequests(data) {
    this.handleRequest(data);
    
    if (data.type === "requestWork") {
      // TODO: may need to use router if this will create synchronization problems
      this.coordinatorReady.promise.then(() => this.handleWorkRequest());
    } else if (data.type === "submitWork") {
      this.removePending(data.stringPairKey);
      this.submitResult(data);
      this.socket.send("submitted");
    }
  }

  getNextString() {
    if (this.stringPairs.length === 0) {
      return false;
    }
    return this.stringPairs[0];
  }

  // WORKER

  handleWorkerRequests(data) {
    this.handleRequest(data);
  }

  computeAndSubmitEditDistance(stringPairKey, stringPair) {
    this.isWorking = true;
    let strings = stringPair.Body.toString().split("\n");
    let distance = computeEditDistance(strings[0], strings[1]);

    this.logger.info("Finished computing edit distance, sending result", stringPairKey, distance);
    new Req(this.coordinator.data, TIMEOUT, 0)
      .send(new SubmitWork(stringPairKey, distance))
      .catch((er) => {
        this.logger.error("Error in request work response", er);
        this.startElection()
      });

    this.isWorking = false;
    this.requestWork();
  }

  startWork(data) {
    this.logger.info("Starting work on string pair", data.stringPairKey);
    // TODO: Get strings from S3
    this.getStringPair(data.stringPairKey)
      .then((stringPairObject) => {
        this.computeAndSubmitEditDistance(data.stringPairKey, stringPairObject);
      })
      .catch((er) => this.logger.error("Failed to get string pair", data.stringPairKey, er))
  }

  handleRequestWorkResponse(data) {
    if (data.terminate) {
      // Terminate somehow
      this.logger.info("No more work, terminating...");
      this.done = true;
    } else if (data.stringPairKey) {
      this.startWork(data);
    } else {
      this.logger.error("Got invalid string pair key");
      this.requestWork();
    }
  }

  requestWork() {
    if (this.coordinator) {
      this.logger.info("Requesting work");
      new Req(this.coordinator.data, TIMEOUT, 0)
        .send(new RequestWork())
        .then((data) => this.handleRequestWorkResponse(data))
        .catch((er) => {
          this.logger.error("Error in request work response", er);
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
