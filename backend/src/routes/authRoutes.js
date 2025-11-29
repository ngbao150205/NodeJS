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

    // ⚠️ SỬA Ở ĐÂY: kiểm tra email tồn tại KHÔNG phân biệt provider
    const [exists] = await db.query(
      "SELECT id, provider FROM users WHERE email = ?",
      [email]
    );

    if (exists.length > 0) {
      const existing = exists[0];
      let msg = "Email đã được sử dụng.";

      if (existing.provider === "google") {
        msg =
          "Email này đã được dùng để đăng nhập bằng Google. " +
          "Vui lòng chọn 'Đăng nhập với Google' trên màn hình đăng nhập.";
      }

      return res.status(400).json({ message: msg });
    }

    const passwordHash = await bcrypt.hash(password, 10);

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
        [userId, full_name, phone || "", details, district, city, postal_code || ""]
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

      // Phòng trường hợp cực hiếm vẫn đụng UNIQUE KEY
      if (err && err.code === "ER_DUP_ENTRY") {
        return res
          .status(400)
          .json({ message: "Email đã được sử dụng. Vui lòng dùng email khác." });
      }

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

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? AND provider = 'local'",
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
      return res
        .status(403)
        .json({ message: "Tài khoản của bạn đã bị cấm. Vui lòng liên hệ quản trị." });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        message:
          "Tài khoản này được tạo qua đăng nhập xã hội. Vui lòng dùng Google đăng nhập hoặc đặt mật khẩu qua trang hồ sơ.",
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res
        .status(400)
        .json({ message: "Email hoặc mật khẩu không đúng." });
    }

    // ✅ Chỉ set session nếu KHÔNG bị cấm
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
