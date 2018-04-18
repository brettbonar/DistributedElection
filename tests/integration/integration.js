const chai = require("chai");
const mocha = require("mocha");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const _ = require("lodash");
const expect = chai.expect;
chai.should();
chai.use(sinonChai);

const Coordinator = require("../../Coordinator");
const DOA = require("../../DOA");
const EMR = require("../../EMR");
const HDS = require("../../HDS");

describe("Integration", function () {
  const COORDINATOR_IP = "localhost";
  const COORDINATOR_PORT = 12000;
  const CONFIG_PATH = "./tests/integration/coordinatorConfig.json";
  let coordinator = new Coordinator({ configuration: CONFIG_PATH });
  let doa = null;
  let emr = null;
  let hds = null;

  it("Coordinator Config Req-Rep", function (done) {
    doa = new DOA({ id: 1, type: "doa", coordinatorIp: COORDINATOR_IP, coordinatorPort: COORDINATOR_PORT });
    emr = new EMR({ id: 101, type: "emr", coordinatorIp: COORDINATOR_IP, coordinatorPort: COORDINATOR_PORT });
    hds = new HDS({ id: 10, type: "hds", coordinatorIp: COORDINATOR_IP, coordinatorPort: COORDINATOR_PORT });
    let spyDoaConfig = sinon.spy(doa, "handleConfig");
    let spyEmrConfig = sinon.spy(emr, "handleConfig");
    let spyHdsConfig = sinon.spy(hds, "handleConfig");
    let spyCoordinatorConfig = sinon.spy(coordinator, "getConfig");

    setTimeout(function () {
      expect(spyDoaConfig).to.have.been.calledOnce;
      expect(spyEmrConfig).to.have.been.calledOnce;
      expect(spyHdsConfig).to.have.been.calledOnce;
      expect(spyCoordinatorConfig).to.have.been.calledThrice;
      done();
    }, 1000);
  })
  
  it("Outbreak Req-Rep", function (done) {
    let spyEmrHandleOutbreakRep = sinon.spy(emr, "handleOutbreakRep");
    let spyHdsHandleOutbreakReq = sinon.spy(hds, "handleDiseaseOutbreakReq");

    emr.sendOutbreakReq();
    setTimeout(function () {
      expect(spyEmrHandleOutbreakRep).to.have.been.called;
      expect(spyHdsHandleOutbreakReq).to.have.been.called;
      done();
    }, 1000);
  })
  
  it("Disease Notification to Outbreak", function (done) {
    this.timeout(5000);
    let spyHdsNotification = sinon.spy(hds, "handleDiseaseNotification");
    let spyHdsPublish = sinon.spy(hds, "publishDiseases");
    let spyHdsOutbreak = sinon.spy(hds, "handleOutbreakNotification");
    
    let spyDoaUpdate = sinon.spy(doa, "onDiseaseUpdate");
    let spyDoaOutbreak = sinon.spy(doa, "notifyOutbreaks");

    emr.sendDiseaseNotification(emr.simulation.diseases[0]);
    setTimeout(function () {
      expect(_.sum(doa.diseaseCounts)).to.be.greaterThan(0);
      expect(spyHdsNotification).to.have.been.calledOnce;
      expect(spyHdsPublish).to.have.been.called;
      expect(spyDoaUpdate).to.have.been.calledOnce;
      expect(spyDoaOutbreak).to.have.been.calledOnce;
      expect(spyHdsOutbreak).to.have.been.calledOnce;
      done();
    }, 2000);
  })
});
