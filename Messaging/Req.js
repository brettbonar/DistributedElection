const Socket = require("./Socket");

class Req extends Socket {
  constructor(connection, timeout, retries) {
    super(connection, "req", Socket.CONNECTION_TYPE.CONNECT, timeout, retries);
  }
}

module.exports = Req;
