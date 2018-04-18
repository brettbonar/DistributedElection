const Message = require("./Message");

class RequestWork extends Message {
  constructor() {
    super();
    this.type = "requestWork";
  }
}

module.exports = RequestWork;
