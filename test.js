const q = require("q");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);

const S3_RESULTS_BUCKET = "string-pair-results";
const S3_PENDING_BUCKET = "string-pair-pending";

function getDirectoryListing(bucket, directory) {
  let params = {
    Bucket: bucket
  };
  if (directory) {
    params.Prefix = directory + "/";
    params.Delimiter = "/";
  }

  return s3.listObjects(params).promise().then((data) => {
    return data.Contents;
  });
}

getDirectoryListing(S3_PENDING_BUCKET).then((results) => console.log(results));
