const mongoose = require('mongoose');
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require('cors');
const path = require('path');
const contentDisposition = require('content-disposition');
const MessageWork = require('./models/messageWork');
const MessageFlud = require('./models/messageFlud');
const port = process.env.PORT || 5000;
const passport = require('passport');

require('./auth');

const Grid = require('gridfs-stream');
const fileType = require('file-type');
eval(`Grid.prototype.findOne = ${Grid.prototype.findOne.toString().replace('nextObject', 'next')}`);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'chat-client/build')));

app.post('/signup', passport.authenticate('signup', { session : false }) , async (req, res, next) => {
  console.log(req.user)
  res.json({
    message : 'Signup successful',
    user : req.user
  });
});

app.post('/login', async (req, res, next) => {
  passport.authenticate('login', async (err, user, info) => {
    try {
      if(err || !user){
        const error = new Error('An Error occurred')
        return next(error);
      }
      req.login(user, { session : false }, async (error) => {
        if( error ) return next(error)
        //We don't want to store the sensitive information such as the
        //user password in the token so we pick only the login and id
        const body = { _id : user._id, login : user.login };
        //Sign the JWT token and populate the payload with the user login and id
        const token = jwt.sign({ user : body },'top_secret');
        //Send back the token to the user
        return res.json({ token });
      });
    } catch (error) {
      return next(error);
    }
  })(req, res, next);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname+'/chat-client/build/index.html'));
});

async function start() {
  try {
    await mongoose.connect(
      // 'mongodb+srv://qwerty:qwerty12345@cluster0-dxfxz.mongodb.net/api?retryWrites=true&w=majority',
      'mongodb://arsen:3CUoIFONMpwdaM4a@cluster0-shard-00-00-mieoq.mongodb.net:27017,cluster0-shard-00-01-mieoq' +
      '.mongodb.net:27017,cluster0-shard-00-02-mieoq.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true&w=majority',
        {
        useCreateIndex: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false
      }
    );

    const conn = mongoose.connection;
    Grid.mongo = mongoose.mongo;
    const gfs = Grid(conn.db);
    const server = http.createServer(app);
    const io = socketIo(server);

    io.on('connection', (client) => {
      let room;

      client.on('join', (num) => {
        room = `room${num}`;
        client.join(`room${num}`);
        const getMessages = async () => {
          if (room === 'room0') {
            const res = await MessageWork.find();
            io.to(room).emit('allMessages', res);
          } else {
            const res = await MessageFlud.find();
            io.to(room).emit('allMessages', res);
          }
        }
        getMessages()
      });

      client.on('chat message', async (message) => {
        let res;
        if (message.file) {
          let writeStream = gfs.createWriteStream({
            filename: message.fileName,
            mode: 'w',
            content_type: message.fileType
          });
          writeStream.on('close', async (uploadedFile) => {
            if (room === 'room0') {
              const messageData = new MessageWork({
                userName: message.userName,
                messageText: message.messageText,
                doc_id: uploadedFile._id,
                length: uploadedFile.length,
                name: message.fileName,
                type: message.fileType,
                file_link: `/download?document_id=${uploadedFile._id}`
              });
              res = await messageData.save();
              io.to(room).emit('chat message', res);
            } else {
              const messageData = new MessageFlud({
                userName: message.userName,
                messageText: message.messageText,
                doc_id: uploadedFile._id,
                length: uploadedFile.length,
                name: message.fileName,
                type: message.fileType,
                file_link: `/download?document_id=${uploadedFile._id}`
              });
              res = await messageData.save();
              io.to(room).emit('chat message', res);
            }
          });
          writeStream.write(message.file)
          writeStream.end();
        } else {
          if (room === 'room0') {
            const messageData = new MessageWork({
              userName: message.userName,
              messageText: message.messageText,
            });
            res = await messageData.save();
            io.to(room).emit('chat message', res);
          } else {
            const messageData = new MessageFlud({
              userName: message.userName,
              messageText: message.messageText,
            });
            res = await messageData.save();
            io.to(room).emit('chat message', res);
          }
        }
      });
    });

    app.get('/download', (req, res, next) => {
      passport.authenticate('jwt', { session : false }, (err, user, info) => {
        const {
          document_id
        } = req.query;
        gfs.findOne({
          _id: document_id
        }, (err, file) => {
          if (!file) {
            return res.status(404).send({
              message: 'File was not found'
            });
          }
          let data = [];
          let readstream = gfs.createReadStream({
            filename: file.filename
          });
          readstream.on('data', (chunk) => {
            data.push(chunk);
          });
          readstream.on('end', async () => {
            data = Buffer.concat(data);
            let type = await fileType.fromBuffer(data);
            res.writeHead(200, {
              'Content-Type': type.mime,
              'Content-disposition': contentDisposition(file.filename),
              'Content-Length': file.length
            });
            res.end(data);
          });
          readstream.on('error', (err) => {
            // logger.error(`[*] Error, while downloading a file, with error:  ${err}`);
            res.status(400).send({
              message: `Error, while downloading a file, with error:  ${err}`
            });
          });
        });
      })(req, res, next);
    });

    app.delete('/messagework/:id', async (req, res, next) => {
      passport.authenticate('jwt', { session : false }, async (err, user, info) => {
        const {
          id
        } = req.params;
        await MessageWork.findOneAndRemove({_id: id}, (err, message) => {
          if (message) {
            if(err) {
              res.send('error removing')
            } else {
              if (message.doc_id) {
                gfs.findOne({
                  _id: message.doc_id
                }, (err, file) => {
                  if (!file) {
                    return res.status(404).send({
                      message: 'File was not found'
                    });
                  }
                  gfs.remove({ _id: file._id });
                });
              }
              res.status(200).send(message);
            }
          }
        });
      })(req, res, next);
    });

    app.delete('/messageflud/:id', async (req, res, next) => {
      passport.authenticate('jwt', { session : false }, async (err, user, info) => {
        const {
          id
        } = req.params;
        await MessageFlud.findOneAndRemove({_id: id}, (err, message) => {
          if(err) {
            res.send('error removing')
          } else {
            if (message.doc_id) {
              gfs.findOne({
                _id: message.doc_id
              }, (err, file) => {
                if (!file) {
                  return res.status(404).send({
                    message: 'File was not found'
                  });
                }
                gfs.remove({ _id: file._id });
              });
            }
            res.status(200).send(message);
          }
        });
      })(req, res, next);
    });

    app.put('/messageflud/:id', async (req, res, next) => {
      passport.authenticate('jwt', { session : false }, async (err, user, info) => {
        const {
          id
        } = req.params;
        const changedMessage = await MessageFlud.findOneAndUpdate(
          {
            _id: id
          },
          req.body,
          { upsert: true },
          function(error, response) {
            return response;
          }
        );
        res.send(changedMessage);
      })(req, res, next);
    });

    app.put('/messagework/:id', async (req, res, next) => {
      passport.authenticate('jwt', { session : false }, async (err, user, info) => {
        const {
          id
        } = req.params;
        const changedMessage = await MessageWork.findOneAndUpdate(
          {
            _id: id
          },
          req.body,
          { upsert: true },
          function(error, response) {
            return response;
          }
        );
        res.send(changedMessage);
      })(req, res, next);
    });

    server.listen(port, () => console.log(`Listening on port ${port}`));
  } catch (error) {
    console.log(error);
  }
}

start();
