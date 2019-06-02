const sizeOf = require('image-size');
const jimp = require('jimp');
const fs = require('fs');

const { connectToDB } = require('./lib/mongo');
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq');
const { saveImageFile, getDownloadStreamById, updateImageResizedById } = require('./models/photo');

const amqp = require('amqplib/callback_api');

const rabbitmqHost = process.env.RABBITMQ_HOST;
const rabbitmqUrl = `amqp://${rabbitmqHost}`;

var amqpConn = null;

function removeUploadedFile (path) {
  return new Promise((resolve, reject) => {
    fs.unlink(path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function closeOnErr(err) {
  if (!err) return false;
  console.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

function start() {
  amqp.connect(rabbitmqUrl + "?heartbeat=60", function(err, conn) {
    if (err) {
      console.error("[AMQP]", err.message);
      return setTimeout(start, 7000);
    }
    conn.on("error", function(err) {
      if (err.message !== "Connection closing") {
        console.error("[AMQP] conn error", err.message);
      }
    });
    conn.on("close", function() {
      console.error("[AMQP] reconnecting");
      return setTimeout(start, 7000);
    });

    console.log("[AMQP] connected");
    amqpConn = conn;
    connectToDB(main);
  });
}


async function main() {
  try {
    amqpConn.createChannel(function(err, ch) {
      if (closeOnErr(err)) return;
      ch.on("error", function(err) {
        console.error("[AMQP] channel error", err.message);
      });
      ch.on("close", function() {
        console.log("[AMQP] channel closed");
      });
      ch.assertQueue("images", { durable: true }, async function(err, _ok) {
        if (closeOnErr(err)) return;
        ch.consume('images', (msg) => {
          if (msg) {
            const id = msg.content.toString();
            const downloadStream = getDownloadStreamById(id);
            const imageData = [];
            downloadStream.on('data', (data) => {
              imageData.push(data);
            });
            downloadStream.on('end', async () => {
              const dimensions = sizeOf(Buffer.concat(imageData));
              jimp.read(Buffer.concat(imageData), (err, lenna) => {
                const sizes = [128, 256, 640, 1024];
                const quality = 60;

                if (err) throw err;

                lenna
                  .resize(dimensions.width, dimensions.height)
                  .quality(60)
                  .greyscale()
                  .write('./uploads/' + id + "_orig.jpg");

                sizes.forEach(function (size) {
                  lenna
                    .resize(size, size)
                    .quality(60)
                    .greyscale()
                    .write('./uploads/' + id + "_" + size + '.jpg');
                });
              });

              if (dimensions.type === 'jpg') {
                const result = await updateImageResizedById(id, "orig", id);
                await removeUploadedFile(`./uploads/${id}_orig.jpg`);
              } else {
                try {
                  const image = {
                    path: `./uploads/${id}_orig.jpg`,
                    filename: `${id}_orig.jpg`,
                    contentType: 'image/jpeg',
                  };
                  const resizedId = await saveImageFile(image);
                  await removeUploadedFile(image.path);
                  const result = await updateImageResizedById(id, "orig", resizedId);
                } catch (err) {
                  console.error(err);
                }
              }

              if (dimensions.width > 1024 && dimensions.height > 1024) {
                try {
                  const image = {
                    path: `./uploads/${id}_1024.jpg`,
                    filename: `${id}_1024.jpg`,
                    contentType: 'image/jpeg',
                  };
                  const resizedId = await saveImageFile(image);
                  await removeUploadedFile(`./uploads/${id}_1024.jpg`);
                  const result = await updateImageResizedById(id, "1024", resizedId);
                } catch (err) {
                  console.error(err);
                }
              } else {
                await removeUploadedFile(`./uploads/${id}_1024.jpg`);
              }

              if (dimensions.width > 640 && dimensions.height > 640) {
                try {
                  const image = {
                    path: `./uploads/${id}_640.jpg`,
                    filename: `${id}_640.jpg`,
                    contentType: 'image/jpeg',
                  };
                  const resizedId = await saveImageFile(image);
                  await removeUploadedFile(`./uploads/${id}_640.jpg`);
                  const result = await updateImageResizedById(id, "640", resizedId);
                } catch (err) {
                  console.error(err);
                }
              } else {
                await removeUploadedFile(`./uploads/${id}_640.jpg`);
              }

              if (dimensions.width > 256 && dimensions.height > 256) {
                try {
                  const image = {
                    path: `./uploads/${id}_256.jpg`,
                    filename: `${id}_256.jpg`,
                    contentType: 'image/jpeg',
                  };
                  const resizedId = await saveImageFile(image);
                  await removeUploadedFile(image.path);
                  const result = await updateImageResizedById(id, "256", resizedId);
                } catch (err) {
                  console.error(err);
                }
              } else {
                await removeUploadedFile(`./uploads/${id}_256.jpg`);
              }

              if (dimensions.width > 128 && dimensions.height > 128) {
                try {
                  const image = {
                    path: `./uploads/${id}_128.jpg`,
                    filename: `${id}_128.jpg`,
                    contentType: 'image/jpeg',
                  };
                  const resizedId = await saveImageFile(image);
                  await removeUploadedFile(image.path);
                  const result = await updateImageResizedById(id, "128", resizedId);
                } catch (err) {
                  console.error(err);
                }
              } else {
                await removeUploadedFile(`./uploads/${id}_128.jpg`);
              }
            });
          }
          ch.ack(msg);
        }, { noAck: false });
      });
    });
  } catch (err) {
    console.error(err);
  }
}
start();
