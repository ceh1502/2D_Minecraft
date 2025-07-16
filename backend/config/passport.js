// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const Player = require('../models/Player');

// passport.serializeUser((player, done) => {
//   done(null, player.id);
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const player = await Player.findByPk(id);
//     done(null, player);
//   } catch (error) {
//     done(error, null);
//   }
// });

// passport.use(new GoogleStrategy({
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: '/api/auth/google/callback'
// }, async (accessToken, refreshToken, profile, done) => {
//   try {
//     let player = await Player.findOne({ where: { googleId: profile.id } });

//     if (!player) {
//       player = await Player.create({
//         googleId: profile.id,
//         name: profile.displayName,
//         email: profile.emails[0].value,
//         profilePicture: profile.photos[0].value
//       });
//     }

//     return done(null, player);
//   } catch (error) {
//     return done(error, null);
//   }
// }));

// module.exports = passport;
