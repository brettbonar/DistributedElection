const Message = require("./Message");

class Election extends Message {
  constructor() {
    super();
    this.type = "election";
  }
}

module.exports = Election;
