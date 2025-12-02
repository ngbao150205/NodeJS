// routes/profileRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const router = express.Router();

// Lấy user id hiện tại từ session / passport
function getCurrentUserId(req) {
  if (req.user && req.user.id) return req.user.id;
  if (req.session && req.session.userId) return req.session.userId;
  return null;
}

// Middleware yêu cầu đăng nhập
function requireAuth(req, res, next) {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Bạn cần đăng nhập để sử dụng chức năng này." });
  }
  req.currentUserId = userId;
  next();
}

// Áp dụng cho tất cả route bên dưới
router.use(requireAuth);

/** Helper: lấy user + danh sách địa chỉ */
async function fetchProfile(userId) {
  const [users] = await db.query(
    "SELECT id, email, full_name, provider, role, loyalty_points FROM users WHERE id = ?",
    [userId]
  );
  if (users.length === 0) return null;
  const user = users[0];

  const [addresses] = await db.query(
    `SELECT id, label, receiver_name, phone, details, district, city, postal_code, is_default
     FROM addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, id ASC`,
    [userId]
  );

  const defaultAddress = addresses.find((a) => a.is_default === 1) || null;

  return { user, addresses, defaultAddress };
}

/**
 * GET /api/profile
 * -> Lấy thông tin hồ sơ + địa chỉ
 */
router.get("/", async (req, res, next) => {
  try {
    const data = await fetchProfile(req.currentUserId);
    if (!data) return res.status(404).json({ message: "Không tìm thấy người dùng." });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profile
 * body: { full_name }
 * -> Cập nhật thông tin cá nhân
 */
router.put("/", async (req, res, next) => {
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ message: "Họ tên không được để trống." });
    }

    await db.query("UPDATE users SET full_name = ? WHERE id = ?", [
      full_name.trim(),
      req.currentUserId,
    ]);

    const data = await fetchProfile(req.currentUserId);
    res.json({ message: "Cập nhật hồ sơ thành công.", ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profile/password
 * body: { current_password, new_password, confirm_password }
 * - Nếu user local có password_hash: kiểm tra current_password
 * - Nếu user Google (provider='google' và password_hash NULL): cho phép đặt mật khẩu lần đầu, không cần current_password
 */
router.put("/password", async (req, res, next) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!new_password || !confirm_password) {
      return res.status(400).json({ message: "Vui lòng nhập mật khẩu mới và xác nhận." });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ message: "Mật khẩu xác nhận không khớp." });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải từ 6 ký tự trở lên." });
    }

    const [rows] = await db.query(
      "SELECT id, password_hash, provider FROM users WHERE id = ?",
      [req.currentUserId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }
    const user = rows[0];

    // Nếu có password cũ (tài khoản local bình thường)
    if (user.password_hash) {
      if (!current_password) {
        return res.status(400).json({ message: "Vui lòng nhập mật khẩu hiện tại." });
      }
      const ok = await bcrypt.compare(current_password, user.password_hash);
      if (!ok) {
        return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
      }
    }
    // Nếu provider='google' và chưa có password_hash -> cho set lần đầu, không kiểm tra current_password

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      newHash,
      req.currentUserId,
    ]);

    res.json({ message: "Đổi mật khẩu thành công." });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/profile/addresses
 * -> danh sách địa chỉ giao hàng
 */
router.get("/addresses", async (req, res, next) => {
  try {
    const [addresses] = await db.query(
      `SELECT id, label, receiver_name, phone, details, district, city, postal_code, is_default
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, id ASC`,
      [req.currentUserId]
    );
    res.json({ addresses });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/profile/addresses
 * body: { label, receiver_name, phone, details, district, city, postal_code, is_default }
 */
router.post("/addresses", async (req, res, next) => {
  try {
    const { label, receiver_name, phone, details, district, city, postal_code, is_default } =
      req.body;

    if (!details || !district || !city) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ địa chỉ chi tiết, quận/huyện và tỉnh/thành phố." });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      if (is_default) {
        await conn.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [
          req.currentUserId,
        ]);
      }

      await conn.query(
        `INSERT INTO addresses
          (user_id, label, receiver_name, phone, details, district, city, postal_code, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.currentUserId,
          label || null,
          receiver_name || null,
          phone || null,
          details,
          district,
          city,
          postal_code || null,
          is_default ? 1 : 0,
        ]
      );

      await conn.commit();
      conn.release();
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }

    const [addresses] = await db.query(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC",
      [req.currentUserId]
    );
    res.status(201).json({ message: "Thêm địa chỉ thành công.", addresses });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profile/addresses/:id
 * -> Cập nhật địa chỉ
 */
router.put("/addresses/:id", async (req, res, next) => {
  try {
    const addressId = Number(req.params.id);
    if (!addressId) return res.status(400).json({ message: "ID địa chỉ không hợp lệ." });

    const { label, receiver_name, phone, details, district, city, postal_code, is_default } =
      req.body;

    if (!details || !district || !city) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ địa chỉ chi tiết, quận/huyện và tỉnh/thành phố." });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // kiểm tra địa chỉ có thuộc về user hiện tại không
      const [rows] = await conn.query(
        "SELECT id FROM addresses WHERE id = ? AND user_id = ?",
        [addressId, req.currentUserId]
      );
      if (rows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: "Địa chỉ không tồn tại." });
      }

      if (is_default) {
        await conn.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [
          req.currentUserId,
        ]);
      }

      await conn.query(
        `UPDATE addresses
         SET label = ?, receiver_name = ?, phone = ?, details = ?, district = ?, city = ?, postal_code = ?, is_default = ?
         WHERE id = ? AND user_id = ?`,
        [
          label || null,
          receiver_name || null,
          phone || null,
          details,
          district,
          city,
          postal_code || null,
          is_default ? 1 : 0,
          addressId,
          req.currentUserId,
        ]
      );

      await conn.commit();
      conn.release();
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }

    const [addresses] = await db.query(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC",
      [req.currentUserId]
    );
    res.json({ message: "Cập nhật địa chỉ thành công.", addresses });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/profile/addresses/:id
 */
router.delete("/addresses/:id", async (req, res, next) => {
  try {
    const addressId = Number(req.params.id);
    if (!addressId) return res.status(400).json({ message: "ID địa chỉ không hợp lệ." });

    await db.query("DELETE FROM addresses WHERE id = ? AND user_id = ?", [
      addressId,
      req.currentUserId,
    ]);

    const [addresses] = await db.query(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC",
      [req.currentUserId]
    );
    res.json({ message: "Xoá địa chỉ thành công.", addresses });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/profile/addresses/:id/default
 * -> đặt địa chỉ mặc định
 */
router.post("/addresses/:id/default", async (req, res, next) => {
  try {
    const addressId = Number(req.params.id);
    if (!addressId) return res.status(400).json({ message: "ID địa chỉ không hợp lệ." });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        "SELECT id FROM addresses WHERE id = ? AND user_id = ?",
        [addressId, req.currentUserId]
      );
      if (rows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: "Địa chỉ không tồn tại." });
      }

      await conn.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [
        req.currentUserId,
      ]);
      await conn.query(
        "UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?",
        [addressId, req.currentUserId]
      );

      await conn.commit();
      conn.release();
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }

    const [addresses] = await db.query(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC",
      [req.currentUserId]
    );
    res.json({ message: "Đặt địa chỉ mặc định thành công.", addresses });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
