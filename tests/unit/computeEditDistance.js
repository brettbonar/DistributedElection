const chai = require("chai");
const mocha = require("mocha");
const sinon = require("sinon");
const expect = chai.expect;

const computeEditDistance = require("../../computeEditDistance");

describe("computeEditDistance", function () {
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

  it("Computes Edit Distances", function () {
    for (let i = 0; i < testCases.length; i++) {
      expect(computeEditDistance(testCases[i].string1, testCases[i].string2)).to.eql(testCases[i].distance);
    }
  })
});
