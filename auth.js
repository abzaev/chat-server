
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const UserModel = require('./models/user');

passport.use('signup', new localStrategy({
  usernameField : 'login',
  passwordField : 'password'
}, async (login, password, done) => {
    try {
      const user = await UserModel.create({ login, password });

      return done(null, user);
    } catch (error) {
      done(error);
    }
}));

passport.use('login', new localStrategy({
  usernameField : 'login',
  passwordField : 'password'
}, async (login, password, done) => {
  try {

    const user = await UserModel.findOne({ login });
    if( !user ){

      return done(null, false, { message : 'User not found'});
    }

    const validate = await user.isValidPassword(password);
    if( !validate ){
      return done(null, false, { message : 'Wrong Password'});
    }

    return done(null, user, { message : 'Logged in Successfully'});
  } catch (error) {
    return done(error);
  }
}));

const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;

passport.use(new JWTstrategy({
  secretOrKey : 'top_secret',
  jwtFromRequest : (req) => cookieExtractor(req),
}, async (token, done) => {
  try {
    return done(null, token.user);
  } catch (error) {
    done(error);
  }
}));

var cookieExtractor = function(req) {
  var token = null;
  if (req && req.headers.cookie)
  {
      token = parseCookies(req)['jwt'];
  }
  return token;
};

function parseCookies (request) {
  var list = {},
      rc = request.headers.cookie;

  rc && rc.split(';').forEach(function( cookie ) {
      var parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
  });

  return list;
}
