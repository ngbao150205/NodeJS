// backend/src/routes/adminDiscounts.js
const express   = require('express');
const router    = express.Router();
const { getDB } = require('../config/db');
const auth      = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const DEFAULT_LIMIT = 20;

/**
 * GET /api/admin/discount-codes
 * Query:
 *  - page, limit
 *  - q (tìm theo code)
 *
 * Trả về:
 *  {
 *    items: [
 *      { id, code, percent_off, max_uses, used_count, created_at }
 *    ],
 *    pagination: { page, limit, totalItems, totalPages }
 *  }
 */
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitQ = parseInt(req.query.limit) || DEFAULT_LIMIT;
    const limit  = Math.max(Math.min(limitQ, 100), 1); // tránh limit quá lớn
    const offset = (page - 1) * limit;

    const q = (req.query.q || '').trim();

    let where    = 'WHERE 1=1';
    const params = [];

    if (q) {
      where += ' AND code LIKE ?';
      params.push('%' + q + '%');
    }

    // Đếm tổng
    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM discount_codes
       ${where}`,
      params
    );
    const totalItems = countRow.total || 0;
    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

    // Lấy danh sách mã giảm giá (mới nhất trước)
    const [rows] = await db.query(
      `
      SELECT
        id,
        code,
        percent_off,
        max_uses,
        used_count,
        created_at
      FROM discount_codes
      ${where}
      ORDER BY created_at DESC, id DESC
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
    console.error('GET /api/admin/discount-codes error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/admin/discount-codes/:id
 * Trả về:
 *  - discount: thông tin mã giảm giá
 *  - orders: danh sách đơn hàng đã áp dụng mã (coupon_code = discount.code)
 */
router.get('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const id = parseInt(req.params.id, 10);

    const [[discount]] = await db.query(
      `
      SELECT
        id,
        code,
        percent_off,
        max_uses,
        used_count,
        created_at
      FROM discount_codes
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!discount) {
      return res.status(404).json({ message: 'Discount code not found' });
    }

    // Các đơn hàng đã dùng mã này (theo coupon_code)
    const [orders] = await db.query(
      `
      SELECT
        id,
        user_id,
        email,
        full_name,
        receiver_name,
        phone,
        total_amount,
        discount_amount,
        point_discount,
        status,
        created_at
      FROM orders
      WHERE coupon_code = ?
      ORDER BY created_at DESC
      `,
      [discount.code]
    );

    return res.json({ discount, orders });
  } catch (err) {
    console.error('GET /api/admin/discount-codes/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/admin/discount-codes
 * Body: { code, percent_off, max_uses? }
 *
 * - code: tối đa 5 ký tự (varchar(5)), tự chuyển về UPPERCASE
 * - percent_off: 1–100 (%)
 * - max_uses: >= 1, nếu không gửi hoặc không hợp lệ -> mặc định 10
 */
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    let { code, percent_off, max_uses } = req.body || {};

    if (!code || percent_off == null) {
      return res.status(400).json({ message: 'Missing code/percent_off' });
    }

    code = String(code).trim().toUpperCase();

    if (!code || code.length > 5) {
      return res.status(400).json({ message: 'Mã giảm giá tối đa 5 ký tự.' });
    }

    const percent = parseInt(percent_off, 10);
    if (isNaN(percent) || percent < 1 || percent > 100) {
      return res.status(400).json({ message: 'Giá trị giảm giá phải từ 1 đến 100 (%)' });
    }

    // ===== MẶC ĐỊNH max_uses = 10 NẾU KHÔNG GỬI HOẶC KHÔNG HỢP LỆ =====
    let maxUses = parseInt(max_uses, 10);
    if (isNaN(maxUses) || maxUses < 1) {
      maxUses = 10;
    }

    // check trùng code
    const [[exist]] = await db.query(
      'SELECT id FROM discount_codes WHERE code = ? LIMIT 1',
      [code]
    );
    if (exist) {
      return res.status(409).json({ message: 'Mã giảm giá đã tồn tại' });
    }

    const [result] = await db.query(
      `
      INSERT INTO discount_codes (code, percent_off, max_uses, used_count, created_at)
      VALUES (?, ?, ?, 0, NOW())
      `,
      [code, percent, maxUses]
    );

    return res.json({
      message: 'Created',
      id: result.insertId
    });
  } catch (err) {
    console.error('POST /api/admin/discount-codes error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
