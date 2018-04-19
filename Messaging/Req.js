const Socket = require("./Socket");

class Req extends Socket {
  constructor(connection, timeout, retries, deferred) {
    super(connection, "req", Socket.CONNECTION_TYPE.CONNECT, timeout, retries, deferred);
  }
}

module.exports = Req;
