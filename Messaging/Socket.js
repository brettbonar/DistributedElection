"use strict";

const _ = require("lodash");
const zmq = require("zmq");
const q = require("Q");

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
    
    super.on("message", function(msgData) {
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
    });

    this.timeout = setTimeout(() => {
      if (this.retries > 0) {
        this.retries -= 1;
        this.sendImpl(data, id);
      } else if (this.timeout) {
        this.deferred.reject("Timed out");
        //console.log("FAILED TO SEND: " + JSON.stringify(data, null, 2));
      }
    }, this.timeoutTime);

    return this.deferred.promise;
  }

  on(cb) {
    // clearTimeout(this.timeout);
    // this.timeout = null;
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
