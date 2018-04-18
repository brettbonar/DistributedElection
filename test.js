const computeEditDistance = require("./computeEditDistance");
const Node = require("./Node");

let testCases = [
  {
    string1: "kitten",
    string2: "sitting",
    distance: 3
  },
  {
    string1: "Saturday",
    string2: "Sunday",
    distance: 3
  }
];

// for (let i = 0; i < testCases.length; i++) {
//   console.log(computeEditDistance(testCases[i].string1, testCases[i].string2));
// }

new Node({
  ip: "localhost",
  port: 3000
});
