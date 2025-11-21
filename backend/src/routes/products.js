// backend/src/routes/products.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const auth = require('../middlewares/auth');

/**
 * GET /api/products
 *  - page, limit
 *  - q (search tên)
 *  - brand
 *  - category (slug: laptop / monitor / hard-drive ...)
 *  - minPrice, maxPrice
 *  - rating (điểm trung bình tối thiểu)
 *  - sort:
 *      newest      -> sản phẩm mới (created_at DESC)
 *      best        -> bán chạy (sold DESC)
 *      name-asc    | name_asc
 *      name-desc   | name_desc
 *      price-asc   | price_asc
 *      price-desc  | price_desc
 *
 * Dùng cho:
 *  - products.php (catalog + pagination + filter + sort)
 *  - live search (JS fetch trực tiếp)
 */
router.get('/', async (req, res) => {
  try {
    const db = getDB();

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 12, 1);
    const offset = (page - 1) * limit;

    const {
      q,
      brand,
      category,
      minPrice,
      maxPrice,
      rating,
      sort
    } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    // Tìm kiếm theo tên sản phẩm
    if (q) {
      where += ' AND p.name LIKE ?';
      params.push('%' + q + '%');
    }

    // Lọc theo hãng
    if (brand) {
      where += ' AND p.brand = ?';
      params.push(brand);
    }

    // Lọc theo category (dùng slug từ bảng categories)
    if (category) {
      where += `
        AND EXISTS (
          SELECT 1
          FROM product_categories pc
          JOIN categories c ON c.id = pc.category_id
          WHERE pc.product_id = p.id
            AND c.slug = ?
        )
      `;
      params.push(category);
    }

    // Lọc theo khoảng giá (dựa trên product_variants)
    if (minPrice) {
      where += `
        AND EXISTS (
          SELECT 1 FROM product_variants v
          WHERE v.product_id = p.id AND v.price >= ?
        )
      `;
      params.push(+minPrice);
    }
    if (maxPrice) {
      where += `
        AND EXISTS (
          SELECT 1 FROM product_variants v
          WHERE v.product_id = p.id AND v.price <= ?
        )
      `;
      params.push(+maxPrice);
    }

    // Lọc theo điểm rating trung bình
    if (rating) {
      where += ' AND p.avg_rating >= ?';
      params.push(+rating);
    }

    // Sắp xếp
    let orderBy = 'ORDER BY p.created_at DESC';

    switch (sort) {
      case 'newest':
        orderBy = 'ORDER BY p.created_at DESC ';
        break;

      case 'best':
        // Sản phẩm bán chạy nhất
        orderBy = 'ORDER BY p.sold DESC, p.created_at DESC ';
        break;

      case 'name-asc':
      case 'name_asc':
        orderBy = 'ORDER BY p.name ASC';
        break;

      case 'name-desc':
      case 'name_desc':
        orderBy = 'ORDER BY p.name DESC';
        break;

      case 'price-asc':
      case 'price_asc':
        orderBy = `
          ORDER BY (
            SELECT MIN(v.price)
            FROM product_variants v
            WHERE v.product_id = p.id
          ) ASC
        `;
        break;

      case 'price-desc':
      case 'price_desc':
        orderBy = `
          ORDER BY (
            SELECT MIN(v.price)
            FROM product_variants v
            WHERE v.product_id = p.id
          ) DESC
        `;
        break;

      default:
        // mặc định: sản phẩm mới nhất
        orderBy = 'ORDER BY p.created_at DESC';
    }

    // Lấy danh sách sản phẩm
    const [rows] = await db.query(
      `
      SELECT
        p.*,
        -- Giá thấp nhất trong các variants
        (
          SELECT MIN(v.price)
          FROM product_variants v
          WHERE v.product_id = p.id
        ) AS min_price,
        -- Ảnh cover đầu tiên
        (
          SELECT i.image_url
          FROM product_images i
          WHERE i.product_id = p.id
          ORDER BY i.sort_order ASC
          LIMIT 1
        ) AS cover_image
      FROM products p
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    // Đếm tổng số sản phẩm (phục vụ phân trang)
    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM products p ${where}`,
      params
    );

    const totalItems = countRow.total || 0;
    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

    res.json({
      items: rows,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      },
      // meta cho tiện
      page,
      limit,
      totalItems,
      totalPages
    });
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/products/:slug
 * Trả về chi tiết sản phẩm:
 *  - info trong products
 *  - danh sách images
 *  - danh sách variants
 */
router.get('/:slug', async (req, res) => {
  try {
    const db = getDB();
    const { slug } = req.params;

    const [[product]] = await db.query(
      'SELECT * FROM products WHERE slug=? LIMIT 1',
      [slug]
    );
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const [images] = await db.query(
      'SELECT image_url FROM product_images WHERE product_id=? ORDER BY sort_order ASC',
      [product.id]
    );
    const [variants] = await db.query(
      'SELECT id, sku, attrs, price, stock FROM product_variants WHERE product_id=? ORDER BY id ASC',
      [product.id]
    );

    res.json({
      ...product,
      images: images.map(row => row.image_url),
      variants
    });
  } catch (err) {
    console.error('GET /api/products/:slug error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/products/:id/comments
 * Lấy danh sách bình luận (Không yêu cầu đăng nhập)
 */
router.get('/:id/comments', async (req, res) => {
  try {
    const db = getDB();
    const productId = parseInt(req.params.id, 10);

    const [rows] = await db.query(
      `
      SELECT id, author_name, content, created_at
      FROM product_comments
      WHERE product_id=?
      ORDER BY id DESC
      `,
      [productId]
    );

    res.json({ reviews: rows });
  } catch (err) {
    console.error('GET /api/products/:id/comments error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/products/:id/comments
 * Body: { author_name?, content }
 * Người dùng KHÔNG cần login để comment
 */
router.post('/:id/comments', async (req, res) => {
  try {
    const db = getDB();
    const productId = parseInt(req.params.id, 10);
    const { author_name = 'Khách', content } = req.body || {};

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Missing content' });
    }

    await db.query(
      `
      INSERT INTO product_comments(product_id, author_name, content)
      VALUES (?,?,?)
      `,
      [productId, author_name.trim(), content.trim()]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('comment:new', {
        productId,
        author_name: author_name.trim(),
        content: content.trim()
      });
    }

    res.json({ message: 'Comment added' });
  } catch (err) {
    console.error('POST /api/products/:id/comments error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/products/:id/ratings
 * Body: { stars }
 * BẮT BUỘC đăng nhập (middleware auth)
 */
router.post('/:id/ratings', auth, async (req, res) => {
  try {
    const db = getDB();
    const productId = parseInt(req.params.id, 10);
    const userId = req.user.uid;
    const stars = parseInt(req.body.stars, 10);

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ message: 'Invalid stars' });
    }

    // Insert hoặc update rating của user này cho sản phẩm này
    await db.query(
      `
      INSERT INTO product_ratings(product_id, user_id, stars)
      VALUES (?,?,?)
      ON DUPLICATE KEY UPDATE stars = VALUES(stars), created_at = CURRENT_TIMESTAMP
      `,
      [productId, userId, stars]
    );

    // Tính lại avg_rating & total_reviews
    const [[agg]] = await db.query(
      `
      SELECT
        ROUND(AVG(stars), 2) AS avg_rating,
        COUNT(*) AS total_reviews
      FROM product_ratings
      WHERE product_id = ?
      `,
      [productId]
    );

    const avg = agg.avg_rating || 0;
    const total = agg.total_reviews || 0;

    await db.query(
      'UPDATE products SET avg_rating=?, total_reviews=? WHERE id=?',
      [avg, total, productId]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('rating:new', {
        productId,
        stars,
        avg_rating: avg,
        total_reviews: total
      });
    }

    res.json({
      message: 'Rated',
      avg_rating: avg,
      total_reviews: total
    });
  } catch (err) {
    console.error('POST /api/products/:id/ratings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
