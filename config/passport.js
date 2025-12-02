// config/passport.js
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("./db"); // pool mysql2/promise

module.exports = function (passport) {
  // Lưu user.id vào session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Lấy lại user từ id trong session
  passport.deserializeUser(async (id, done) => {
    try {
      const [rows] = await db.query(
        "SELECT id, email, full_name, provider, google_id, role, loyalty_points FROM users WHERE id = ?",
        [id]
      );
      const user = rows[0] || null;
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Chiến lược Google
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email =
            profile.emails && profile.emails[0] && profile.emails[0].value;
          const fullName = profile.displayName || email || "Google User";

          // 1. Tìm user theo google_id
          const [rows] = await db.query(
            "SELECT * FROM users WHERE provider = 'google' AND google_id = ?",
            [googleId]
          );

          let user;

          if (rows.length > 0) {
            // Đã có user google → đăng nhập
            user = rows[0];
          } else {
            // 2. Nếu chưa, thử tìm theo email để link tài khoản local với google
            const [byEmail] = await db.query(
              "SELECT * FROM users WHERE email = ?",
              [email]
            );

            if (byEmail.length > 0) {
              const existing = byEmail[0];
              await db.query(
                "UPDATE users SET provider = 'google', google_id = ? WHERE id = ?",
                [googleId, existing.id]
              );
              user = { ...existing, provider: "google", google_id: googleId };
            } else {
              // 3. Nếu email cũng chưa có → tạo user mới
              const [result] = await db.query(
                "INSERT INTO users (email, full_name, provider, google_id) VALUES (?, ?, 'google', ?)",
                [email, fullName, googleId]
              );
              const userId = result.insertId;
              const [created] = await db.query(
                "SELECT * FROM users WHERE id = ?",
                [userId]
              );
              user = created[0];
            }
          }

          return done(null, user);
        } catch (err) {
          console.error("Google strategy error:", err);
          return done(err);
        }
      }
    )
  );
};
