// backend/src/routes/adminCategories.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const auth = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

// Lấy danh sách categories cho admin
// GET /api/admin/categories
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const [rows] = await db.query(
      'SELECT id, slug, name FROM categories ORDER BY name ASC'
    );
    return res.json({ items: rows });
  } catch (err) {
    console.error('GET /api/admin/categories error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
