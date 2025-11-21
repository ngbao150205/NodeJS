// backend/src/routes/product-detail.js
const router = require('express').Router();
const { getDB } = require('../config/db');

// GET /api/product/:slug
router.get('/:slug', async (req, res) => {
  try {
    const db = getDB();
    const { slug } = req.params;

    // 1. Lấy thông tin sản phẩm (đúng cột: short_desc)
    const [[p]] = await db.query(
      `SELECT 
          id,
          name,
          slug,
          brand,
          short_desc,
          descriptions,
          sold,
          avg_rating,
          total_reviews
       FROM products
       WHERE slug = ?
       LIMIT 1`,
      [slug]
    );

    if (!p) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // 2. Lấy danh sách ảnh (ít nhất 3 ảnh theo yêu cầu đề bài)
    const [imagesRows] = await db.query(
      `SELECT image_url 
       FROM product_images 
       WHERE product_id = ?
       ORDER BY sort_order, id`,
      [p.id]
    );

    // 3. Lấy các biến thể (variants) – mỗi variant có stock riêng
    const [variantsRows] = await db.query(
      `SELECT 
          id,
          sku,
          attrs,
          price,
          stock
       FROM product_variants
       WHERE product_id = ?
       ORDER BY id`,
      [p.id]
    );

    const variants = variantsRows.map(v => ({
      id: v.id,
      sku: v.sku,
      attrs: v.attrs ? JSON.parse(v.attrs) : null, // attrs dạng JSON: {"ram":"16GB","ssd":"512GB"}
      price: v.price,
      stock: v.stock,
    }));

    // 4. Trả JSON cho frontend
    res.json({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      // map đúng key cho PHP: short_description & description
      short_description: p.short_desc || '',
      description: p.descriptions || p.short_desc || '',  // tạm dùng short_desc cho cả mô tả ngắn/dài
      sold: p.sold,
      avg_rating: Number(p.avg_rating || 0),
      total_reviews: Number(p.total_reviews || 0),
      images: imagesRows.map(r => r.image_url),
      variants,
    });
  } catch (err) {
    console.error('GET /api/product/:slug error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
