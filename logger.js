"use strict";
const log4js = require("log4js");
let configured = false;

function configure(name) {
  log4js.configure({
    appenders: {
      file: { type: "file", filename: "./logs/" + name + ".log" },
      console: { type: "console" },
      "console-filter": { type: "logLevelFilter", level: "info", maxLevel: "error", appender: "console" }
    },
    categories: {
      default: { appenders: ["file", "console-filter"], level: "all" }
    }
  });
  configured = true;
}

function getLogger(name) {
  if (!configured) {
    configure(name);
  }
  return log4js.getLogger(name);
}

module.exports = {
  configure: configure,
  getLogger: getLogger
};
