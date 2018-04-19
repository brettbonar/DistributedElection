const fs = require("fs");
const chai = require("chai");
const mocha = require("mocha");
const sinon = require("sinon");
const expect = chai.expect;

const computeEditDistance = require("../../computeEditDistance");

describe("computeEditDistance", function () {
  let testCases = [
    {
      file: "./tests/unit/StringPairs/StringPair-00000.txt",
      distance: 948
    },
    {
      file: "./tests/unit/StringPairs/StringPair-00001.txt",
      distance: 1033
    },
    {
      file: "./tests/unit/StringPairs/StringPair-00002.txt",
      distance: 1248
    },
    {
      file: "./tests/unit/StringPairs/StringPair-00003.txt",
      distance: 1006
    },
    {
      file: "./tests/unit/StringPairs/StringPair-00004.txt",
      distance: 1183
    }
  ];

  it("Computes Edit Distances", function () {
    this.timeout(30000);
    for (let i = 0; i < testCases.length; i++) {
      let strings = fs.readFileSync(testCases[i].file).toString().split("\n");
      expect(computeEditDistance(strings[0], strings[1])).to.eql(testCases[i].distance);
    }
  })
});
