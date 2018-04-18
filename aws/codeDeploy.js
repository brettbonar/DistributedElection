const AWS = require('aws-sdk');
const codedeploy = new AWS.CodeDeploy({ region: 'us-west-2'});
const q = require("q");

function codeDeploy() {
  var params = {
    applicationName: 'simulated-disease-surveillance', /* required */
    autoRollbackConfiguration: {
      enabled: false,
      // events: [
      //   DEPLOYMENT_FAILURE | DEPLOYMENT_STOP_ON_ALARM | DEPLOYMENT_STOP_ON_REQUEST,
      //   /* more items */
      // ]
    },
    deploymentConfigName: 'CodeDeployDefault.AllAtOnce',
    deploymentGroupName: 'SDS',
    //description: 'STRING_VALUE',
    fileExistsBehavior: "OVERWRITE",//DISALLOW | OVERWRITE | RETAIN,
    ignoreApplicationStopFailures: true,//true || false,
    revision: {
      gitHubLocation: {
        commitId: 'a61716d4d0ce4831a83a1f6e1e65d01ea35dcd42',
        repository: 'brettbonar/SimulatedDiseaseSurveillance'
      },
      revisionType: "GitHub",
    },
  };

  let deferred = q.defer();
  codedeploy.createDeployment(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
    
    var params = {
      deploymentId: data.deploymentId /* required */
    };
    codedeploy.waitFor('deploymentSuccessful', params, function(err, data) {
      if (err) deferred.reject(err);
      else     deferred.resolve(data);
    });
  });

  return deferred.promise;
}

module.exports = codeDeploy;
