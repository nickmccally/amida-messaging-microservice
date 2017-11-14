
import {
    Strategy as JwtStrategy,
    ExtractJwt,
} from 'passport-jwt';
import config from './config';

const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.jwtSecret,
    // passReqToCallback: true,
};

module.exports = (passport) => {
    passport.use(new JwtStrategy(opts, (jwtPayload, done) => done(null, jwtPayload)));
};

// module.exports = () => {
//     const jwtLogin = new JwtStrategy(jwtOptions, (req, payload, done) => {
//         console.log(payload);
//         done(null, payload);
//     });
//     passport.use(jwtLogin);
//     return {
//         initialize() {
//             return passport.initialize();
//         },
//         authenticate: passport.authenticate('jwt', { session: false }),
//     };
// };
