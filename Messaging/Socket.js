"use strict";

const _ = require("lodash");
const zmq = require("zmq");
const q = require("q");

const logger = require("../logger").getLogger("Socket");

let CONNECTION_TYPE = {
  CONNECT: "connect",
  BIND: "bind"
}

function getAddress(connection) {
  let ip = connection.ip;
  if (ip === "localhost") {
    ip = "127.0.0.1";
  }
  return "tcp://" + ip + ":" + connection.port;
}

class Socket extends zmq.Socket {
  constructor(connection, socketType, connectionType, timeout, retries) {
    super(socketType);
    this.setMaxListeners(0);
    this.socketType = socketType;
    this.connectionType = connectionType;
    this.timeoutTime = timeout || 5000;
    this.retries = !_.isUndefined(retries) ? retries : 3;
    this.deferred = q.defer();

    if (connection) {
      this.connect(connection);
    }
  }

  connect(connection) {
    if (_.isArray(connection)) {
      this.connection = _.map(connection, getAddress);
    } else {
      this.connection = getAddress(connection);
    }

    if (this.connectionType === CONNECTION_TYPE.CONNECT) {
      if (_.isArray(this.connection)) {
        _.each(this.connection, (conn) => super.connect(conn));
      } else {
        super.connect(this.connection);
      }
    } else {
      this.bindSync(this.connection);
    }
  }

  sendImpl(data, id) {
    logger.info("Sending", data);
    data = data && data.toJSON ? JSON.stringify(data.toJSON()) : JSON.stringify(data);
    if (!_.isUndefined(id)) {
      super.send([id, "", data]);
    } else {
      // TODO: find out if above will always work
      super.send(data);
    }
  }



  send(data, id) {
    let that = this;
    this.sendImpl(data, id);
    
    let requestCallback = function(msgData) {
      clearTimeout(that.timeout);
      that.timeout = null;

      let from = null; // will be sender id or publish topic
      if (arguments.length > 1) {
        let args = Array.apply(null, arguments);
        from = args[0];
        msgData = JSON.parse(args[args.length - 1].toString());
      } else {
        msgData = JSON.parse(msgData.toString());
      }

      this.deferred.resolve(msgData, from);
    };

    super.on("message", requestCallback);

    let timeoutCb = function () {
      if (that.retries > 0) {
        that.retries -= 1;
        logger.warn("Timed out, retrying...");
        try {
          that.close();
          that.removeListener("message", requestCallback);
        } catch (er) {}
        that.sendImpl(data, id);
        that.timeout = setTimeout(timeoutCb, that.timeoutTime);        
      } else if (that.timeout) {
        try {
          logger.warn("Timed out, no more retries");
          that.close();
          that.removeListener("message", requestCallback);
        } catch (er) {}
        that.deferred.reject("Timed out");
        //console.log("FAILED TO SEND: " + JSON.stringify(data, null, 2));
      }
    };

    this.timeout = setTimeout(timeoutCb, this.timeoutTime);

    return this.deferred.promise;
  }

  on(cb) {
    super.on("message", function (data) {
      let from = null; // will be sender id or publish topic
      if (arguments.length > 1) {
        let args = Array.apply(null, arguments);
        from = args[0];
        data = JSON.parse(args[args.length - 1].toString());
      } else {
        data = JSON.parse(data.toString());
      }
      cb(data, from);
    });
  }

  static get CONNECTION_TYPE() {
    return CONNECTION_TYPE;
  }
}

module.exports = Socket;
