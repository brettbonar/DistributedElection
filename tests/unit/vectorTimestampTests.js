const chai = require("chai");
const mocha = require("mocha");
const sinon = require("sinon");
const expect = chai.expect;

const VectorTimestamp = require("../../Messaging/VectorTimestamp");

describe("VectorTimestamp", function () {
  const PROCESS_A = "A";
  const PROCESS_B = "B";
  const PROCESS_C = "C";
  const PROCESSES = [PROCESS_A, PROCESS_B, PROCESS_C];
  const INITIALIZED_A = { "A": 0 };
  const INITIALIZED_ALL = { "A": 0 , "B": 0, "C": 0 };

  it("Initializes Self", function () {
    let timestampA = new VectorTimestamp(PROCESS_A);
    expect(timestampA.get()).to.eql(INITIALIZED_A);
  })
  it("Initializes Others", function () {
    let timestampA = new VectorTimestamp(PROCESS_A);
    timestampA.init(PROCESSES);
    expect(timestampA.get()).to.eql(INITIALIZED_ALL);
  })
  it("Updates Self", function () {
    let timestampA = new VectorTimestamp(PROCESS_A);
    timestampA.update();
    expect(timestampA.get()).to.eql({ "A": 1 });
    timestampA.update();
    expect(timestampA.get()).to.eql({ "A": 2 });
    timestampA.update();
    expect(timestampA.get()).to.eql({ "A": 3 });
  })
  it("Updates Others", function () {
    let timestampA = new VectorTimestamp(PROCESS_A);
    let timestampB = new VectorTimestamp(PROCESS_B);
    let timestampC = new VectorTimestamp(PROCESS_C);
    timestampA.init(PROCESSES);
    timestampB.init(PROCESSES);
    timestampC.init(PROCESSES);
  
    timestampA.update(timestampB.get());
    expect(timestampA.get()).to.eql({ "A": 1, "B": 0, "C": 0 });
    expect(timestampB.get()).to.eql({ "A": 0, "B": 0, "C": 0 });
    expect(timestampC.get()).to.eql({ "A": 0, "B": 0, "C": 0 });
    
    timestampB.update();
    timestampA.update(timestampB.get());
    expect(timestampA.get()).to.eql({ "A": 2, "B": 1, "C": 0 });
    expect(timestampB.get()).to.eql({ "A": 0, "B": 1, "C": 0 });
    expect(timestampC.get()).to.eql({ "A": 0, "B": 0, "C": 0 });
    
    timestampB.update(timestampA.get());
    expect(timestampA.get()).to.eql({ "A": 2, "B": 1, "C": 0 });
    expect(timestampB.get()).to.eql({ "A": 2, "B": 2, "C": 0 });
    expect(timestampC.get()).to.eql({ "A": 0, "B": 0, "C": 0 });

    timestampC.update(timestampA.get());
    expect(timestampA.get()).to.eql({ "A": 2, "B": 1, "C": 0 });
    expect(timestampB.get()).to.eql({ "A": 2, "B": 2, "C": 0 });
    expect(timestampC.get()).to.eql({ "A": 2, "B": 1, "C": 1 });
    
    timestampA.update(timestampC.get());
    expect(timestampA.get()).to.eql({ "A": 3, "B": 1, "C": 1 });
    expect(timestampB.get()).to.eql({ "A": 2, "B": 2, "C": 0 });
    expect(timestampC.get()).to.eql({ "A": 2, "B": 1, "C": 1 });

    timestampC.update();
    timestampB.update(timestampC.get());
    expect(timestampA.get()).to.eql({ "A": 3, "B": 1, "C": 1 });
    expect(timestampB.get()).to.eql({ "A": 2, "B": 3, "C": 2 });
    expect(timestampC.get()).to.eql({ "A": 2, "B": 1, "C": 2 });
  })
});
