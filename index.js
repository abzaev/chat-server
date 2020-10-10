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
const authRoutes = require('./routes/auth')
const messageWorkRoutes = require('./routes/messageWork')
const messageFludRoutes = require('./routes/messageFluld')

require('./auth');

const Grid = require('gridfs-stream');
const fileType = require('file-type');
eval(`Grid.prototype.findOne = ${Grid.prototype.findOne.toString().replace('nextObject', 'next')}`);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'chat-client/build')));

app.use('/', authRoutes)

async function start() {
  try {
    await mongoose.connect(
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
    
    app.set('gfs', gfs)

    app.use('/', messageWorkRoutes)
    app.use('/', messageFludRoutes)

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
          writeStream.on("error", (error) => console.log(error));

          writeStream.on('close', async (uploadedFile) => {
            if (room === 'room0') {
              const messageData = new MessageWork({
                userLogin: message.userLogin,
                userId: message.userId,
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
                userLogin: message.userLogin,
                userId: message.userId,
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
              userLogin: message.userLogin,
              userId: message.userId,
              messageText: message.messageText,
            });
            res = await messageData.save();
            io.to(room).emit('chat message', res);
          } else {
            const messageData = new MessageFlud({
              userLogin: message.userLogin,
              userId: message.userId,
              messageText: message.messageText,
            });
            res = await messageData.save();
            io.to(room).emit('chat message', res);
          }
        }
      });
    });

    app.get('/download', async (req, res, next) => {
      passport.authenticate('jwt', async (err, user, info) => {      
        const {
          document_id
        } = req.query;
        try {
          if(err || !user){
            const error = new Error('An Error occurred')
            return next(error);
          }

          gfs.findOne({
            _id: document_id
          },
          (err, file) => {
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
              res.status(400).send({
                message: `Error, while downloading a file, with error:  ${err}`
              });
            });
          });
        } catch (error) {
          return next(error);
        }
      })(req, res, next)
    });

    server.listen(port, () => console.log(`Listening on port ${port}`));
  } catch (error) {
    console.log(error);
  }
}

start();
