const q = require("q");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);

const S3_SOURCE_BUCKET = "distributed-election";

function getDirectoryListing(bucket, directory) {
  let params = {
    Bucket: bucket
  };
  if (directory) {
    params.Prefix = directory + "/";
    params.Delimiter = "/";
    params.StartAfter = "string-pairs/StringPair-00599"
  }

  return s3.listObjectsV2(params).promise().then((data) => {
    return data.Contents;
  });
}

getDirectoryListing(S3_SOURCE_BUCKET)
  .then((results) => {
    for (const result of results) {
      if (result.Key.indexOf(".") > 0) {
        s3.deleteObject({
          Bucket: S3_SOURCE_BUCKET,
          Key: result.Key
        }).promise().then(() => console.log("Deleted", result.Key))
        .catch(() => console.log("Failed to delete", result.Key));
      }
    }
  });
