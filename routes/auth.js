const {Router } = require('express')
const passport = require('passport')
const jwt = require('jsonwebtoken')
const router = Router()

router.get(
  '/auth',
  async (req, res, next) => {
    passport.authenticate(
      'jwt',
      async (err, user, info) => {
        try {
          if (err || !user) {
            const error = new Error('An error occurred.');

            return next(error);
          }
          res.json(user)
        } catch (error) {
          return next(error);
        }
      }
    )(req, res, next);
  }
);
  
router.post('/signup', passport.authenticate('signup', { session : false }) , async (req, res, next) => {
  const data = {
    id: req.user._id,
    login: req.user.login
  }
  res.json(data);
});

router.post('/login', async (req, res, next) => {
  passport.authenticate('login', async (err, user, info) => {
    try {
      if(err || !user){
        const error = new Error('An Error occurred')
        return next(error);
      }
      req.login(user, { session : false }, async (error) => {
        if( error ) return next(error)
        const body = { id : user._id, login : user.login };
        const token = jwt.sign({ user : body },'top_secret');
         res.cookie('jwt', token);
        return res.json(body);
      });
    } catch (error) {
      return next(error);
    }
  })(req, res, next);
});

module.exports = router;