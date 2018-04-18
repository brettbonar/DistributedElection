const _ = require("lodash");
const logger = require("../logger");

class VectorTimestamp {
  constructor(selfId) {
    this.id = selfId;
    this.timestamps = {
      [selfId]: 0
    };
    this.logger = logger.getLogger("VectorTimestamp");
  }
  
  init(processes) {
    _.each(processes, (pid) => {
      this.timestamps[pid] = 0;
    });
  }

  update(vectorTimestamps) {
    if (vectorTimestamps) {
      _.each(vectorTimestamps, (time, processId) => {
        this.timestamps[processId] = Math.max(this.timestamps[processId] || 0, time);
      });
    }
    this.timestamps[this.id] += 1;
    this.logger.debug(JSON.stringify(this.timestamps, null, 2));
  }

  get() { return this.timestamps; }
}

module.exports = VectorTimestamp;
