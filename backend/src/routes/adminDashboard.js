// src/routes/adminDashboard.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const auth = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

/**
 * Simple Dashboard
 * Tổng quan cấp cao: tổng user, đơn, doanh thu, top sản phẩm
 */
router.get('/overview', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    // Tổng người dùng và người dùng mới trong 7 ngày
    const [[users]] = await db.query(`
      SELECT 
        COUNT(*) AS total_users,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS new_users
      FROM users
    `);

    // Tổng đơn hàng và doanh thu
    const [[orders]] = await db.query(`
      SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM orders
    `);

    // Top 5 sản phẩm bán chạy
    const [topProducts] = await db.query(`
      SELECT 
        name, sold, slug
      FROM products
      ORDER BY sold DESC
      LIMIT 5
    `);

    res.json({
      users,
      orders,
      topProducts
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Advanced Dashboard
 * Lọc thống kê theo thời gian: year / month / quarter / week
 * Query: type=year|month|quarter|week&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const { type = 'year', from, to } = req.query;

    let groupBy = 'YEAR(created_at)';
    if (type === 'month') groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
    else if (type === 'quarter') groupBy = 'CONCAT(YEAR(created_at), "-Q", QUARTER(created_at))';
    else if (type === 'week') groupBy = 'YEARWEEK(created_at, 1)';

    const where = (from && to)
      ? 'WHERE created_at BETWEEN ? AND ?'
      : '';

    const params = (from && to) ? [from, to] : [];

    const [rows] = await db.query(`
      SELECT 
        ${groupBy} AS label,
        COUNT(*) AS total_orders,
        SUM(total_amount) AS revenue,
        SUM(total_amount - shipping_fee - tax + discount_amount) AS profit
      FROM orders
      ${where}
      GROUP BY label
      ORDER BY MIN(created_at)
    `, params);

    res.json({ data: rows });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
