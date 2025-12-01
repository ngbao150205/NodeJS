const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');

/**
 * GET /api/home
 * Trả về danh sách:
 * - newProducts (6 sản phẩm mới nhất)
 * - bestSellers (6 sản phẩm bán chạy nhất)
 * - categories: laptops, monitors, hardDrives (mỗi loại 4 sản phẩm)
 */
router.get('/', async (req, res) => {
  try {
    const db = getDB();

    // 6 sản phẩm mới nhất
    const [newProducts] = await db.query(
      `SELECT p.*,
              (SELECT image_url FROM product_images 
                 WHERE product_id=p.id 
                 ORDER BY sort_order LIMIT 1) AS first_image
       FROM products p
       ORDER BY p.created_at DESC
       LIMIT 6`
    );

    // 6 sản phẩm bán chạy nhất
    const [bestSellers] = await db.query(
      `SELECT p.*,
              (SELECT image_url FROM product_images 
                 WHERE product_id=p.id 
                 ORDER BY sort_order LIMIT 1) AS first_image
       FROM products p
       ORDER BY p.sold DESC
       LIMIT 6`
    );

    // Helper lấy 4 sản phẩm theo danh mục
    async function byCategory(slug) {
      const [rows] = await db.query(
        `SELECT p.*,
                (SELECT image_url 
                   FROM product_images 
                   WHERE product_id=p.id ORDER BY sort_order LIMIT 1) AS first_image
         FROM products p
         JOIN product_categories pc ON pc.product_id=p.id
         JOIN categories c ON c.id = pc.category_id
         WHERE c.slug = :slug
         ORDER BY p.created_at DESC
         LIMIT 4`,
        { slug }
      );
      return rows;
    }

    const [laptops, monitors, hardDrives] = await Promise.all([
      byCategory('laptop'),
      byCategory('monitor'),
      byCategory('hard-drive'),
    ]);

    // Lấy variants (giá) cho từng danh sách
    async function attachVariant(list) {
      if (!list.length) return list;

      const ids = list.map(p => p.id);
      const [variants] = await db.query(
        `SELECT * FROM product_variants 
         WHERE product_id IN (${ids.map(x => '?').join(',')})
         ORDER BY id`,
        ids
      );

      const map = variants.reduce((acc, v) => {
        if (!acc[v.product_id]) acc[v.product_id] = [];
        acc[v.product_id].push(v);
        return acc;
      }, {});

      return list.map(p => ({
        ...p,
        variants: map[p.id] || [],
        images: p.first_image ? [p.first_image] : []
      }));
    }

    res.json({
      newProducts: await attachVariant(newProducts),
      bestSellers: await attachVariant(bestSellers),
      categories: {
        laptops: await attachVariant(laptops),
        monitors: await attachVariant(monitors),
        hardDrives: await attachVariant(hardDrives),
      }
    });

  } catch (e) {
    console.error("HOME API ERROR:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
