const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getDB } = require('./config/db');
const { signUser } = require('./utils/jwt'); // 👈 dùng chung
// không cần jwt ở đây nếu chỉ dùng signUser

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost/final/frontend';

function initSocial(app) {
  app.use(passport.initialize());

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: 'http://localhost:8080/api/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const db = getDB();
            const email = (profile.emails?.[0]?.value || '').toLowerCase();

            let user;

            const [[foundByG]] = await db.query(
              'SELECT * FROM users WHERE google_id=?',
              [profile.id]
            );
            user = foundByG;

            if (!user && email) {
              const [[foundByEmail]] = await db.query(
                'SELECT * FROM users WHERE email=?',
                [email]
              );
              user = foundByEmail;
            }

            if (!user) {
              const [ins] = await db.query(
                `INSERT INTO users(email, full_name, provider, google_id, role, loyalty_points, created_at, updated_at)
                 VALUES (?,?,?,?, 'customer', 0, NOW(), NOW())`,
                [email, profile.displayName || 'Google User', 'google', profile.id]
              );
              const [[u]] = await db.query(
                'SELECT * FROM users WHERE id=?',
                [ins.insertId]
              );
              user = u;
            } else {
              if (!user.google_id) {
                await db.query(
                  'UPDATE users SET provider="google", google_id=? WHERE id=?',
                  [profile.id, user.id]
                );
              }
            }

            // ❗ DÙNG CÙNG KIỂU TOKEN VỚI /login
            const token = signUser(user);
            return done(null, { user, token });
          } catch (err) {
            console.error('LỖI GOOGLE OAUTH:', err);
            return done(err);
          }
        }
      )
    );

    app.get(
      '/api/auth/google',
      passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    app.get(
    '/api/auth/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: FRONTEND_BASE_URL + '/login.php?error=social'
    }),
    (req, res) => {
        const { token } = req.user;

        // Gửi token sang PHP qua query string
        return res.redirect(
        `${FRONTEND_BASE_URL}/index.php?token=${encodeURIComponent(token)}`
        );
    }
    );
  }
}

module.exports = { initSocial };
