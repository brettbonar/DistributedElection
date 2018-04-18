const options = require("commander");
const Process = require("./Process");

options
  .option("-ip, --i <f>", "IP address")
  .option("-port, --p <f>", "Port")
  .parse(process.argv);

let proc = new Process({
  ip: options.ip || "localhost",
  port: options.port || 3000
});
