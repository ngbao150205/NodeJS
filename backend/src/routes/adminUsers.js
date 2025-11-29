// backend/src/routes/adminUsers.js
const express   = require('express');
const router    = express.Router();
const { getDB } = require('../config/db');
const auth      = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

/**
 * GET /api/admin/users
 * Query:
 *  - page, limit
 *  - q      (tìm theo email hoặc full_name)
 *  - role   (customer | admin)
 *  - status (active | banned)
 */
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit  = Math.max(parseInt(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;

    const q      = (req.query.q || '').trim();
    const role   = (req.query.role || '').trim();
    const status = (req.query.status || '').trim(); // active | banned

    let where    = 'WHERE 1=1';
    const params = [];

    if (q) {
      where += ' AND (u.email LIKE ? OR u.full_name LIKE ?)';
      const like = '%' + q + '%';
      params.push(like, like);
    }

    if (role === 'customer' || role === 'admin') {
      where += ' AND u.role = ?';
      params.push(role);
    }

    if (status === 'active') {
      where += ' AND u.is_banned = 0';
    } else if (status === 'banned') {
      where += ' AND u.is_banned = 1';
    }

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM users u
       ${where}`,
      params
    );
    const totalItems = countRow.total || 0;
    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

    const [rows] = await db.query(
      `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.provider,
        u.role,
        u.loyalty_points,
        u.is_banned,
        u.created_at
      FROM users u
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return res.json({
      items: rows,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/admin/users/:id
 * Trả về chi tiết 1 user
 */
router.get('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const id = parseInt(req.params.id, 10);

    const [[user]] = await db.query(
      `
      SELECT
        id,
        email,
        full_name,
        provider,
        google_id,
        role,
        loyalty_points,
        is_banned,
        reset_token,
        reset_token_exp,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('GET /api/admin/users/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Cập nhật:
 *  - full_name
 *  - role           ("customer" | "admin")
 *  - loyalty_points (int)
 *  - is_banned      (bool/0/1)
 */
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const id = parseInt(req.params.id, 10);

    const {
      full_name,
      role,
      loyalty_points,
      is_banned
    } = req.body || {};

    const [[user]] = await db.query(
      'SELECT id, role, is_banned FROM users WHERE id=? LIMIT 1',
      [id]
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!full_name || !role) {
      return res.status(400).json({ message: 'Missing full_name or role' });
    }

    const allowedRoles = ['customer', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    let points = parseInt(loyalty_points, 10);
    if (Number.isNaN(points)) points = 0;

    let newBanned = user.is_banned;
    if (typeof is_banned === 'boolean' || is_banned === 0 || is_banned === 1 || is_banned === '0' || is_banned === '1') {
      newBanned = (is_banned === true || is_banned === 1 || is_banned === '1') ? 1 : 0;
    }

    // Không cho tự cấm chính mình
    if (req.user && req.user.id === id && newBanned === 1) {
      return res.status(400).json({ message: 'Không thể cấm tài khoản của chính bạn.' });
    }

    await db.query(
      `
      UPDATE users
      SET full_name = ?, role = ?, loyalty_points = ?, is_banned = ?
      WHERE id = ?
      `,
      [full_name.trim(), role, points, newBanned, id]
    );

    return res.json({ message: 'Updated' });
  } catch (err) {
    console.error('PUT /api/admin/users/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/admin/users/:id/ban
 * Cấm user: is_banned = 1
 */
router.post('/:id/ban', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const id = parseInt(req.params.id, 10);

    const [[user]] = await db.query(
      'SELECT id, is_banned FROM users WHERE id=? LIMIT 1',
      [id]
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user && req.user.id === id) {
      return res.status(400).json({ message: 'Không thể cấm tài khoản của chính bạn.' });
    }

    await db.query(
      'UPDATE users SET is_banned = 1 WHERE id = ?',
      [id]
    );

    return res.json({ message: 'User banned' });
  } catch (err) {
    console.error('POST /api/admin/users/:id/ban error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/admin/users/:id/unban
 * Gỡ cấm user: is_banned = 0
 */
router.post('/:id/unban', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const id = parseInt(req.params.id, 10);

    const [[user]] = await db.query(
      'SELECT id, is_banned FROM users WHERE id=? LIMIT 1',
      [id]
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await db.query(
      'UPDATE users SET is_banned = 0 WHERE id = ?',
      [id]
    );

    return res.json({ message: 'User unbanned' });
  } catch (err) {
    console.error('POST /api/admin/users/:id/unban error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
