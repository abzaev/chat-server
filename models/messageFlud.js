const { Schema, model } = require('mongoose');

const messageWorkSchema = new Schema({
  userName: {
    type: String,
    required: true
  },
  messageText: {
    type: String,
    required: true
  },
  // file: {
  //   type: Buffer,
  //   required: true,
  // },
  doc_id: {
    type: String
  },
  length : {
    type: Number
  },
  name: {
    type: String
  },
  type: {
    type: String
  },
  file_link: {
    type: String
  }
});

module.exports = model('MessageFlud', messageWorkSchema);
