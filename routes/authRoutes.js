// routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const crypto = require("crypto");
const db = require("../config/db");
const { sendMail } = require("../config/mailer");

const router = express.Router();

/** Helper: lấy user + địa chỉ mặc định */
async function getUserWithDefaultAddress(userId) {
  const [users] = await db.query(
    // THÊM is_banned VÀO SELECT
    "SELECT id, email, full_name, role, provider, google_id, loyalty_points, is_banned FROM users WHERE id = ?",
    [userId]
  );
  if (users.length === 0) return null;
  const user = users[0];

  const [addresses] = await db.query(
    "SELECT id, label, receiver_name, phone, details, district, city, postal_code, is_default FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC",
    [userId]
  );

  const defaultAddress = addresses.find((a) => a.is_default === 1) || null;

  return {
    user,
    defaultAddress,
    addresses,
  };
}


/* ===========================
   ĐĂNG KÝ LOCAL
   POST /api/auth/register
   =========================== */
router.post("/register", async (req, res, next) => {
  try {
    const {
      email,
      full_name,
      password,
      confirm_password,
      phone,
      details,
      district,
      city,
      postal_code,
    } = req.body;

    if (
      !email ||
      !full_name ||
      !password ||
      !confirm_password ||
      !details ||
      !district ||
      !city
    ) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    if (password !== confirm_password) {
      return res
        .status(400)
        .json({ message: "Mật khẩu xác nhận không khớp." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 🔥 Lấy user theo email (DÙ là google hay local)
    const [existsRows] = await db.query(
      "SELECT id, email, full_name, provider, password_hash FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    // ===== CASE 1: CHƯA CÓ USER NÀO -> TẠO USER LOCAL MỚI =====
    if (existsRows.length === 0) {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const [userResult] = await conn.query(
          "INSERT INTO users (email, full_name, password_hash, provider) VALUES (?, ?, ?, 'local')",
          [email, full_name, passwordHash]
        );
        const userId = userResult.insertId;

        await conn.query(
          `INSERT INTO addresses
            (user_id, label, receiver_name, phone, details, district, city, postal_code, is_default)
           VALUES (?, 'Default', ?, ?, ?, ?, ?, ?, 1)`,
          [
            userId,
            full_name,
            phone || "",
            details,
            district,
            city,
            postal_code || "",
          ]
        );

        await conn.commit();

        req.session.userId = userId;
        const data = await getUserWithDefaultAddress(userId);

        return res.status(201).json({
          message: "Đăng ký thành công.",
          ...data,
        });
      } catch (err) {
        await conn.rollback();

        if (err && err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({
            message: "Email đã được sử dụng. Vui lòng dùng email khác.",
          });
        }

        throw err;
      } finally {
        conn.release();
      }
    }

    // ===== CASE 2: EMAIL ĐÃ TỒN TẠI -> XỬ LÝ GHÉP LOCAL VÀO GOOGLE =====
    const existing = existsRows[0];

    if (existing.password_hash) {
      // đã có mật khẩu rồi => nghĩa là đã có local
      return res.status(400).json({
        message:
          "Email này đã có tài khoản mật khẩu. Vui lòng đăng nhập hoặc dùng chức năng quên mật khẩu.",
      });
    }

    // Tài khoản này được tạo qua Google, chưa có password -> thêm local vào cùng 1 user
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `
        UPDATE users
        SET full_name = ?, password_hash = ?, provider = 
          CASE 
            WHEN provider = 'google' THEN 'local_google' 
            ELSE provider 
          END
        WHERE id = ?
      `,
        [full_name, passwordHash, existing.id]
      );

      // Đảm bảo có địa chỉ mặc định
      const [addrRows] = await conn.query(
        "SELECT id FROM addresses WHERE user_id = ? LIMIT 1",
        [existing.id]
      );
      if (addrRows.length === 0) {
        await conn.query(
          `INSERT INTO addresses
            (user_id, label, receiver_name, phone, details, district, city, postal_code, is_default)
           VALUES (?, 'Default', ?, ?, ?, ?, ?, ?, 1)`,
          [
            existing.id,
            full_name,
            phone || "",
            details,
            district,
            city,
            postal_code || "",
          ]
        );
      }

      await conn.commit();

      req.session.userId = existing.id;
      const data = await getUserWithDefaultAddress(existing.id);

      return res.status(200).json({
        message: "Đã thêm mật khẩu cho tài khoản này. Bạn có thể đăng nhập bằng email + mật khẩu hoặc Google.",
        ...data,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});


/* ===========================
   ĐĂNG NHẬP LOCAL
   POST /api/auth/login
   =========================== */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập email và mật khẩu." });
    }

    // ❗ Không lọc provider nữa
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (users.length === 0) {
      return res
        .status(400)
        .json({ message: "Email hoặc mật khẩu không đúng." });
    }

    const user = users[0];

    // 🔴 CHẶN TÀI KHOẢN BỊ CẤM
    if (user.is_banned) {
      return res.status(403).json({
        message: "Tài khoản của bạn đã bị cấm. Vui lòng liên hệ quản trị.",
      });
    }

    // Nếu tài khoản chưa có password_hash (chỉ có Google)
    if (!user.password_hash) {
      return res.status(400).json({
        message:
          user.provider === "google"
            ? "Tài khoản này đang dùng đăng nhập bằng Google và chưa có mật khẩu. Vui lòng đăng nhập với Google hoặc thiết lập mật khẩu qua chức năng Đăng ký / Quên mật khẩu."
            : "Tài khoản này chưa có mật khẩu. Vui lòng đặt mật khẩu mới.",
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res
        .status(400)
        .json({ message: "Email hoặc mật khẩu không đúng." });
    }

    req.session.userId = user.id;

    const data = await getUserWithDefaultAddress(user.id);
    res.json({
      message: "Đăng nhập thành công.",
      ...data, // trong data.user đã có is_banned
    });
  } catch (err) {
    next(err);
  }
});



/* ===========================
   ĐĂNG XUẤT
   POST /api/auth/logout
   =========================== */
router.post("/logout", (req, res, next) => {
  try {
    // bỏ tham chiếu user (cho chắc)
    req.user = null;

    if (!req.session) {
      return res.json({ message: "Đã đăng xuất." });
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("Lỗi destroy session:", err);
        return res.status(500).json({ message: "Không thể đăng xuất." });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Đã đăng xuất." });
    });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   LẤY THÔNG TIN USER HIỆN TẠI
   GET /api/auth/me
   =========================== */
router.get("/me", async (req, res, next) => {
  try {
    let userId = null;

    if (req.user && req.user.id) {
      userId = req.user.id;
    } else if (req.session && req.session.userId) {
      userId = req.session.userId;
    }

    if (!userId) {
      return res.json({ user: null });
    }

    const data = await getUserWithDefaultAddress(userId);
    if (!data) return res.json({ user: null });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/* ===========================
   GOOGLE LOGIN
   GET /api/auth/google
   GET /api/auth/google/callback
   =========================== */

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login.html",
  }),
  (req, res) => {
    if (req.user && req.user.id) {
      req.session.userId = req.user.id;
    }
    res.redirect("/");
  }
);

/* ===========================
   QUÊN MẬT KHẨU (OTP EMAIL)
   POST /api/auth/forgot-password
   POST /api/auth/reset-password
   =========================== */

/**
 * POST /api/auth/forgot-password
 * body: { email }
 * -> Sinh OTP, lưu hash, gửi mail
 */
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email." });
    }

    const [users] = await db.query(
      "SELECT id, email, full_name FROM users WHERE email = ?",
      [email]
    );
    if (users.length === 0) {
      return res
        .status(404)
        .json({ message: "Email không tồn tại trong hệ thống." });
    }
    const user = users[0];

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const minutes = Number(process.env.RESET_TOKEN_EXPIRES_MINUTES || 10);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_exp = ? WHERE id = ?",
      [otpHash, expiresAt, user.id]
    );

    const subject = "Mã OTP đặt lại mật khẩu";
    const text = `Xin chào ${user.full_name || user.email},

Mã OTP đặt lại mật khẩu của bạn là: ${otp}

Mã này có hiệu lực trong ${minutes} phút.

Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`;

    await sendMail({
      to: user.email,
      subject,
      text,
    });

    res.json({
      message:
        "Đã gửi mã OTP đến email của bạn. Vui lòng kiểm tra hộp thư (hoặc Spam).",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 * body: { email, otp, new_password, confirm_password }
 */
router.post("/reset-password", async (req, res, next) => {
  try {
    const { email, otp, new_password, confirm_password } = req.body;

    if (!email || !otp || !new_password || !confirm_password) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ email, OTP và mật khẩu mới.",
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ message: "Mật khẩu xác nhận không khớp." });
    }

    if (new_password.length < 6) {
      return res
        .status(400)
        .json({ message: "Mật khẩu mới phải từ 6 ký tự trở lên." });
    }

    const [users] = await db.query(
      "SELECT id, reset_token, reset_token_exp FROM users WHERE email = ?",
      [email]
    );
    if (users.length === 0) {
      return res
        .status(404)
        .json({ message: "Email không tồn tại trong hệ thống." });
    }
    const user = users[0];

    if (!user.reset_token || !user.reset_token_exp) {
      return res.status(400).json({
        message:
          "Không tìm thấy yêu cầu đặt lại mật khẩu. Vui lòng gửi lại OTP.",
      });
    }

    const now = new Date();
    const exp = new Date(user.reset_token_exp);
    if (exp.getTime() < now.getTime()) {
      return res
        .status(400)
        .json({ message: "Mã OTP đã hết hạn. Vui lòng gửi lại yêu cầu." });
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (otpHash !== user.reset_token) {
      return res.status(400).json({ message: "Mã OTP không chính xác." });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_exp = NULL WHERE id = ?",
      [newHash, user.id]
    );

    res.json({
      message:
        "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    next(err);
  }
});

module.exports = router;
