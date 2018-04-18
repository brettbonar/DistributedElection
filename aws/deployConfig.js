const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const q = require("q");

// Bucket names must be unique across all S3 users

var myBucket = 'bbonar-simulated-disease-surveillance';
var myKey = 'deployed.json';

function deployConfig(config) {
  let params = { Bucket: myBucket, Key: myKey, Body: JSON.stringify(config) };
  let deferred = q.defer();
  s3.putObject(params, function(err, data) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(data);
    }
  });

  return deferred.promise;
}

module.exports = deployConfig;
