const _ = require("lodash");
const uuid = require("uuid/v4");

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);

const Req = require("./Messaging/Req");
const Rep = require("./Messaging/Rep");
const Election = require("./Messages/Election");
const SubmitWork = require("./Messages/SubmitWork");
const RequestWork = require("./Messages/RequestWork");
const computeEditDistance = require("./computeEditDistance");

const TIMEOUT = 10000;
const S3_BUCKET = "distributed-election";
const S3_PROCESSES = "processes";
const S3_STRING_PAIR_FOLDER = "string-pairs";
const S3_RESULTS_FOLDER = "string-pair-results";

function getStringPairKey(folder, string) {
  return [folder, string].join("/");
}

function submitResult(data) {
  let params = {
    Bucket: S3_BUCKET,
    Key: getStringPairKey(S3_RESULTS_FOLDER, data.stringPair),
    Body: data.distance
  };
  s3.putObject(params).promise()
    .then(() => console.log("Put result", data.stringPair, data.distance))
    .catch(() => console.log("Failed to put result", data.stringPair, data.distance))
}

function getStringPair(string) {
  let params = {
    Bucket: S3_BUCKET,
    Key: getStringPairKey(S3_STRING_PAIR_FOLDER, string)
  };
  return s3.getObject(params).promise();
}

function getStringPairListing() {
  let params = {
    Bucket: S3_BUCKET,
    Delimiter: "/",
    Prefix: S3_STRING_PAIR_FOLDER + "/"
  };
  return s3.listObjects(params).promise();
}

class Node {
  constructor(binding) {
    this.id = uuid();

    this.requestHandler = this.handleRequest;

    this.socket = new Rep(binding);
    this.socket.on((data) => this.requestHandler(data));

    // Get list of other nodes from S3
    this.nodes = [];
    this.coordinator = null;

    this.isCoordinator = false;
    this.isWorking = false;

    this.done = false;

    // TODO: put all requests on here and resend to new coordinator if
    // an election is done before requests are satisfied
    this.pendingRequests = [];

    this.startElection();
  }

  startWorker() {
    this.requestHandler = this.handleWorkerRequests;
    console.log(this.id, "is worker");
  }

  handleWorkerRequests(data) {
    if (data.type === "election") {
      this.socket.send();
      this.startElection();
    }
  }

  handleRequest(data) {
    if (data.type === "election") {
      this.socket.send();
      this.startElection();
    }
  }

  startElection() {
    let sentReq = false;
    for (const node of this.nodes) {
      if (node.id > this.id) {
        sentReq = true;
        //this.req.on((data) => (data));
        new Req(node.binding, TIMEOUT, 0)
          .send(new Election())
          .then(() => this.startWorker())
          .catch(() => this.startCoordinator());
      }
    }

    if (!sentReq) {
      this.startCoordinator();
    }
  }

  // COORDINATOR

  startCoordinator() {
    this.isCoordinator = true;
    this.requestHandler = this.handleCoordinatorRequests;
    this.coordinatorReady = q.defer();
    getStringPairListing().then((stringPairs) => {
      // Ignore first result since it is just the directory
      this.stringPairs = stringPairs.Contents.slice(1).map((content) => content.Key);
      this.coordinatorReady.resolve();
    });
    // TODO: get current string pair state from S3
    console.log(this.id, "is coordinator");
  }

  handleWorkRequest() {
    let stringPair = this.getNextString();
    if (stringPair) {
      this.socket.send({ stringPair: stringPair });
    } else {
      // No more strings to compute
      this.socket.send({ terminate: true });
    }
  }

  handleCoordinatorRequests(data) {
    if (data.type === "election") {
      this.socket.send();
      this.startElection();
    } else if (data.type === "requestWork") {
      // TODO: may need to use router if this will create synchronization problems
      this.coordinatorReady.then(() => this.handleWorkRequest());
    } else if (data.type === "submitWork") {
      submitResult(data);
    }
  }

  getNextString() {
    if (this.stringPairs.length === 0) {
      return false;
    }
    return this.stringPairs[0];
  }

  handleRequestWorkResponse(data) {
    if (data.terminate) {
      // Terminate somehow
      this.done = true;
    } else {
      this.startWork(data);
    }
  }

  // WORKER
  computeAndSubmitEditDistance(strings) {
    this.isWorking = true;
    let distance = computeEditDistance(strings[0], strings[1]);

    new Req(this.coordinator.binding, TIMEOUT, 0)
      .send(new SubmitWork(data.stringPair, distance))
      .catch(() => this.startElection());

    this.isWorking = false;
    this.requestWork();
  }

  startWork(data) {
    // TODO: Get strings from S3
    getStringPair(data.stringPair)
      .then((strings) => {
        this.computeAndSubmitEditDistance(strings);
      })
      .catch(() => console.log("Failed to get string pair:", data.stringPair))
  }

  requestWork() {
    new Req(this.coordinator.binding, TIMEOUT, 0)
      .send(new RequestWork())
      .then((data) => this.handleRequestWorkResponse(data))
      .catch(() => this.startElection());
  }
}

module.exports = Node;


// if (_.size(config.bindings) > 0) {
//   publicIp.v4().then((ip) => {
//     _.each(config.bindings, (binding, name) => {
//       detect(binding.port, (err, _port) => {
//         if (err) {
//           console.log(err);
//           this.logger.error(err);
//         }

//         if (binding.port !== _port) {
//           this.logger.debug("Port ", binding.port, " in use. Using port ", _port);
//         }
        
//         binding.port = _port;
//         let req = new Req(this.coordinator);
//         this.logger.debug("Register Binding: " + name, ip, binding.port);
//         req.send({
//           msgType: "register",
//           name: [this.id, name].join("."),
//           binding: {
//             ip: ip,
//             port: binding.port
//           },
//           type: this.type
//         });
//         req.on((data) => {
//           this.logger.debug("Registered: " + name);
//           left -= 1;
//           if (left === 0) {
//             this.logger.debug("Ready");
//             this.ready(config);
//           }
//         });
//       });
//     });
//   });
// } else {
//   this.ready(config);
// }