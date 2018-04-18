const Socket = require("./Socket");

class Router extends Socket {
  constructor(connection) {
    super(connection, "router", Socket.CONNECTION_TYPE.BIND);
  }
}

module.exports = Router;
