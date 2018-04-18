const Socket = require("./Socket");

class Push extends Socket {
  constructor(connection, type) {
    super(connection, "push", type || Socket.CONNECTION_TYPE.CONNECT);
  }
}

module.exports = Push;
