/*
 * Photo schema and data accessor methods.
 */
const fs = require('fs');

const { ObjectId, GridFSBucket } = require('mongodb');

const { getDBReference } = require('../lib/mongo');

exports.saveImageFile = function (image) {
  return new Promise((resolve, reject) => {
    const db = getDBReference();
    const bucket = new GridFSBucket(db, { bucketName: 'images' });

    const metadata = {
      contentType: image.contentType,
      businessId: image.businessId,
      caption: image.caption
    };

    const uploadStream = bucket.openUploadStream(
      image.filename,
      { metadata: metadata }
    );

    fs.createReadStream(image.path)
      .pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id);
      });
  });
};

exports.getImageInfoById = async function (id) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, { bucketName: 'images' });
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    const results = await bucket.find({ _id: new ObjectId(id) })
      .toArray();
    return results[0];
  }
};

exports.getBusinessPhotosInfoById = async function (businessId) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, { bucketName: 'images' });
  if (!ObjectId.isValid(businessId)) {
    return null;
  } else {
    const id = businessId.toString();
    const results = await bucket.find({ "metadata.businessId": id })
      .toArray();
    return results;
  }
}

exports.getDownloadStreamByFilename = function (filename) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, { bucketName: 'images' });
  return bucket.openDownloadStreamByName(filename);
};

exports.getDownloadStreamById = function (id) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, { bucketName: 'images' });
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    return bucket.openDownloadStream(new ObjectId(id));
  }
};

exports.updateImageResizedById = async function (id, size, resizedId) {
  const db = getDBReference();
  const collection = db.collection('images.files');
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    if (size === "orig") {
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { "metadata.orig": resizedId }}
      );
      return result.matchedCount > 0;
    } else if (size === "1024") {
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { "metadata.1024": resizedId }}
      );
      return result.matchedCount > 0;
    } else if (size === "640") {
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { "metadata.640": resizedId }}
      );
      return result.matchedCount > 0;
    } else if (size === "256") {
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { "metadata.256": resizedId }}
      );
      return result.matchedCount > 0;
    } else if (size === "128") {
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { "metadata.128": resizedId }}
      );
      return result.matchedCount > 0;
    } else {
      return 0;
    }
  }
};
