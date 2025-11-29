// backend/src/routes/adminOrders.js
const express   = require('express');
const router    = express.Router();
const { getDB } = require('../config/db');
const auth      = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const ALLOWED_STATUSES = [
  'pending',    // Đang chờ xử lý
  'confirmed',  // Đã xác nhận
  'processing', // Đang xử lý
  'shipping',   // Đang giao hàng
  'completed',  // Hoàn thành
  'cancelled'   // Đã huỷ
];

const DEFAULT_LIMIT = 20;

/**
 * GET /api/admin/orders
 * Query:
 *  - page, limit
 *  - q          (tìm theo email, full_name, receiver_name, phone)
 *  - status     (pending | confirmed | processing | shipping | completed | cancelled)
 *  - timeFilter (today | yesterday | this_week | this_month | range)
 *  - start_date, end_date (YYYY-MM-DD) – dùng khi timeFilter=range
 */
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitQ = parseInt(req.query.limit) || DEFAULT_LIMIT;
    const limit  = Math.max(Math.min(limitQ, 100), 1); // tránh limit quá lớn
    const offset = (page - 1) * limit;

    const q          = (req.query.q || '').trim();
    const status     = (req.query.status || '').trim();
    const timeFilter = (req.query.timeFilter || '').trim();
    const startDate  = (req.query.start_date || '').trim(); // YYYY-MM-DD
    const endDate    = (req.query.end_date || '').trim();

    let where    = 'WHERE 1=1';
    const params = [];

    // Tìm kiếm
    if (q) {
      where += `
        AND (
          o.email LIKE ?
          OR o.full_name LIKE ?
          OR o.receiver_name LIKE ?
          OR o.phone LIKE ?
        )
      `;
      const like = '%' + q + '%';
      params.push(like, like, like, like);
    }

    // Lọc theo trạng thái
    if (status && ALLOWED_STATUSES.includes(status)) {
      where += ' AND o.status = ?';
      params.push(status);
    }

    // Lọc theo thời gian
    if (timeFilter === 'today') {
      where += ' AND DATE(o.created_at) = CURDATE()';
    } else if (timeFilter === 'yesterday') {
      where += ' AND DATE(o.created_at) = (CURDATE() - INTERVAL 1 DAY)';
    } else if (timeFilter === 'this_week') {
      // WEEK theo ISO, tuần bắt đầu từ thứ 2
      where += ' AND YEARWEEK(o.created_at, 1) = YEARWEEK(CURDATE(), 1)';
    } else if (timeFilter === 'this_month') {
      where += ' AND YEAR(o.created_at) = YEAR(CURDATE()) AND MONTH(o.created_at) = MONTH(CURDATE())';
    } else if (timeFilter === 'range') {
      // Khoảng thời gian cụ thể
      if (startDate && endDate) {
        where += ' AND DATE(o.created_at) BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }
      // nếu thiếu start/end thì bỏ qua lọc range
    }

    // Đếm tổng đơn hàng
    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM orders o
       ${where}`,
      params
    );
    const totalItems = countRow.total || 0;
    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

    // Lấy danh sách đơn (tóm tắt)
    const [rows] = await db.query(
      `
      SELECT
        o.id,
        o.user_id,
        o.email,
        o.full_name,
        o.receiver_name,
        o.phone,
        o.total_amount,
        o.status,
        o.created_at,
        o.discount_amount,
        o.point_discount,
        o.coupon_code
      FROM orders o
      ${where}
      ORDER BY o.created_at DESC
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
    console.error('GET /api/admin/orders error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/admin/orders/:id
 * Trả về:
 *  - order (full)
 *  - items (chi tiết sản phẩm)
 *  - statusHistory (lịch sử trạng thái)
 */
router.get('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const id = parseInt(req.params.id, 10);

    const [[order]] = await db.query(
      `
      SELECT
        id,
        user_id,
        email,
        full_name,
        receiver_name,
        phone,
        address_details,
        district,
        city,
        postal_code,
        subtotal,
        tax,
        shipping_fee,
        discount_amount,
        total_amount,
        coupon_code,
        status,
        created_at,
        point_discount,
        loyalty_points_used,
        loyalty_points_earned
      FROM orders
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Items
    const [itemRows] = await db.query(
      `
      SELECT
        id,
        product_id,
        variant_id,
        name,
        attrs,
        unit_price,
        qty,
        line_total
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
      `,
      [id]
    );

    const items = itemRows.map(it => {
      let variant_label = '';
      if (it.attrs) {
        try {
          const obj = JSON.parse(it.attrs);
          variant_label = obj.label || obj.Label || obj.name || '';
        } catch (e) {}
      }
      return {
        ...it,
        variant_label
      };
    });

    // Lịch sử trạng thái
    const [statusHistory] = await db.query(
      `
      SELECT
        id,
        status,
        note,
        created_at
      FROM order_status_history
      WHERE order_id = ?
      ORDER BY created_at ASC
      `,
      [id]
    );

    return res.json({ order, items, statusHistory });
  } catch (err) {
    console.error('GET /api/admin/orders/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/admin/orders/:id
 * Body: { status, note }
 *  - Cập nhật trạng thái đơn hàng
 *  - Ghi lịch sử vào order_status_history
 */
router.put('/:id', auth, adminOnly, async (req, res) => {
  const db = getDB();
  const id = parseInt(req.params.id, 10);
  const { status, note = '' } = req.body || {};

  try {
    const [[order]] = await db.query(
      'SELECT id, status FROM orders WHERE id=? LIMIT 1',
      [id]
    );
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const trimmedNote = (note || '').trim();

    await db.query('START TRANSACTION');

    // Cập nhật trạng thái nếu thay đổi
    if (order.status !== status) {
      await db.query(
        'UPDATE orders SET status=? WHERE id=?',
        [status, id]
      );
    }

    // Ghi lịch sử nếu có thay đổi trạng thái hoặc có note
    if (order.status !== status || trimmedNote) {
      await db.query(
        `
        INSERT INTO order_status_history (order_id, status, note, created_at)
        VALUES (?, ?, ?, NOW())
        `,
        [id, status, trimmedNote || null]
      );
    }

    await db.query('COMMIT');

    return res.json({ message: 'Updated', status });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (e) {}
    console.error('PUT /api/admin/orders/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
