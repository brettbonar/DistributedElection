const Message = require("./Message");

class SubmitWork extends Message {
  constructor(strings, distance) {
    this.type = "submitWork";
    this.strings = strings;
    this.distance = distance;
  }

  toJSON() {
    return {
      type: this.type,
      strings: this.strings,
      distance: this.distance
    };
  }
}

module.exports = SubmitWork;
