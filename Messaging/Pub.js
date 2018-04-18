const Socket = require("./Socket");
const _ = require("lodash");
const zmq = require("zmq");

class Pub extends Socket {
  constructor(connection) {
    super(connection, "pub", Socket.CONNECTION_TYPE.BIND);
  }

  send(data, topic) {
    if (!_.isNil(topic)) {
      zmq.Socket.prototype.send.call(this, [topic, JSON.stringify(data)]);
    } else {
      super.send(data);
    }
  }
}

module.exports = Pub;
