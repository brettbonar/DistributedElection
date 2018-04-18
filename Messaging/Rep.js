const Socket = require("./Socket");

class Rep extends Socket {
  constructor(connection) {
    super(connection, "rep", Socket.CONNECTION_TYPE.BIND);
  }
}

module.exports = Rep;
