const Message = require("./Message");

class RequestWork extends Message {
  constructor() {
    this.type = "requestWork";
  }
}

module.exports = RequestWork;
