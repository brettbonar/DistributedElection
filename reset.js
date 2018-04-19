const q = require("q");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);

const S3_BUCKET = "distributed-election-run";
const S3_RESULTS_BUCKET = "string-pair-results";
const S3_PENDING_BUCKET = "string-pair-pending";

function clearBucket(bucket) {
  return s3.listObjects({ Bucket: bucket }).promise()
    .then((data) => {
      let promises = [];
      for (let i = 0; i < data.Contents.length; i++) {
        let deferred = q.defer();
        promises.push(s3.deleteObject({
          Bucket: bucket,
          Key: data.Contents[i].Key
        }).promise());
      }
      return q.all(promises);
    })
    .catch((er) => console.log(er));
}

q.all([clearBucket(S3_BUCKET), clearBucket(S3_RESULTS_BUCKET), clearBucket(S3_PENDING_BUCKET)])
  .then(() => console.log("Finished deleting"));
  