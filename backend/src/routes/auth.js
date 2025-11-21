const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // dùng 'bcrypt' (hoặc 'bcryptjs' nếu bạn cài cái đó)
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDB } = require('../config/db');
const auth = require('../middlewares/auth');
const nodemailer = require('nodemailer');
const { signUser } = require('../utils/jwt'); // 👈 dùng chung

const SECRET = process.env.JWT_SECRET || 'dev';
const EXPIRES = '7d';



async function mailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

/**
 * Đăng ký
 * Body: { email, fullName, password, address: { label?, details, district, city } }
 * Lưu ý: dùng addresses.details/district/city (KHÔNG có line1)
 */
router.post('/register', async (req, res) => {
  try {
    const db = getDB();
    const { email, fullName, password, address = {} } = req.body;
    const { label = 'Default', details, district, city } = address;

    if (!email || !fullName || !password || !details || !district || !city) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // kiểm tra trùng email
    const [[exist]] = await db.query('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
    if (exist) return res.status(409).json({ message: 'Email đã tồn tại' });

    // hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // tạo user
    const [userResult] = await db.query(
      `INSERT INTO users
         (email, full_name, password_hash, provider, role, loyalty_points, created_at, updated_at)
       VALUES (?, ?, ?, 'local', 'customer', 0, NOW(), NOW())`,
      [email, fullName, passwordHash]
    );
    const userId = userResult.insertId;

    // tạo địa chỉ mặc định
    await db.query(
      `INSERT INTO addresses
         (user_id, label, details, district, city, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [userId, label, details, district, city]
    );

    // trả token
    const token = signUser({ id: userId, email, full_name: fullName, role: 'customer' });
    return res.json({ token });
  } catch (err) {
    console.error(err);
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

/** Đăng nhập: email + password */
router.post('/login', async (req, res) => {
  try {
    const db = getDB();
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Missing email/password' });

    const [[user]] = await db.query('SELECT * FROM users WHERE email=? LIMIT 1', [email]);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // nếu là tài khoản MXH (provider != local) và không có password_hash
    if (!user.password_hash) return res.status(400).json({ message: 'Tài khoản này đăng nhập bằng MXH' });

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({ token: signUser(user), user: {
      id: user.id, email: user.email, full_name: user.full_name, role: user.role, loyalty_points: user.loyalty_points
    }});
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:'Server error' });
  }
});

/** Hồ sơ */
router.get('/me', auth, async (req, res) => {
  const db = getDB();
  const [[user]] = await db.query(
    'SELECT id,email,full_name,role,loyalty_points FROM users WHERE id=?',
    [req.user.uid]
  );
  res.json({ user });
});

/** Cập nhật hồ sơ (chỉ tên) */
router.put('/profile', auth, async (req, res) => {
  try {
    const db = getDB();
    await db.query('UPDATE users SET full_name=?, updated_at=NOW() WHERE id=?',
      [req.body.fullName, req.user.uid]);
    const [[user]] = await db.query(
      'SELECT id,email,full_name,role,loyalty_points FROM users WHERE id=?',
      [req.user.uid]
    );
    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:'Server error' });
  }
});

/** Đổi mật khẩu */
router.post('/change-password', auth, async (req, res) => {
  try {
    const db = getDB();
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ message:'Missing fields' });

    const [[u]] = await db.query('SELECT password_hash FROM users WHERE id=?', [req.user.uid]);
    const ok = await bcrypt.compare(oldPassword, u?.password_hash || '');
    if (!ok) return res.status(400).json({ message:'Old password incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?',
      [hash, req.user.uid]);
    res.json({ message:'Password updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:'Server error' });
  }
});

/** Quên mật khẩu (gửi email reset) */
router.post('/forgot-password', async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.body || {};
    if (!email) return res.json({ message:'If email exists, a reset link is sent' });

    const [[user]] = await db.query('SELECT id,email FROM users WHERE email=?', [email]);
    if (!user) return res.json({ message:'If email exists, a reset link is sent' });

    const token = crypto.randomBytes(24).toString('hex');
    const exp = new Date(Date.now() + 30*60*1000); // 30 phút
    await db.query(
      'UPDATE users SET reset_token=?, reset_token_exp=? WHERE id=?',
      [token, exp, user.id]
    );

    const resetUrl = `${process.env.FRONTEND_BASE_URL}/reset-password.php?token=${token}`;
    const t = await mailer();
    await t.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@estorepc.local',
      to: user.email,
      subject: 'Reset your password',
      html: `Click <a href="${resetUrl}">here</a> to reset your password (valid 30 minutes).`
    });

    res.json({ message:'Reset link sent (if email exists)' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:'Server error' });
  }
});

/** Đặt lại mật khẩu qua token */
router.post('/reset-password', async (req, res) => {
  try {
    const db = getDB();
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ message:'Missing fields' });

    const [[user]] = await db.query(
      'SELECT id FROM users WHERE reset_token=? AND reset_token_exp > NOW() LIMIT 1',
      [token]
    );
    if (!user) return res.status(400).json({ message:'Invalid or expired token' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash=?, reset_token=NULL, reset_token_exp=NULL, updated_at=NOW() WHERE id=?',
      [hash, user.id]
    );
    res.json({ message:'Password has been reset' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:'Server error' });
  }
});

module.exports = router;
