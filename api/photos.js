/*
 * API sub-router for businesses collection endpoints.
 */

const router = require('express').Router();

const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');

const { connectToRabbitMQ, getChannel } = require('../lib/rabbitmq');
const { getImageInfoById, saveImageFile, getDownloadStreamByFilename, getDownloadStreamById } = require('../models/photo');

const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

const upload = multer({
  storage: multer.diskStorage({
    destination: `${__dirname}/uploads`,
    filename: (req, file, callback) => {
      const basename = crypto.pseudoRandomBytes(16).toString('hex');
      const extension = imageTypes[file.mimetype];
      callback(null, `${basename}.${extension}`);
    }
  }),
  fileFilter: (req, file, callback) => {
    callback(null, !!imageTypes[file.mimetype])
  }
});

function removeUploadedFile (file) {
  return new Promise((resolve, reject) => {
    fs.unlink(file.path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/*
 * Route to create a new photo.
 */
router.post('/', upload.single('image'), async (req, res, next) => {
  if (req.file && req.body && req.body.businessId) {
    try {
      const image = {
        path: req.file.path,
        filename: req.file.filename,
        contentType: req.file.mimetype,
        businessId: req.body.businessId,
        caption: req.body.caption
      };
      await connectToRabbitMQ('images');
      const id = await saveImageFile(image);
      await removeUploadedFile(req.file);

      const channel = getChannel();
      channel.sendToQueue('images', Buffer.from(id.toString()));

      res.status(200).send({ id: id });
    } catch (err) {
      next(err);
    }
  } else {
    res.status(400).send({
      err: "Request body was invalid"
    });
  }
});

/*
 * Route to fetch info about a specific photo.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const image = await getImageInfoById(req.params.id);
    if (image) {
      const responseBody = {
        _id: image._id,
        orig: `photos/media/images/${image._id}-orig.jpg`,
        "128": `photos/media/images/${image._id}-128.jpg`,
        "256": `photos/media/images/${image._id}-256.jpg`,
        "640": `photos/media/images/${image._id}-640.jpg`,
        "1024": `photos/media/images/${image._id}-1024.jpg`,
        contentType: image.metadata.contentType,
        businessId: image.metadata.businessId,
        caption: req.body.caption
      };
      res.status(200).send(responseBody);
    } else {
      next();
    }
  } catch (err) {
    next(err);
  }
});

router.get('/media/images/:filename', async (req, res, next) => {
  const filename = req.params.filename.split("-")[0];
  const filesize = req.params.filename.split("-")[1].split(".")[0];

  const image = await getImageInfoById(filename);

  if (image) {
    const imageId = image.metadata[filesize];
    if (imageId) {
      getDownloadStreamById(imageId)
        .on('error', (err) => {
          if (err.code === 'ENOENT') {
            next();
          } else {
            next(err);
          }
        })
        .on('file', (file) => {
          res.status(200).type(file.metadata.contentType);
        })
        .pipe(res);
    } else {
      res.status(404).send({
        err: "Image size not available to download"
      });
    }
  } else {
    next();
  }
});

module.exports = router;
