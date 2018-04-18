const Socket = require("./Socket");

class Pull extends Socket {
  constructor(connection, type) {
    super(connection, "pull", type || Socket.CONNECTION_TYPE.BIND);
  }
}

module.exports = Pull;
