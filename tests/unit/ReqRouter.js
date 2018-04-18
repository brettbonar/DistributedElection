const chai = require("chai");
const mocha = require("mocha");
const sinon = require("sinon");
const expect = chai.expect;

const Req = require("../../Messaging/Req");
const Router = require("../../Messaging/Router");

describe("Req-Router", function () {
  const CONNECTION = { ip: "localhost", port: 12000 };
  const MESSAGE_REQUEST = { "Request": "This is a request" };
  const MESSAGE_REPLY = { "Reply": "This is a reply" };

  it("Requests and Replies", function (done) {
    let req = new Req(CONNECTION);
    let router = new Router(CONNECTION);

    req.on(function (data) {
      expect(data).to.eql(MESSAGE_REPLY);
      router.close();
      req.close();
      done();
    });

    router.on(function (data, sender) {
      expect(data).to.eql(MESSAGE_REQUEST);
      router.send(MESSAGE_REPLY, sender);
    });
    
    req.send(MESSAGE_REQUEST);
  })
  
  it("Handles Multiple Requestors", function (done) {
    let req1 = new Req(CONNECTION);
    let req2 = new Req(CONNECTION);
    let router = new Router(CONNECTION);

    let req1done = false;
    let req2done = false;

    req1.on(function (data) {
      expect(data).to.eql(MESSAGE_REPLY);
      req1done = true;
      if (req1done === true && req2done === true) {
        done();
      }
    });
    req2.on(function (data) {
      expect(data).to.eql(MESSAGE_REPLY);
      req2done = true;
      if (req1done === true && req2done === true) {
        done();
      }
    });

    router.on(function (data, sender) {
      expect(data).to.eql(MESSAGE_REQUEST);
      router.send(MESSAGE_REPLY, sender);
    });
    
    req1.send(MESSAGE_REQUEST);
    req2.send(MESSAGE_REQUEST);
  })
});
