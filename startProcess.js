const options = require("commander");
const Node = require("./Node");

options
  .option("-ip, --i <f>", "IP address")
  .option("-port, --p <f>", "Port")
  .parse(process.argv);

let proc = new Node({
  ip: "localhost",
  port: 3000
});
