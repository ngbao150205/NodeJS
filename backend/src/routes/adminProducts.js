// backend/src/routes/adminProducts.js
const express   = require('express');
const router    = express.Router();
const { getDB } = require('../config/db');
const auth      = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const fs      = require('fs');
const path    = require('path');
const multer  = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB / ảnh
});

// Đường dẫn thư mục chứa ảnh (đi lên 3 cấp: routes -> src -> backend -> final -> frontend)
const UPLOAD_DIR = path.join(__dirname, '../../../frontend/acess/product');

/**
 * GET /api/admin/products
 * Query:
 *  - page, limit
 *  - q        (tìm theo tên)
 *  - category (slug: laptop / monitor / hard-drive)
 */
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit  = Math.max(parseInt(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;

    const q        = req.query.q || '';
    const category = req.query.category || '';

    let where   = 'WHERE 1=1';
    const params = [];

    // Tìm theo tên sản phẩm
    if (q) {
      where += ' AND p.name LIKE ?';
      params.push('%' + q + '%');
    }

    // Lọc theo category (slug)
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

    // Đếm tổng số (cho phân trang)
    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM products p
       ${where}`,
      params
    );
    const totalItems = countRow.total || 0;
    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

    // Lấy data kèm:
    //  - min_price
    //  - categories (chuỗi tên)
    //  - variant_count
    //  - total_stock
    const [rows] = await db.query(
      `
      SELECT
        p.*,
        (
          SELECT MIN(v.price)
          FROM product_variants v
          WHERE v.product_id = p.id
        ) AS min_price,
        (
          SELECT GROUP_CONCAT(c.name SEPARATOR ', ')
          FROM product_categories pc
          JOIN categories c ON c.id = pc.category_id
          WHERE pc.product_id = p.id
        ) AS categories,
        (
          SELECT COUNT(*)
          FROM product_variants v
          WHERE v.product_id = p.id
        ) AS variant_count,
        (
          SELECT SUM(v.stock)
          FROM product_variants v
          WHERE v.product_id = p.id
        ) AS total_stock
      FROM products p
      ${where}
      ORDER BY p.created_at DESC
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
        totalPages,
      }
    });
  } catch (err) {
    console.error('GET /api/admin/products error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/admin/products/:id
 * Trả về:
 *  - product (kèm category_slug)
 *  - variants (kèm label để hiển thị)
 *  - images
 */
router.get('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const id = parseInt(req.params.id, 10);

    const [[product]] = await db.query(
      `
      SELECT
        p.*,
        (
          SELECT c.slug
          FROM product_categories pc
          JOIN categories c ON c.id = pc.category_id
          WHERE pc.product_id = p.id
          LIMIT 1
        ) AS category_slug
      FROM products p
      WHERE p.id = ?
      LIMIT 1
      `,
      [id]
    );
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const [variantRows] = await db.query(
      `
      SELECT id, sku, attrs, price, stock
      FROM product_variants
      WHERE product_id = ?
      ORDER BY id ASC
      `,
      [id]
    );

    const variants = variantRows.map(v => {
      let label = '';
      if (v.attrs) {
        try {
          const obj = JSON.parse(v.attrs);
          label = obj.label || obj.Label || obj.name || '';
        } catch (e) {
          // attrs không phải JSON chuẩn, bỏ qua
        }
      }
      return {
        id: v.id,
        sku: v.sku,
        price: v.price,
        stock: v.stock,
        label
      };
    });

    const [images] = await db.query(
      `
      SELECT id, image_url, sort_order
      FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order ASC, id ASC
      `,
      [id]
    );

    return res.json({ product, variants, images });
  } catch (err) {
    console.error('GET /api/admin/products/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/admin/products
 * Body: {
 *   name, brand, slug,
 *   short_desc, descriptions,
 *   category_slug,        // "laptop" | "monitor" | "hard-drive"
 *   variants: [
 *     { sku, label, price, stock },
 *     ...
 *   ]
 * }
 * Ảnh: upload riêng qua /api/admin/products/:id/images
 */
router.post('/', auth, adminOnly, async (req, res) => {
  const db = getDB();
  const {
    name,
    brand,
    slug,
    short_desc,
    descriptions,
    category_slug,
    variants = []
  } = req.body || {};

  if (!name || !slug) {
    return res.status(400).json({ message: 'Missing name/slug' });
  }

  try {
    await db.query('START TRANSACTION');

    // Tạo sản phẩm
    const [result] = await db.query(
      `
      INSERT INTO products (name, slug, brand, short_desc, descriptions, created_at)
      VALUES (?,?,?,?,?, NOW())
      `,
      [name, slug, brand || null, short_desc || null, descriptions || null]
    );
    const productId = result.insertId;

    // Gán category (nếu có)
    if (category_slug) {
      const [[cat]] = await db.query(
        'SELECT id FROM categories WHERE slug=? LIMIT 1',
        [category_slug]
      );
      if (cat) {
        await db.query(
          'INSERT INTO product_categories (product_id, category_id) VALUES (?,?)',
          [productId, cat.id]
        );
      }
    }

    // Thêm các biến thể
    if (Array.isArray(variants)) {
      for (const v of variants) {
        const price = Number(v.price) || 0;
        const stock = Number(v.stock) || 0;
        const sku   = (v.sku || '').trim() || null;
        const label = (v.label || '').trim();
        const attrs = label ? JSON.stringify({ label }) : null;

        await db.query(
          `
          INSERT INTO product_variants (product_id, sku, attrs, price, stock)
          VALUES (?,?,?,?,?)
          `,
          [productId, sku, attrs, price, stock]
        );
      }
    }

    // Ảnh sẽ được upload riêng qua endpoint /api/admin/products/:id/images

    await db.query('COMMIT');
    return res.json({ message: 'Created', id: productId });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch(e){}
    console.error('POST /api/admin/products error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/admin/products/:id
 * Cập nhật:
 *   - name, brand, slug, short_desc, descriptions
 *   - category_slug
 *   - variants (xoá hết cũ, thêm lại mới)
 * Ảnh: cập nhật riêng bằng /api/admin/products/:id/images
 */
router.put('/:id', auth, adminOnly, async (req, res) => {
  const db  = getDB();
  const id  = parseInt(req.params.id, 10);
  const {
    name,
    brand,
    slug,
    short_desc,
    descriptions,
    category_slug,
    variants = []
  } = req.body || {};

  if (!name || !slug) {
    return res.status(400).json({ message: 'Missing name/slug' });
  }

  try {
    await db.query('START TRANSACTION');

    // Cập nhật sản phẩm
    await db.query(
      `
      UPDATE products
      SET name=?, slug=?, brand=?, short_desc=?, descriptions=?
      WHERE id=?
      `,
      [name, slug, brand || null, short_desc || null, descriptions || null, id]
    );

    // Cập nhật category: xoá hết cũ -> gán lại
    await db.query('DELETE FROM product_categories WHERE product_id=?', [id]);
    if (category_slug) {
      const [[cat]] = await db.query(
        'SELECT id FROM categories WHERE slug=? LIMIT 1',
        [category_slug]
      );
      if (cat) {
        await db.query(
          'INSERT INTO product_categories (product_id, category_id) VALUES (?,?)',
          [id, cat.id]
        );
      }
    }

    // Cập nhật variants: xoá hết cũ -> thêm mới
    await db.query('DELETE FROM product_variants WHERE product_id=?', [id]);

    if (Array.isArray(variants)) {
      for (const v of variants) {
        const price = Number(v.price) || 0;
        const stock = Number(v.stock) || 0;
        const sku   = (v.sku || '').trim() || null;
        const label = (v.label || '').trim();
        const attrs = label ? JSON.stringify({ label }) : null;

        await db.query(
          `
          INSERT INTO product_variants (product_id, sku, attrs, price, stock)
          VALUES (?,?,?,?,?)
          `,
          [id, sku, attrs, price, stock]
        );
      }
    }

    await db.query('COMMIT');
    return res.json({ message: 'Updated' });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch(e){}
    console.error('PUT /api/admin/products/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Xoá sản phẩm + variants + images + product_categories
 */
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const id = parseInt(req.params.id, 10);

    await db.query('DELETE FROM product_variants WHERE product_id=?', [id]);
    await db.query('DELETE FROM product_images WHERE product_id=?', [id]);
    await db.query('DELETE FROM product_categories WHERE product_id=?', [id]);
    await db.query('DELETE FROM products WHERE id=?', [id]);

    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE /api/admin/products/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/admin/products/:id/images
 * Form-data:
 *  - image1, image2, image3 (file)
 * Lưu file:
 *  frontend/acess/product/<slug>-1.jpg ...
 * Và upsert vào bảng product_images (theo sort_order = 1..3)
 */
router.post(
  '/:id/images',
  auth,
  adminOnly,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const db = getDB();
      const id = parseInt(req.params.id, 10);

      const [[product]] = await db.query(
        'SELECT id, slug FROM products WHERE id=? LIMIT 1',
        [id]
      );
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

      const files   = req.files || {};
      const updated = [];

      for (let i = 1; i <= 3; i++) {
        const field   = 'image' + i;
        const fileArr = files[field];
        if (!fileArr || !fileArr.length) continue;

        const file     = fileArr[0];
        const filename = `${product.slug}-${i}.jpg`; // ép về .jpg theo yêu cầu
        const fullPath = path.join(UPLOAD_DIR, filename);

        await fs.promises.writeFile(fullPath, file.buffer);

        const imageUrl = `acess/product/${filename}`;

        // upsert theo (product_id, sort_order)
        const [existRows] = await db.query(
          'SELECT id FROM product_images WHERE product_id=? AND sort_order=? LIMIT 1',
          [id, i]
        );
        if (existRows.length) {
          await db.query(
            'UPDATE product_images SET image_url=? WHERE id=?',
            [imageUrl, existRows[0].id]
          );
        } else {
          await db.query(
            'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?,?,?)',
            [id, imageUrl, i]
          );
        }

        updated.push({ sort_order: i, image_url: imageUrl });
      }

      return res.json({ message: 'Images uploaded', images: updated });
    } catch (err) {
      console.error('POST /api/admin/products/:id/images error:', err);
      return res.status(500).json({ message: 'Upload error', detail: String(err.message || err) });
    }
  }
);

/**
 * DELETE /api/admin/products/:id/images/:slot
 * slot = 1 | 2 | 3
 * Xoá file + bản ghi product_images tương ứng sort_order
 */
router.delete('/:id/images/:slot', auth, adminOnly, async (req, res) => {
  try {
    const db   = getDB();
    const id   = parseInt(req.params.id, 10);
    const slot = Math.max(parseInt(req.params.slot, 10) || 0, 1);

    const [[product]] = await db.query(
      'SELECT id, slug FROM products WHERE id=? LIMIT 1',
      [id]
    );
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // xoá file vật lý
    const filename = `${product.slug}-${slot}.jpg`;
    const fullPath = path.join(UPLOAD_DIR, filename);
    try {
      await fs.promises.unlink(fullPath);
    } catch (e) {
      // không có file cũng không sao
    }

    // xoá bản ghi DB
    await db.query(
      'DELETE FROM product_images WHERE product_id=? AND sort_order=?',
      [id, slot]
    );

    return res.json({ message: 'Image deleted' });
  } catch (err) {
    console.error('DELETE /api/admin/products/:id/images/:slot error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
