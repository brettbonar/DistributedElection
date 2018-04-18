const Message = require("./Message");

class Coordinate extends Message {
  constructor() {
    this.type = "coordinate";
  }
}

module.exports = Coordinate;
