const Message = require("./Message");

class SubmitWork extends Message {
  constructor(stringPairKey, distance) {
    super();
    this.type = "submitWork";
    this.stringPairKey = stringPairKey;
    this.distance = distance;
  }

  toJSON() {
    return {
      type: this.type,
      stringPairKey: this.stringPairKey,
      distance: this.distance
    };
  }
}

module.exports = SubmitWork;
