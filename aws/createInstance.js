// Load the SDK for JavaScript
const AWS = require("aws-sdk");
const q = require("q");

// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require('Q').Promise);

// Create EC2 service object
const ec2 = new AWS.EC2({apiVersion: "2016-11-15"});

function createInstance(process) {// AMI is amzn-ami-2011.09.1.x86_64-ebs
  let instanceParams = {
    LaunchTemplate: {
      LaunchTemplateId: "lt-0cc28780ae8ae79e3"
    },
    // ImageId: "ami-a533bcdd", 
    // InstanceType: "t2.micro",
    // SecurityGroups: [
    //   "simulated-disease-surveillance"
    // ],
    // IamInstanceProfile: {
    //   Name: "simulated-disease-surveillance"
    // },
    // KeyName: "bbonar",
    MinCount: 1,
    MaxCount: 1
    //InstanceInitiatedShutdownBehavior: stop | terminate,
  };

  let deferred = new q.defer();
  
  // Create a promise on an EC2 service object
  let instancePromise = new AWS.EC2({apiVersion: "2016-11-15"}).runInstances(instanceParams).promise();
  
  // Handle promise's fulfilled/rejected states
  instancePromise.then(
    function(data) {
      let instance = data.Instances[0];
      let instanceId = data.Instances[0].InstanceId;
      // Add tags to the instance
      tagParams = {Resources: [instanceId], Tags: [
         {
            Key: "SDS",
            Value: "simulated-disease-surveillance"
         },
         {
           Key: "Name",
           Value: process.id
         }
      ]};

      let waitParams = {
        InstanceIds: [
          instanceId
        ]
      };
      // Create a promise on an EC2 service object
      let tagPromise = new AWS.EC2({apiVersion: "2016-11-15"}).createTags(tagParams).promise();
      let runningPromise = new AWS.EC2({apiVersion: "2016-11-15"}).waitFor("instanceRunning", waitParams).promise();
      // Handle promise's fulfilled/rejected states
      q.all([tagPromise, runningPromise]).then(
        function(data) {
          console.log("Instance tagged and running:", process.id, instanceId);
          deferred.resolve(data[1].Reservations[0].Instances[0]);
        }).catch(function(err) {
          deferred.reject(err);
          console.error(err, err.stack);
        });
    }).catch(
      function(err) {
      console.error(err, err.stack);
    });

    return deferred.promise;
}

module.exports = createInstance;
