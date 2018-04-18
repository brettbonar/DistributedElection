const Message = require("./Message");

class Election extends Message {
  constructor() {
    this.type = "election";
  }
}

module.exports = Election;
