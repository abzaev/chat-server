
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const UserModel = require('./models/user');

//Create a passport middleware to handle user registration
passport.use('signup', new localStrategy({
  usernameField : 'login',
  passwordField : 'password'
}, async (login, password, done) => {
    try {
      //Save the information provided by the user to the the database
      const user = await UserModel.create({ login, password });
      //Send the user information to the next middleware
      return done(null, user);
    } catch (error) {
      done(error);
    }
}));

//Create a passport middleware to handle User login
passport.use('login', new localStrategy({
  usernameField : 'login',
  passwordField : 'password'
}, async (login, password, done) => {
  try {
    //Find the user associated with the login provided by the user
    const user = await UserModel.findOne({ login });
    if( !user ){
      //If the user isn't found in the database, return a message
      return done(null, false, { message : 'User not found'});
    }
    //Validate password and make sure it matches with the corresponding hash stored in the database
    //If the passwords match, it returns a value of true.
    const validate = await user.isValidPassword(password);
    if( !validate ){
      return done(null, false, { message : 'Wrong Password'});
    }
    //Send the user information to the next middleware
    return done(null, user, { message : 'Logged in Successfully'});
  } catch (error) {
    return done(error);
  }
}));

const JWTstrategy = require('passport-jwt').Strategy;
//We use this to extract the JWT sent by the user
const ExtractJWT = require('passport-jwt').ExtractJwt;

//This verifies that the token sent by the user is valid
passport.use(new JWTstrategy({
  //secret we used to sign our JWT
  secretOrKey : 'top_secret',
  //we expect the user to send the token as a query parameter with the name 'secret_token'
  jwtFromRequest : (req) => cookieExtractor(req),
}, async (token, done) => {
  console.log(token)
  try {
    //Pass the user details to the next middleware
    return done(null, token.user);
  } catch (error) {
    done(error);
  }
}));

var cookieExtractor = function(req) {
  var token = null;
  if (req && req.headers.cookie)
  {
      token = parseCookies(req)['io'];
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