const { Router } = require('express')
const passport = require('passport')
const MessageWork = require('../models/messageWork')
const router = Router()

router.delete('/messagework/:id', async (req, res, next) => {
  passport.authenticate('jwt', async (err, user, info) => {
    const {
      id
    } = req.params;
    const gfs = req.app.get('gfs');
    try {
      if(err || !user){
        const error = new Error('An Error occurred')
        return next(error);
      }

      await MessageWork.findOneAndRemove({_id: id, userId: user.id}, (err, message) => {
        if(err || message===null) {
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

    } catch (error) {
      return next(error);
    }
  })(req, res, next)
});

router.put('/messagework/:id', async (req, res, next) => {
  passport.authenticate('jwt', async (err, user, info) => {
    try {
      if(err || !user){
        const error = new Error('An Error occurred')
        return next(error);
      }
      
        const body = { id : user.id, login : user.login };
        const {
          id
        } = req.params;
        const changedMessage = await MessageWork.findOneAndUpdate(
          {
            _id: id,
            userId: body.id
          },
          req.body,
          { upsert: true },
          function(error, response) {
            return response;
          }
        );
        res.send(changedMessage);
    } catch (error) {
      return next(error);
    }
  })(req, res, next)
});
  

module.exports = router