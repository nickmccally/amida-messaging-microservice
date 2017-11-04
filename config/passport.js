"use strict";
const passport = require("passport");
const config = require("./config");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwtSecret,
  passReqToCallback: true
};

module.exports = function() {
    const jwtLogin = new JwtStrategy(jwtOptions, function(req, payload, done) {
      done(null, payload);
    })
    passport.use(jwtLogin);
    return {
        initialize: function() {
            return passport.initialize();
        },
        authenticate: passport.authenticate("jwt", { session: false })
      };
};
