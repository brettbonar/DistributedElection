const q = require("q");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
// Set the region 
AWS.config.update({region: "us-west-2"});
// Use Q implementation of Promise
AWS.config.setPromisesDependency(require("q").Promise);

const S3_BUCKET = "distributed-election-run";
let promises = [];

let params = {
  Bucket: S3_BUCKET
};
s3.listObjects(params).promise()
  .then((data) => {
    for (let i = 0; i < data.Contents.length; i++) {
      let deferred = q.defer();
      promises.push(s3.deleteObject({
        Bucket: S3_BUCKET,
        Key: data.Contents[i].Key
      }).promise());
    }
    q.all(promises).then(() => console.log("Finished deleting"));
  })
  .catch((er) => console.log(er));

