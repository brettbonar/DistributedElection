const Message = require("./Message");

class Coordinate extends Message {
  constructor(coordinator) {
    super();
    this.type = "coordinate";
    this.coordinator = coordinator;
  }

  toJSON() {
    return {
      type: this.type,
      coordinator: this.coordinator
    };
  }
}

module.exports = Coordinate;
