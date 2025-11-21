// src/routes/addaddresses.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const auth = require('../middlewares/auth');

// Chỉ các cột FE đang dùng
const SELECT_ADDR =
  'SELECT id, user_id, label, receiver_name, phone, details, district, city, is_default, created_at, updated_at FROM addresses';

function trimOrEmpty(v) {
  return (typeof v === 'string' ? v.trim() : '');
}

router.get('/', auth, async (req, res) => {
  try {
    const db = getDB();
    const [rows] = await db.query(
      `${SELECT_ADDR} WHERE user_id=? ORDER BY id DESC`,
      [req.user.uid]
    );
    res.json({ addresses: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDB();
    const a = req.body || {};

    // Chuẩn hoá input
    const label    = trimOrEmpty(a.label) || 'Address';
    const details  = trimOrEmpty(a.details);
    const district = trimOrEmpty(a.district);
    const city     = trimOrEmpty(a.city);
    let receiver_name = trimOrEmpty(a.receiver_name);
    const phone         = trimOrEmpty(a.phone); // giữ nguyên như người dùng gửi (có thể rỗng)
    const is_default    = a.is_default ? 1 : 0;

    // Bắt buộc
    if (!phone ||!details || !district || !city) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ: details, district, city' });
    }

    // 🔁 Fallback CHỈ cho receiver_name từ users.full_name
    if (!receiver_name) {
      const [[user]] = await db.query(
        'SELECT full_name FROM users WHERE id=?',
        [req.user.uid]
      );
      receiver_name = user?.full_name || '';
    }

    // Nếu đặt mặc định thì clear default cũ
    if (is_default) {
      await db.query('UPDATE addresses SET is_default=0 WHERE user_id=?', [req.user.uid]);
    }

    await db.query(
      `INSERT INTO addresses (user_id, label, receiver_name, phone, details, district, city, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.uid, label, receiver_name, phone, details, district, city, is_default]
    );

    const [rows] = await db.query(
      `${SELECT_ADDR} WHERE user_id=? ORDER BY id DESC`,
      [req.user.uid]
    );
    return res.json({ addresses: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/default', auth, async (req, res) => {
  try {
    const db = getDB();
    await db.query('UPDATE addresses SET is_default=0 WHERE user_id=?', [req.user.uid]);
    await db.query('UPDATE addresses SET is_default=1 WHERE id=? AND user_id=?', [
      req.params.id,
      req.user.uid,
    ]);

    const [rows] = await db.query(
      `${SELECT_ADDR} WHERE user_id=? ORDER BY id DESC`,
      [req.user.uid]
    );
    return res.json({ addresses: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDB();
    await db.query('DELETE FROM addresses WHERE id=? AND user_id=?', [
      req.params.id,
      req.user.uid,
    ]);

    let [rows] = await db.query(
      `${SELECT_ADDR} WHERE user_id=? ORDER BY id DESC`,
      [req.user.uid]
    );

    const hasDefault = rows.some(r => Number(r.is_default) === 1);
    if (!hasDefault && rows[0]) {
      await db.query('UPDATE addresses SET is_default=1 WHERE id=?', [rows[0].id]);
      [rows] = await db.query(
        `${SELECT_ADDR} WHERE user_id=? ORDER BY id DESC`,
        [req.user.uid]
      );
    }

    return res.json({ addresses: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
