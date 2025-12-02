// routes/router.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");

const db = require("../config/db");
const { sendMail } = require("../config/mailer");
const esClient = require("../config/es");

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

/* ===========================
   HELPER AUTH
   =========================== */

function getCurrentUserId(req) {
  if (req.user && req.user.id) return req.user.id;
  if (req.session && req.session.userId) return req.session.userId;
  return null;
}

function requireLogin(req, res, next) {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return res
      .status(401)
      .json({ message: "Vui lòng đăng nhập để xem đơn hàng." });
  }
  next();
}

/* ===========================
   HELPER SLUG + ADMIN CHECK
   =========================== */

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Chỉ cho phép user có role = 'admin' truy cập API admin
async function getAdminUserOr403(req, res) {
  const userId = getCurrentUserId(req);

  // Chưa đăng nhập
  if (!userId) {
    res.status(401).json({
      message:
        "Vui lòng đăng nhập bằng tài khoản admin để truy cập trang quản trị.",
    });
    return null;
  }

  // Lấy thông tin user từ DB
  const [rows] = await db.query(
    "SELECT id, email, full_name, role, is_banned FROM users WHERE id = ? LIMIT 1",
    [userId]
  );

  const user = rows[0];

  // Không tồn tại / không phải admin / bị khóa
  if (!user || user.role !== "admin" || user.is_banned) {
    res.status(403).json({
      message: "Bạn không có quyền truy cập khu vực quản trị.",
    });
    return null;
  }

  // OK, là admin
  return user;
}

/* ===========================
   PAGES
   =========================== */

// Trang chủ
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Trang danh sách sản phẩm (nếu truy cập /products)
router.get("/products", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "products.html"));
});

/* ===========================
   HELPER MAP PRODUCT
   =========================== */

function mapProductBasic(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    price: row.price,
    image: row.image,
    sold: row.sold,
    avg_rating: row.avg_rating,
  };
}

/* ===========================
   API TRANG CHỦ
   GET /api/home
   =========================== */
router.get("/api/home", async (req, res, next) => {
  try {
    // SẢN PHẨM MỚI
    const [newRows] = await db.query(
      `SELECT p.id,
              p.slug,
              p.name,
              p.brand,
              p.sold,
              COALESCE(prs.avg_rating, p.avg_rating) AS avg_rating,
              MIN(v.price) AS price,
              MIN(img.image_url) AS image
       FROM products p
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN product_images img ON img.product_id = p.id
       LEFT JOIN product_rating_summary prs ON prs.product_id = p.id
       GROUP BY p.id, p.slug, p.name, p.brand, p.sold, avg_rating
       ORDER BY p.created_at DESC
       LIMIT 10`
    );
    const newProducts = newRows.map(mapProductBasic);

    // BÁN CHẠY NHẤT
    const [bestRows] = await db.query(
      `SELECT p.id,
              p.slug,
              p.name,
              p.brand,
              p.sold,
              COALESCE(prs.avg_rating, p.avg_rating) AS avg_rating,
              MIN(v.price) AS price,
              MIN(img.image_url) AS image
       FROM products p
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN product_images img ON img.product_id = p.id
       LEFT JOIN product_rating_summary prs ON prs.product_id = p.id
       GROUP BY p.id, p.slug, p.name, p.brand, p.sold, avg_rating
       ORDER BY p.sold DESC, p.created_at DESC
       LIMIT 10`
    );
    const bestSellers = bestRows.map(mapProductBasic);

    // CÁC DANH MỤC CHÍNH: laptop, monitor, hard-drive
    const [catRows] = await db.query(
      `SELECT id, slug, name
       FROM categories
       WHERE slug IN ('laptop', 'monitor', 'hard-drive')
       ORDER BY FIELD(slug, 'laptop', 'monitor', 'hard-drive')`
    );

    const categories = catRows.map((c) => ({
      key: c.slug,
      label: c.name,
    }));

    // SẢN PHẨM THEO DANH MỤC
    const productsByCategory = {};
    for (const cat of catRows) {
      const [rows] = await db.query(
        `SELECT p.id,
                p.slug,
                p.name,
                p.brand,
                p.sold,
                COALESCE(prs.avg_rating, p.avg_rating) AS avg_rating,
                MIN(v.price) AS price,
                MIN(img.image_url) AS image
         FROM products p
         JOIN product_categories pc ON pc.product_id = p.id
         JOIN categories c ON c.id = pc.category_id AND c.slug = ?
         LEFT JOIN product_variants v ON v.product_id = p.id
         LEFT JOIN product_images img ON img.product_id = p.id
         LEFT JOIN product_rating_summary prs ON prs.product_id = p.id
         GROUP BY p.id, p.slug, p.name, p.brand, p.sold, avg_rating
         ORDER BY p.created_at DESC
         LIMIT 10`,
        [cat.slug]
      );
      productsByCategory[cat.slug] = rows.map(mapProductBasic);
    }

    res.json({
      newProducts,
      bestSellers,
      categories,
      productsByCategory,
    });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   API DANH MỤC SẢN PHẨM
   GET /api/product-categories
   =========================== */
router.get("/api/product-categories", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id,
              c.slug,
              c.name,
              COUNT(DISTINCT pc.product_id) AS product_count
       FROM categories c
       LEFT JOIN product_categories pc ON pc.category_id = c.id
       GROUP BY c.id, c.slug, c.name
       ORDER BY c.name ASC`
    );

    const categories = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      productCount: c.product_count,
    }));

    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// ================== ELASTICSEARCH HELPER (SEARCH PRODUCT) ==================

async function searchProductsWithElastic({
  q,
  page,
  limit,
  category,
  brand,
  priceMin,
  priceMax,
  ratingMin,
  sort,
}) {
  const from = (page - 1) * limit;

  const must = [];
  const filter = [];

  // full-text search
  if (q) {
    must.push({
      multi_match: {
        query: q,
        fields: ["name^3", "short_desc^2", "descriptions", "brand"],
        fuzziness: "AUTO",
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  // filter category
  if (category) {
    filter.push({
      term: {
        category_slug: category,
      },
    });
  }

  if (brand) {
    filter.push({ term: { brand: brand } });
  }

  if (priceMin != null || priceMax != null) {
    const range = {};
    if (priceMin != null) range.gte = priceMin;
    if (priceMax != null) range.lte = priceMax;
    filter.push({ range: { price: range } });
  }

  if (ratingMin != null) {
    filter.push({
      range: {
        avg_rating: { gte: ratingMin },
      },
    });
  }

  // sort trong ES
  const esSort = [];
  switch (sort) {
    case "newest":
      esSort.push({ created_at: { order: "desc" } });
      break;
    case "bestseller":
      esSort.push({ sold: { order: "desc" } }, { created_at: { order: "desc" } });
      break;
    case "name_asc":
      esSort.push({ name_sort: { order: "asc" } });
      break;
    case "name_desc":
      esSort.push({ name_sort: { order: "desc" } });
      break;
    case "price_asc":
      esSort.push({ price: { order: "asc" } });
      break;
    case "price_desc":
      esSort.push({ price: { order: "desc" } });
      break;
    default:
      // khi không sort cụ thể: ưu tiên điểm score + ngày tạo
      esSort.push({ _score: { order: "desc" } }, { created_at: { order: "desc" } });
      break;
  }

  // Với client v7/v8: cách an toàn là truyền query/sort/from/size trực tiếp
  let esResponse;
  try {
    esResponse = await esClient.search({
      index: ES_INDEX_PRODUCTS,   // NHỚ thêm dòng này nếu trên chưa có
      from: from,
      size: limit,
      track_total_hits: true,

      // Dùng query match_all để test
      query: {
        match_all: {}
      },

      sort: esSort,
    });

    console.log(
      "[ES] debug raw hits.total:",
      esResponse && esResponse.hits && esResponse.hits.total
    );
  } catch (err) {
    console.error("[ES] search error:", err && err.message ? err.message : err);
    throw err;
  }

  // v7: esResponse.body.hits...
  // v8: nhiều dự án vẫn dùng esResponse.body, nhưng nếu không có thì dùng thẳng esResponse
  const esBody = esResponse && esResponse.body ? esResponse.body : esResponse || {};

  const hitsWrapper = esBody.hits || {};
  const hits = hitsWrapper.hits || [];

  const totalRaw = hitsWrapper.total;
  let totalItems = 0;

  if (typeof totalRaw === "number") {
    totalItems = totalRaw;
  } else if (totalRaw && typeof totalRaw.value === "number") {
    totalItems = totalRaw.value;
  }

  console.log("[ES] hits:", totalItems);

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const products = hits.map(function (hit) {
    const src = hit && hit._source ? hit._source : {};
    return {
      id: src.id,
      slug: src.slug,
      name: src.name,
      brand: src.brand,
      price: src.price,
      image: src.image,
      shortDescription: src.short_desc,
      createdAt: src.created_at,
      sold: src.sold,
      avg_rating: src.avg_rating,
      total_reviews: src.total_reviews,
      categoryName: src.category_name,
      categorySlug: src.category_slug,
    };
  });

  return {
    products: products,
    pagination: {
      totalItems: totalItems,
      totalPages: totalPages,
      currentPage: page,
      perPage: limit,
    },
  };
}






/* ===========================
   API DANH SÁCH SẢN PHẨM
   GET /api/products?page=&limit=&category=&q=&sort=
   =========================== 
router.get("/api/products", async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 12, 1);
    const offset = (page - 1) * limit;

    const category = req.query.category || "";
    const q = (req.query.q || "").trim();
    const sort = req.query.sort || "";

    const brand = (req.query.brand || "").trim();
    const priceMin = req.query.priceMin
      ? parseInt(req.query.priceMin, 10)
      : null;
    const priceMax = req.query.priceMax
      ? parseInt(req.query.priceMax, 10)
      : null;
    const ratingMin = req.query.ratingMin
      ? parseFloat(req.query.ratingMin)
      : null;

    let where = "WHERE 1=1";
    const params = [];
    const paramsCount = [];

    // Lọc theo danh mục (slug hoặc id)
    if (category) {
      where += " AND (c.slug = ? OR c.id = ?)";
      params.push(category, category);
      paramsCount.push(category, category);
    }

    // Tìm kiếm theo tên / mô tả ngắn
    if (q) {
      const like = `%${q}%`;
      where += " AND (p.name LIKE ? OR p.short_desc LIKE ?)";
      params.push(like, like);
      paramsCount.push(like, like);
    }

    // Lọc theo thương hiệu
    if (brand) {
      where += " AND p.brand = ?";
      params.push(brand);
      paramsCount.push(brand);
    }

    // Lọc theo khoảng giá (dựa trên giá biến thể)
    if (priceMin != null) {
      where += " AND v.price >= ?";
      params.push(priceMin);
      paramsCount.push(priceMin);
    }
    if (priceMax != null) {
      where += " AND v.price <= ?";
      params.push(priceMax);
      paramsCount.push(priceMax);
    }

    // Lọc theo rating tối thiểu
    if (ratingMin != null) {
      where += " AND COALESCE(prs.avg_rating, p.avg_rating) >= ?";
      params.push(ratingMin);
      paramsCount.push(ratingMin);
    }

    // Đếm tổng sản phẩm
    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM products p
       LEFT JOIN product_categories pc ON pc.product_id = p.id
       LEFT JOIN categories c ON c.id = pc.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN product_rating_summary prs ON prs.product_id = p.id
       ${where}`,
      paramsCount
    );
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // Xác định ORDER BY theo sort
    let orderBySql = "p.created_at DESC"; // mặc định: mới nhất

    switch (sort) {
      case "newest":
        orderBySql = "p.created_at DESC";
        break;
      case "bestseller":
        orderBySql = "p.sold DESC, p.created_at DESC";
        break;
      case "name_asc":
        orderBySql = "p.name ASC";
        break;
      case "name_desc":
        orderBySql = "p.name DESC";
        break;
      case "price_asc":
        orderBySql = "price ASC"; // alias MIN(v.price)
        break;
      case "price_desc":
        orderBySql = "price DESC";
        break;
      default:
        break;
    }

    // Lấy danh sách sản phẩm
    const [rows] = await db.query(
      `SELECT
          p.id,
          p.slug,
          p.name,
          p.brand,
          p.short_desc,
          p.created_at,
          p.sold,
          COALESCE(prs.avg_rating, p.avg_rating) AS avg_rating,
          COALESCE(prs.total_reviews, p.total_reviews) AS total_reviews,
          MIN(v.price) AS price,
          MIN(img.image_url) AS image,
          MAX(c.name) AS category_name,
          MAX(c.slug) AS category_slug
       FROM products p
       LEFT JOIN product_categories pc ON pc.product_id = p.id
       LEFT JOIN categories c ON c.id = pc.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN product_images img ON img.product_id = p.id
       LEFT JOIN product_rating_summary prs ON prs.product_id = p.id
       ${where}
       GROUP BY p.id, p.slug, p.name, p.brand, p.short_desc, p.created_at, p.sold, avg_rating, total_reviews
       ORDER BY ${orderBySql}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const products = rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      price: p.price,
      image: p.image,
      shortDescription: p.short_desc,
      createdAt: p.created_at,
      sold: p.sold,
      avg_rating: p.avg_rating,
      total_reviews: p.total_reviews,
      categoryName: p.category_name,
      categorySlug: p.category_slug,
    }));

    res.json({
      products,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: limit,
      },
      filters: {
        category: category || null,
        q: q || null,
        sort: sort || null,
        brand: brand || null,
        priceMin: priceMin,
        priceMax: priceMax,
        ratingMin: ratingMin,
      },
    });
  } catch (err) {
    next(err);
  }
});*/

/* ===========================
   API DANH SÁCH SẢN PHẨM
   GET /api/products?page=&limit=&category=&q=&sort=
   =========================== */
router.get("/api/products", async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 12, 1);
    const offset = (page - 1) * limit;

    const category = req.query.category || "";
    const q = (req.query.q || "").trim();
    const sort = req.query.sort || "";

    const brand = (req.query.brand || "").trim();
    const priceMin = req.query.priceMin
      ? parseInt(req.query.priceMin, 10)
      : null;
    const priceMax = req.query.priceMax
      ? parseInt(req.query.priceMax, 10)
      : null;
    const ratingMin = req.query.ratingMin
      ? parseFloat(req.query.ratingMin)
      : null;

    let usedElastic = false;

    // ================== 1. Thử search bằng ElasticSearch khi có từ khoá ==================
    if (q) {
      try {
        const { products, pagination } = await searchProductsWithElastic({
          q,
          page,
          limit,
          category,
          brand,
          priceMin,
          priceMax,
          ratingMin,
          sort,
        });

        usedElastic = true;

        return res.json({
          products,
          pagination,
          filters: {
            category: category || null,
            q: q || null,
            sort: sort || null,
            brand: brand || null,
            priceMin: priceMin,
            priceMax: priceMax,
            ratingMin: ratingMin,

          },
            usedElastic, // 👈 trả ra client
        });
      } catch (esErr) {
        console.error("ElasticSearch search error, fallback MySQL:", esErr);
        // tiếp tục xuống dưới để dùng MySQL như cũ
      }
    }

    // ================== 2. Fallback / trường hợp không có q -> MySQL như cũ ==================

    let where = "WHERE 1=1";
    const params = [];
    const paramsCount = [];

    // Lọc theo danh mục (slug hoặc id)
    if (category) {
      where += " AND (c.slug = ? OR c.id = ?)";
      params.push(category, category);
      paramsCount.push(category, category);
    }

    // Tìm kiếm theo tên / mô tả ngắn (chỉ dùng khi không search bằng ES)
    if (q) {
      const like = `%${q}%`;
      where += " AND (p.name LIKE ? OR p.short_desc LIKE ?)";
      params.push(like, like);
      paramsCount.push(like, like);
    }

    // Lọc theo thương hiệu
    if (brand) {
      where += " AND p.brand = ?";
      params.push(brand);
      paramsCount.push(brand);
    }

    // Lọc theo khoảng giá (dựa trên giá biến thể)
    if (priceMin != null) {
      where += " AND v.price >= ?";
      params.push(priceMin);
      paramsCount.push(priceMin);
    }
    if (priceMax != null) {
      where += " AND v.price <= ?";
      params.push(priceMax);
      paramsCount.push(priceMax);
    }

    // Lọc theo rating tối thiểu
    if (ratingMin != null) {
      where += " AND COALESCE(prs.avg_rating, p.avg_rating) >= ?";
      params.push(ratingMin);
      paramsCount.push(ratingMin);
    }

    // Đếm tổng sản phẩm
    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM products p
       LEFT JOIN product_categories pc ON pc.product_id = p.id
       LEFT JOIN categories c ON c.id = pc.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN product_rating_summary prs ON prs.product_id = p.id
       ${where}`,
      paramsCount
    );
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // Xác định ORDER BY theo sort
    let orderBySql = "p.created_at DESC"; // mặc định: mới nhất

    switch (sort) {
      case "newest":
        orderBySql = "p.created_at DESC";
        break;
      case "bestseller":
        orderBySql = "p.sold DESC, p.created_at DESC";
        break;
      case "name_asc":
        orderBySql = "p.name ASC";
        break;
      case "name_desc":
        orderBySql = "p.name DESC";
        break;
      case "price_asc":
        orderBySql = "price ASC"; // alias MIN(v.price)
        break;
      case "price_desc":
        orderBySql = "price DESC";
        break;
      default:
        break;
    }

    // Lấy danh sách sản phẩm
    const [rows] = await db.query(
      `SELECT
          p.id,
          p.slug,
          p.name,
          p.brand,
          p.short_desc,
          p.created_at,
          p.sold,
          COALESCE(prs.avg_rating, p.avg_rating) AS avg_rating,
          COALESCE(prs.total_reviews, p.total_reviews) AS total_reviews,
          MIN(v.price) AS price,
          MIN(img.image_url) AS image,
          MAX(c.name) AS category_name,
          MAX(c.slug) AS category_slug
       FROM products p
       LEFT JOIN product_categories pc ON pc.product_id = p.id
       LEFT JOIN categories c ON c.id = pc.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id
       LEFT JOIN product_images img ON img.product_id = p.id
       LEFT JOIN product_rating_summary prs ON prs.product_id = p.id
       ${where}
       GROUP BY p.id, p.slug, p.name, p.brand, p.short_desc, p.created_at, p.sold, avg_rating, total_reviews
       ORDER BY ${orderBySql}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const products = rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      price: p.price,
      image: p.image,
      shortDescription: p.short_desc,
      createdAt: p.created_at,
      sold: p.sold,
      avg_rating: p.avg_rating,
      total_reviews: p.total_reviews,
      categoryName: p.category_name,
      categorySlug: p.category_slug,
    }));

    res.json({
      products,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: limit,
      },
      filters: {
        category: category || null,
        q: q || null,
        sort: sort || null,
        brand: brand || null,
        priceMin: priceMin,
        priceMax: priceMax,
        ratingMin: ratingMin,
      },
      usedElastic,
    });
  } catch (err) {
    next(err);
  }
});


/* ===========================
   API CHI TIẾT SẢN PHẨM
   GET /api/products/:id
   =========================== */
router.get("/api/products/:id", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (!productId) {
      return res.status(400).json({ message: "Mã sản phẩm không hợp lệ." });
    }

    const [productRows] = await db.query(
      `SELECT p.id,
              p.name,
              p.slug,
              p.brand,
              p.short_desc,
              p.descriptions,
              p.sold,
              p.avg_rating,
              p.total_reviews,
              p.created_at
       FROM products p
       WHERE p.id = ?`,
      [productId]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }
    const product = productRows[0];

    // Biến thể
    const [variantRows] = await db.query(
      `SELECT id, sku, attrs, price, stock
       FROM product_variants
       WHERE product_id = ?
       ORDER BY id ASC`,
      [productId]
    );

    const variants = variantRows.map((v) => {
      let attrs = {};
      try {
        attrs = v.attrs ? JSON.parse(v.attrs) : {};
      } catch (e) {
        attrs = {};
      }
      return {
        id: v.id,
        sku: v.sku,
        attrs,
        price: v.price,
        stock: v.stock,
      };
    });

    // Hình ảnh
    const [imageRows] = await db.query(
      `SELECT id, image_url, sort_order
       FROM product_images
       WHERE product_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [productId]
    );

    const images = imageRows.map((img) => ({
      id: img.id,
      url: img.image_url,
      sort_order: img.sort_order,
    }));

    // Tóm tắt đánh giá
    const [ratingSummaryRows] = await db.query(
      `SELECT 
          COUNT(*) AS total_reviews,
          COALESCE(AVG(stars), 0) AS avg_rating
       FROM product_ratings
       WHERE product_id = ?`,
      [productId]
    );

    const ratingSummary = {
      total_reviews: ratingSummaryRows[0].total_reviews || 0,
      avg_rating: Number(ratingSummaryRows[0].avg_rating || 0).toFixed(1),
    };

    // Danh sách đánh giá
    const [ratingRows] = await db.query(
      `SELECT r.id,
              r.stars,
              r.created_at,
              u.full_name
       FROM product_ratings r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [productId]
    );

    const ratings = ratingRows.map((r) => ({
      id: r.id,
      stars: r.stars,
      created_at: r.created_at,
      author_name: r.full_name,
    }));

    // Bình luận
    const [commentRows] = await db.query(
      `SELECT id, author_name, content, created_at
       FROM product_comments
       WHERE product_id = ?
       ORDER BY created_at DESC`,
      [productId]
    );

    const comments = commentRows.map((c) => ({
      id: c.id,
      author_name: c.author_name,
      content: c.content,
      created_at: c.created_at,
    }));

    res.json({
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        short_desc: product.short_desc,
        descriptions: product.descriptions,
        sold: product.sold,
        created_at: product.created_at,
        avg_rating: ratingSummary.avg_rating,
        total_reviews: ratingSummary.total_reviews,
      },
      variants,
      images,
      ratingSummary,
      ratings,
      comments,
    });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   API ĐÁNH GIÁ SẢN PHẨM
   POST /api/products/:id/rating
   =========================== */
router.post("/api/products/:id/rating", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { stars } = req.body;
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Vui lòng đăng nhập để đánh giá sản phẩm." });
    }

    const s = Number(stars);
    if (!s || s < 1 || s > 5) {
      return res
        .status(400)
        .json({ message: "Số sao không hợp lệ (1 - 5)." });
    }

    const [pRows] = await db.query("SELECT id FROM products WHERE id = ?", [
      productId,
    ]);
    if (pRows.length === 0) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại." });
    }

    const [existing] = await db.query(
      "SELECT id FROM product_ratings WHERE product_id = ? AND user_id = ?",
      [productId, userId]
    );

    if (existing.length > 0) {
      await db.query(
        "UPDATE product_ratings SET stars = ?, created_at = NOW() WHERE id = ?",
        [s, existing[0].id]
      );
    } else {
      await db.query(
        "INSERT INTO product_ratings (product_id, user_id, stars) VALUES (?, ?, ?)",
        [productId, userId, s]
      );
    }

    const [summaryRows] = await db.query(
      `SELECT 
          COUNT(*) AS total_reviews,
          COALESCE(AVG(stars), 0) AS avg_rating
       FROM product_ratings
       WHERE product_id = ?`,
      [productId]
    );

    res.json({
      message: "Đã gửi đánh giá.",
      ratingSummary: {
        total_reviews: summaryRows[0].total_reviews || 0,
        avg_rating: Number(summaryRows[0].avg_rating || 0).toFixed(1),
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   API BÌNH LUẬN SẢN PHẨM
   POST /api/products/:id/comment
   =========================== */
router.post("/api/products/:id/comment", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { content, author_name } = req.body;
    const userId = getCurrentUserId(req);

    if (!productId) {
      return res.status(400).json({ message: "Mã sản phẩm không hợp lệ." });
    }

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ message: "Nội dung bình luận không được rỗng." });
    }

    const [pRows] = await db.query("SELECT id FROM products WHERE id = ?", [
      productId,
    ]);
    if (pRows.length === 0) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại." });
    }

    let finalAuthorName = "Khách";

    if (userId) {
      const [userRows] = await db.query(
        "SELECT full_name FROM users WHERE id = ?",
        [userId]
      );
      if (userRows[0] && userRows[0].full_name) {
        finalAuthorName = userRows[0].full_name;
      }
    } else if (author_name && author_name.trim()) {
      finalAuthorName = author_name.trim();
    }

    await db.query(
      "INSERT INTO product_comments (product_id, author_name, content) VALUES (?, ?, ?)",
      [productId, finalAuthorName, content.trim()]
    );

    res.json({ message: "Đã gửi bình luận." });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   API DANH SÁCH THƯƠNG HIỆU
   GET /api/product-brands
   =========================== */
router.get("/api/product-brands", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT brand
       FROM products
       WHERE brand IS NOT NULL AND brand <> ''
       ORDER BY brand ASC`
    );

    const brands = rows.map((r) => r.brand);
    res.json({ brands });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   CHECKOUT + LOYALTY
   =========================== */

// Lấy thông tin khởi tạo cho màn checkout
router.get("/api/checkout/init", async (req, res, next) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.json({
        loggedIn: false,
        user: null,
        defaultAddress: null,
        addresses: [],
      });
    }

    // Thông tin user (kèm điểm thưởng)
    const [uRows] = await db.query(
      "SELECT id, email, full_name, loyalty_points FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const user = uRows[0] || null;

    // Tất cả địa chỉ
    const [addrRows] = await db.query(
      `SELECT id, label, receiver_name, phone, details, district, city, postal_code, is_default
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, id ASC`,
      [userId]
    );

    let defaultAddress = null;
    if (addrRows.length > 0) {
      defaultAddress = addrRows.find((a) => a.is_default) || addrRows[0];
    }

    res.json({
      loggedIn: !!user,
      user,
      defaultAddress,
      addresses: addrRows,
    });
  } catch (err) {
    next(err);
  }
});

// API tạo đơn hàng (checkout) + loyalty points
router.post("/api/checkout", async (req, res, next) => {
  const conn = db;
  try {
    const {
      items,
      shipping,
      saveAddress,
      paymentMethod,
      couponCode,
      useLoyaltyPoints,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Giỏ hàng trống, không thể thanh toán." });
    }

    if (!shipping) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin giao hàng." });
    }

    const {
      email,
      full_name,
      receiver_name,
      phone,
      address_details,
      district,
      city,
      postal_code,
    } = shipping;

    if (
      !email ||
      !full_name ||
      !receiver_name ||
      !phone ||
      !address_details ||
      !district ||
      !city
    ) {
      return res.status(400).json({
        message:
          "Vui lòng điền đầy đủ email, họ tên, người nhận, số điện thoại và địa chỉ giao hàng.",
      });
    }

    // Chuẩn hoá items
    const normalizedItems = [];
    let subtotal = 0;

    for (const it of items) {
      const productId = Number(it.productId) || 0;
      const variantId = Number(it.variantId) || 0;
      const qty = Math.max(1, Number(it.qty) || 0);
      const unitPrice = Math.max(0, Number(it.price) || 0);

      if (!productId || qty <= 0) {
        return res
          .status(400)
          .json({ message: "Dữ liệu sản phẩm không hợp lệ." });
      }

      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      normalizedItems.push({
        product_id: productId,
        variant_id: variantId,
        name: it.name || "Sản phẩm",
        attrs: null,
        unit_price: unitPrice,
        qty,
        line_total: lineTotal,
      });
    }

    const tax = Math.round(subtotal * 0.1);
    const shippingFee = subtotal > 0 ? 30000 : 0;

    // ===== MÃ GIẢM GIÁ =====
    let discountAmount = 0;
    let appliedCouponCode = null;
    let appliedCouponRow = null;

    if (couponCode) {
      let code = String(couponCode).trim().toUpperCase();

      if (!/^[A-Z0-9]{5}$/.test(code)) {
        return res.status(400).json({
          message:
            "Mã giảm giá không hợp lệ (phải gồm 5 ký tự chữ và số).",
        });
      }

      const [rows] = await conn.query(
        "SELECT id, code, percent_off, max_uses, used_count FROM discount_codes WHERE code = ?",
        [code]
      );

      if (rows.length === 0) {
        return res
          .status(400)
          .json({ message: "Mã giảm giá không tồn tại." });
      }

      const coupon = rows[0];
      const effectiveMaxUses = Math.min(coupon.max_uses || 0, 10);

      if (effectiveMaxUses <= 0) {
        return res
          .status(400)
          .json({ message: "Mã giảm giá đã hết hiệu lực." });
      }

      if (coupon.used_count >= effectiveMaxUses) {
        return res.status(400).json({
          message:
            "Mã giảm giá này đã được sử dụng hết số lần cho phép.",
        });
      }

      discountAmount = Math.round(
        subtotal * (Number(coupon.percent_off) / 100)
      );
      if (discountAmount < 0) discountAmount = 0;
      if (discountAmount > subtotal) discountAmount = subtotal;

      appliedCouponCode = coupon.code;
      appliedCouponRow = coupon;
    }

    let totalAmount = subtotal + tax + shippingFee - discountAmount;
    if (totalAmount < 0) totalAmount = 0;

    // ===== XÁC ĐỊNH / TẠO USER =====
    let userId = getCurrentUserId(req);  // nếu đang login
    let createdNewUser = false;
    let emailForAccount = null;

    if (!userId && email) {
      // 1. Nếu email đã tồn tại -> dùng user đó
      const [existingUserRows] = await conn.query(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email]
      );

      if (existingUserRows.length > 0) {
        userId = existingUserRows[0].id;
        // không tạo user mới, không show password default
      } else {
        // 2. Chưa có tài khoản -> tạo tài khoản mới với mật khẩu mặc định 123456
        const DEFAULT_PASSWORD = "123456";

        // ⚠️ Dùng đúng hàm hash bạn đang dùng ở chỗ đăng ký
        // Ví dụ:
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        const [insUser] = await conn.query(
          `INSERT INTO users (email, full_name, password_hash, provider, role)
           VALUES (?, ?, ?, 'local', 'customer')`,
          [email, full_name, passwordHash]
        );

        userId = insUser.insertId;
        createdNewUser = true;
        emailForAccount = email;
      }
    }

    // ===== LOYALTY POINTS =====
    const POINT_VALUE = 1000;
    const LOYALTY_RATE = 0.1;

    let pointDiscount = 0;
    let loyaltyPointsUsed = 0;
    let loyaltyPointsEarned = 0;
    let currentUserPoints = 0;

    if (userId) {
      const [lpRows] = await conn.query(
        "SELECT loyalty_points FROM users WHERE id = ? LIMIT 1",
        [userId]
      );
      currentUserPoints = lpRows[0]?.loyalty_points || 0;

      // Dùng điểm thưởng
      if (useLoyaltyPoints && currentUserPoints > 0 && totalAmount > 0) {
        loyaltyPointsUsed = currentUserPoints;

        const potentialDiscount = loyaltyPointsUsed * POINT_VALUE;
        pointDiscount = Math.min(potentialDiscount, totalAmount);

        totalAmount -= pointDiscount;
        if (totalAmount < 0) totalAmount = 0;

        currentUserPoints = 0;
      }

      // Tính điểm mới được cộng
      const baseForPoints = totalAmount;
      if (baseForPoints > 0) {
        const moneyForPoints = Math.floor(baseForPoints * LOYALTY_RATE);
        loyaltyPointsEarned = Math.floor(moneyForPoints / POINT_VALUE);
      }

      const newTotalPoints = currentUserPoints + loyaltyPointsEarned;

      await conn.query(
        "UPDATE users SET loyalty_points = ? WHERE id = ?",
        [newTotalPoints, userId]
      );
    }

    // ===== LƯU ĐỊA CHỈ =====
    if (userId && (createdNewUser || saveAddress)) {
      await conn.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [
        userId,
      ]);

      await conn.query(
        `INSERT INTO addresses
           (user_id, label, receiver_name, phone, details, district, city, postal_code, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          userId,
          "Địa chỉ giao hàng",
          receiver_name,
          phone,
          address_details,
          district,
          city,
          postal_code || "",
        ]
      );
    }

    // ===== TẠO ĐƠN HÀNG =====
    const [orderRes] = await conn.query(
      `INSERT INTO orders
         (user_id, email, full_name, receiver_name, phone, address_details, district, city, postal_code,
          subtotal, tax, shipping_fee, discount_amount, total_amount, coupon_code, status,
          point_discount, loyalty_points_used, loyalty_points_earned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        email,
        full_name,
        receiver_name,
        phone,
        address_details,
        district,
        city,
        postal_code || null,
        subtotal,
        tax,
        shippingFee,
        discountAmount,
        totalAmount,
        appliedCouponCode,
        "pending",
        pointDiscount,
        loyaltyPointsUsed,
        loyaltyPointsEarned,
      ]
    );

    const orderId = orderRes.insertId;

    // Lưu các item
    for (const item of normalizedItems) {
      await conn.query(
        `INSERT INTO order_items
           (order_id, product_id, variant_id, name, attrs, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.product_id,
          item.variant_id || 0,
          item.name,
          item.attrs ? JSON.stringify(item.attrs) : null,
          item.unit_price,
          item.qty,
          item.line_total,
        ]
      );
    }

    // Cập nhật coupon
    if (appliedCouponRow && appliedCouponRow.id) {
      const effectiveMaxUses = Math.min(
        appliedCouponRow.max_uses || 0,
        10
      );
      await conn.query(
        "UPDATE discount_codes SET used_count = used_count + 1 WHERE id = ? AND used_count < ?",
        [appliedCouponRow.id, effectiveMaxUses]
      );
    }

    // ===== GỬI EMAIL XÁC NHẬN ĐƠN =====
    const guestCreated = createdNewUser;
    if (!emailForAccount) {
      emailForAccount = email; // vẫn dùng email đặt hàng để gửi mail
    }

    try {
      await sendMail({
        to: emailForAccount,
        subject: `Xác nhận đơn hàng #${orderId}`,
        html: buildOrderEmailHtml({
          order: {
            id: orderId,
            email,
            subtotal,
            tax,
            shipping_fee: shippingFee,
            discount_amount: discountAmount + pointDiscount,
            total_amount: totalAmount,
          },
          items,
          guestCreated,
          // nếu muốn, bạn có thể truyền thêm defaultPassword: "123456" vào template email
        }),
      });
    } catch (mailErr) {
      console.error("Lỗi gửi email xác nhận đơn:", mailErr);
    }

    // ===== RESPONSE CHO FRONTEND (checkout.js) =====
    res.json({
      message: "Đặt hàng thành công.",
      order: {
        id: orderId,
        subtotal,
        tax,
        shipping_fee: shippingFee,
        discount_amount: discountAmount,
        point_discount: pointDiscount,
        total_amount: totalAmount,
        coupon_code: appliedCouponCode,
        loyalty_points_used: loyaltyPointsUsed,
        loyalty_points_earned: loyaltyPointsEarned,
        payment_method: paymentMethod || "cod",
      },
      guestCreated,          // true nếu vừa auto tạo tài khoản
      emailForAccount,       // email dùng để đăng nhập
    });
  } catch (err) {
    next(err);
  }
});


/* ===========================
   ĐƠN HÀNG CỦA TÔI
   =========================== */

router.get("/api/my-orders", requireLogin, async (req, res, next) => {
  try {
    const userId = getCurrentUserId(req);

    const [rows] = await db.query(
      `SELECT
         o.id,
         o.created_at,
         o.total_amount,
         o.status,
         COUNT(oi.id) AS total_items,
         SUM(oi.qty) AS total_qty,
         GROUP_CONCAT(CONCAT(oi.name, ' x', oi.qty) SEPARATOR ', ') AS items_summary
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ?
       GROUP BY o.id, o.created_at, o.total_amount, o.status
       ORDER BY o.created_at DESC`,
      [userId]
    );

    const orders = rows.map((o) => ({
      id: o.id,
      created_at: o.created_at,
      total_amount: o.total_amount,
      status: o.status,
      total_items: o.total_items,
      total_qty: o.total_qty,
      items_summary: o.items_summary || "",
    }));

    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// Chi tiết 1 đơn hàng + lịch sử trạng thái (của user hiện tại)
router.get("/api/orders/:id", async (req, res, next) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res
        .status(401)
        .json({ message: "Vui lòng đăng nhập để xem chi tiết đơn hàng." });
    }

    const orderId = parseInt(req.params.id, 10);
    if (!orderId) {
      return res.status(400).json({ message: "Mã đơn hàng không hợp lệ." });
    }

    const [oRows] = await db.query(
      `SELECT *
       FROM orders
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [orderId, userId]
    );

    if (oRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy đơn hàng của bạn." });
    }

    const order = oRows[0];

    // 🔥 JOIN với products để lấy slug
    const [itemRows] = await db.query(
      `SELECT 
          oi.product_id,
          oi.variant_id,
          oi.name,
          oi.attrs,
          oi.unit_price,
          oi.qty,
          p.slug AS product_slug
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    const IMAGE_BASE = "/acess/product";

    const items = itemRows.map((r) => {
      let variantText = null;
      if (r.attrs) {
        try {
          const obj = JSON.parse(r.attrs);
          const parts = [];
          for (const [k, v] of Object.entries(obj)) {
            parts.push(`${k}: ${v}`);
          }
          variantText = parts.join(", ");
        } catch (e) {
          variantText = null;
        }
      }

      const slug = r.product_slug;
      const image = slug ? `${IMAGE_BASE}/${slug}-1.jpg` : null;

      return {
        product_id: r.product_id,
        variant_id: r.variant_id,
        product_name: r.name,
        variant_text: variantText,
        price: r.unit_price,
        qty: r.qty,
        // 👇 thêm các field phục vụ ảnh
        product_slug: slug,
        slug: slug,
        image: image,
      };
    });

    let statusHistory = [];
    try {
      const [hRows] = await db.query(
        `SELECT status, note, created_at
         FROM order_status_history
         WHERE order_id = ?
         ORDER BY created_at DESC`,
        [orderId]
      );
      statusHistory = hRows;
    } catch (e) {
      statusHistory = [];
    }

    return res.json({
      order: {
        id: order.id,
        email: order.email,
        status: order.status,
        created_at: order.created_at,
        receiver_name: order.receiver_name,
        full_name: order.full_name,
        phone: order.phone,
        address_details: order.address_details,
        district: order.district,
        city: order.city,
        postal_code: order.postal_code,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping_fee: order.shipping_fee,
        discount_amount: order.discount_amount,
        total_amount: order.total_amount,
      },
      items,
      statusHistory,
    });
  } catch (err) {
    next(err);
  }
});


/* ===========================
   KIỂM TRA MÃ GIẢM GIÁ
   =========================== */

router.post("/api/discount/validate", async (req, res, next) => {
  try {
    let { code } = req.body || {};

    if (!code || typeof code !== "string") {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập mã giảm giá." });
    }

    code = code.trim().toUpperCase();

    if (!/^[A-Z0-9]{5}$/.test(code)) {
      return res.status(400).json({
        message: "Mã giảm giá phải gồm 5 ký tự chữ và số.",
      });
    }

    const [rows] = await db.query(
      "SELECT id, code, percent_off, max_uses, used_count FROM discount_codes WHERE code = ?",
      [code]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        message: "Mã giảm giá không tồn tại.",
      });
    }

    const coupon = rows[0];
    const effectiveMaxUses = Math.min(coupon.max_uses || 0, 10);

    if (effectiveMaxUses <= 0) {
      return res.status(400).json({
        message: "Mã giảm giá đã hết hiệu lực.",
      });
    }

    if (coupon.used_count >= effectiveMaxUses) {
      return res.status(400).json({
        message:
          "Mã giảm giá này đã được sử dụng hết số lần cho phép.",
      });
    }

    const remaining = effectiveMaxUses - coupon.used_count;

    return res.json({
      valid: true,
      id: coupon.id,
      code: coupon.code,
      percent_off: coupon.percent_off,
      max_uses: effectiveMaxUses,
      used_count: coupon.used_count,
      remaining_uses: remaining,
      message: "Mã giảm giá hợp lệ.",
    });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   HÀM HỖ TRỢ EMAIL
   =========================== */

function buildOrderEmailHtml({ order, items, guestCreated }) {
  let itemsHtml = (items || [])
    .map((it) => {
      const price = Number(it.price) || 0;
      const qty = Number(it.qty) || 0;
      const lineTotal = price * qty;
      return `
        <tr>
          <td>${escapeHtml(it.name || "")}${
        it.variantText
          ? `<br/><small>${escapeHtml(it.variantText)}</small>`
          : ""
      }</td>
          <td style="text-align:center;">${qty}</td>
          <td style="text-align:right;">${formatPrice(price)}</td>
          <td style="text-align:right;">${formatPrice(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <h2>Cảm ơn bạn đã đặt hàng tại Cửa hàng PC / Laptop!</h2>
    <p>Đơn hàng #${order.id} của bạn đã được tiếp nhận.</p>

    <h3>Chi tiết đơn hàng</h3>
    <table width="100%" border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th align="left">Sản phẩm</th>
          <th align="center">SL</th>
          <th align="right">Đơn giá</th>
          <th align="right">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p>
      Tạm tính: <strong>${formatPrice(order.subtotal)}</strong><br/>
      Thuế (10%): <strong>${formatPrice(order.tax)}</strong><br/>
      Phí vận chuyển: <strong>${formatPrice(order.shipping_fee)}</strong><br/>
      Giảm giá: <strong>${
        order.discount_amount > 0
          ? "-" + formatPrice(order.discount_amount)
          : "0₫"
      }</strong><br/>
      Tổng thanh toán: <strong>${formatPrice(order.total_amount)}</strong>
    </p>

    ${
      guestCreated
        ? `
      <hr/>
      <p>
        Hệ thống đã tạo tài khoản cho bạn với email:<br/>
        <strong>${escapeHtml(order.email || "")}</strong><br/>
        (Vui lòng liên hệ quản trị để nhận / đặt lại mật khẩu đăng nhập.)
      </p>
    `
        : ""
    }

    <p>
      Thân mến,<br/>
      Cửa hàng PC / Laptop
    </p>
  `;
}

/* ===========================
   API LỊCH SỬ ĐƠN HÀNG ACCOUNT
   =========================== */

router.get("/api/account/orders", async (req, res, next) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res
        .status(401)
        .json({ message: "Vui lòng đăng nhập để xem lịch sử đơn hàng." });
    }

    const statusFilter = (req.query.status || "").trim();

    let where = "WHERE o.user_id = ?";
    const params = [userId];

    if (statusFilter) {
      where += " AND o.status = ?";
      params.push(statusFilter);
    }

    const [rows] = await db.query(
      `SELECT
          o.id,
          o.status,
          o.created_at,
          o.total_amount,
          o.subtotal,
          o.discount_amount,
          o.shipping_fee,
          o.tax
       FROM orders o
       ${where}
       ORDER BY o.created_at DESC`,
      params
    );

    const orderIds = rows.map((r) => r.id);
    let itemsByOrder = {};
    if (orderIds.length > 0) {
      const [itemRows] = await db.query(
        `SELECT order_id, name, qty
         FROM order_items
         WHERE order_id IN (?)`,
        [orderIds]
      );

      itemsByOrder = {};
      orderIds.forEach((id) => {
        itemsByOrder[id] = [];
      });

      for (const it of itemRows) {
        if (!itemsByOrder[it.order_id]) {
          itemsByOrder[it.order_id] = [];
        }
        itemsByOrder[it.order_id].push({
          name: it.name,
          qty: it.qty,
        });
      }
    }

    const orders = rows.map((o) => ({
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      total_amount: o.total_amount,
      subtotal: o.subtotal,
      discount_amount: o.discount_amount,
      shipping_fee: o.shipping_fee,
      tax: o.tax,
      items: itemsByOrder[o.id] || [],
    }));

    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   HELPER LƯU ẢNH SẢN PHẨM (slug-1/2/3)
   =========================== */

async function saveProductImages(productId, slug, files) {
  const uploadDir = path.join(__dirname, "..", "public", "acess", "product");
  await fs.promises.mkdir(uploadDir, { recursive: true });

  // Xoá bản ghi cũ
  await db.query("DELETE FROM product_images WHERE product_id = ?", [productId]);

  const fields = ["image1", "image2", "image3"];

  for (let idx = 0; idx < fields.length; idx++) {
    const field = fields[idx];
    const file = files?.[field]?.[0];
    if (!file) continue;

    const order = idx + 1;
    const filename = `${slug}-${order}.jpg`;
    const destPath = path.join(uploadDir, filename);

    await fs.promises.writeFile(destPath, file.buffer);

    const url = `/acess/product/${filename}`;
    await db.query(
      "INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)",
      [productId, url, order]
    );
  }
}

/* ===========================
   API ADMIN: DASHBOARD
   =========================== */

// GET /api/admin/dashboard/overview
router.get("/api/admin/dashboard/overview", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const [userCountRows] = await db.query(
      "SELECT COUNT(*) AS total_users FROM users"
    );
    const totalUsers = userCountRows[0]?.total_users || 0;

    const [newUserRows] = await db.query(
      `SELECT COUNT(*) AS new_users
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
    );
    const newUsers30d = newUserRows[0]?.new_users || 0;

    const [orderCountRows] = await db.query(
      `SELECT COUNT(*) AS total_orders
       FROM orders
       WHERE status <> 'cancelled'`
    );
    const totalOrders = orderCountRows[0]?.total_orders || 0;

    const [revenueRows] = await db.query(
      `SELECT
          COALESCE(SUM(total_amount), 0) AS revenue_total,
          COALESCE(SUM(
            CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                 THEN total_amount ELSE 0 END
          ), 0) AS revenue_30d
       FROM orders
       WHERE status <> 'cancelled'`
    );
    const totalRevenue = revenueRows[0]?.revenue_total || 0;
    const revenue30d = revenueRows[0]?.revenue_30d || 0;

    const [statusRows] = await db.query(
      `SELECT status, COUNT(*) AS count
       FROM orders
       GROUP BY status`
    );

    const [bestRows] = await db.query(
      `SELECT
          oi.product_id,
          p.name,
          p.slug,
          SUM(oi.qty) AS total_qty,
          SUM(oi.line_total) AS total_revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.status <> 'cancelled'
       GROUP BY oi.product_id, p.name, p.slug
       ORDER BY total_qty DESC
       LIMIT 5`
    );

    res.json({
      user: {
        id: adminUser.id,
        email: adminUser.email,
        full_name: adminUser.full_name,
      },
      overview: {
        totalUsers,
        newUsers30d,
        totalOrders,
        totalRevenue,
        revenue30d,
        ordersByStatus: statusRows.map((r) => ({
          status: r.status,
          count: r.count,
        })),
      },
      bestSellers: bestRows.map((r) => ({
        productId: r.product_id,
        name: r.name,
        slug: r.slug,
        qtySold: r.total_qty,
        revenue: r.total_revenue,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/dashboard/advanced
router.get("/api/admin/dashboard/advanced", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    let { groupBy, startDate, endDate } = req.query;
    groupBy = groupBy || "month";

    const now = new Date();
    const year = now.getFullYear();

    if (!startDate || !endDate) {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    let groupExpr = 'DATE_FORMAT(o.created_at, "%Y-%m")';
    let labelExpr = 'DATE_FORMAT(o.created_at, "%Y-%m")';

    switch (groupBy) {
      case "year":
        groupExpr = "YEAR(o.created_at)";
        labelExpr = 'DATE_FORMAT(o.created_at, "%Y")';
        break;
      case "quarter":
        groupExpr = "CONCAT(YEAR(o.created_at), '-Q', QUARTER(o.created_at))";
        labelExpr = groupExpr;
        break;
      case "week":
        groupExpr = "DATE_FORMAT(o.created_at, '%x-W%v')";
        labelExpr = groupExpr;
        break;
      case "day":
        groupExpr = "DATE(o.created_at)";
        labelExpr = 'DATE_FORMAT(o.created_at, "%Y-%m-%d")';
        break;
      case "month":
      default:
        groupExpr = 'DATE_FORMAT(o.created_at, "%Y-%m")';
        labelExpr = groupExpr;
        groupBy = "month";
        break;
    }

    const [rows] = await db.query(
      `
      SELECT
        ${groupExpr} AS period_key,
        ${labelExpr} AS label,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS revenue,
        COALESCE(SUM(o.total_amount), 0) AS profit,
        COALESCE(SUM(oi.qty), 0) AS items_sold,
        COUNT(DISTINCT oi.product_id) AS distinct_products,
        COUNT(DISTINCT c.id) AS distinct_categories
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_categories pc ON pc.product_id = p.id
      LEFT JOIN categories c ON c.id = pc.category_id
      WHERE
        o.created_at BETWEEN ? AND ?
        AND o.status <> 'cancelled'
      GROUP BY period_key, label
      ORDER BY MIN(o.created_at)
      `,
      [`${startDate} 00:00:00`, `${endDate} 23:59:59`]
    );

    const series = rows.map((r) => ({
      key: r.period_key,
      label: r.label,
      orderCount: Number(r.order_count) || 0,
      revenue: Number(r.revenue) || 0,
      profit: Number(r.profit) || 0,
      itemsSold: Number(r.items_sold) || 0,
      distinctProducts: Number(r.distinct_products) || 0,
      distinctCategories: Number(r.distinct_categories) || 0,
    }));

    const totals = series.reduce(
      (acc, cur) => {
        acc.orderCount += cur.orderCount;
        acc.revenue += cur.revenue;
        acc.profit += cur.profit;
        acc.itemsSold += cur.itemsSold;
        acc.distinctProducts = Math.max(
          acc.distinctProducts,
          cur.distinctProducts
        );
        acc.distinctCategories = Math.max(
          acc.distinctCategories,
          cur.distinctCategories
        );
        return acc;
      },
      {
        orderCount: 0,
        revenue: 0,
        profit: 0,
        itemsSold: 0,
        distinctProducts: 0,
        distinctCategories: 0,
      }
    );

    res.json({
      user: {
        id: adminUser.id,
        email: adminUser.email,
        full_name: adminUser.full_name,
      },
      filter: {
        groupBy,
        startDate,
        endDate,
      },
      series,
      totals,
    });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   API ADMIN: PRODUCTS
   =========================== */

// LIST: GET /api/admin/products
// trả về: mỗi product có variants[] để hiển thị select biến thể trên list
router.get("/api/admin/products", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    const q = (req.query.q || "").trim();
    const category = (req.query.category || "").trim();
    const brand = (req.query.brand || "").trim();

    let where = "WHERE 1=1";
    const params = [];
    const paramsCount = [];

    if (q) {
      const like = `%${q}%`;
      where += " AND (p.name LIKE ? OR p.slug LIKE ? OR p.brand LIKE ?)";
      params.push(like, like, like);
      paramsCount.push(like, like, like);
    }

    if (brand) {
      where += " AND p.brand = ?";
      params.push(brand);
      paramsCount.push(brand);
    }

    if (category) {
      where += " AND (c.id = ? OR c.slug = ?)";
      params.push(category, category);
      paramsCount.push(category, category);
    }

    // 🔹 Không dùng sort nữa → luôn đếm theo điều kiện where
    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM products p
       LEFT JOIN product_categories pc ON pc.product_id = p.id
       LEFT JOIN categories c ON c.id = pc.category_id
       ${where}`,
      paramsCount
    );
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // 🔹 Luôn ORDER BY p.created_at DESC (mới nhất trước)
    const [rows] = await db.query(
      `SELECT
          p.id,
          p.slug,
          p.name,
          p.brand,
          p.sold,
          p.created_at,
          MAX(c.name) AS category_name
       FROM products p
       LEFT JOIN product_categories pc ON pc.product_id = p.id
       LEFT JOIN categories c ON c.id = pc.category_id
       ${where}
       GROUP BY p.id, p.slug, p.name, p.brand, p.sold, p.created_at
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const productIds = rows.map((r) => r.id);
    let variantsByProduct = {};

    if (productIds.length > 0) {
      const [variantRows] = await db.query(
        `SELECT
           v.id,
           v.product_id,
           v.sku,
           v.attrs,
           v.price,
           v.stock,
           COALESCE(SUM(
             CASE WHEN o.status <> 'cancelled' THEN oi.qty ELSE 0 END
           ), 0) AS sold_qty
         FROM product_variants v
         LEFT JOIN order_items oi
           ON oi.product_id = v.product_id
          AND oi.variant_id = v.id
         LEFT JOIN orders o ON o.id = oi.order_id
         WHERE v.product_id IN (?)
         GROUP BY v.id, v.product_id, v.sku, v.attrs, v.price, v.stock`,
        [productIds]
      );

      variantsByProduct = {};
      for (const v of variantRows) {
        let attrsObj = {};
        try {
          attrsObj = v.attrs ? JSON.parse(v.attrs) : {};
        } catch {
          attrsObj = {};
        }

        if (!variantsByProduct[v.product_id]) {
          variantsByProduct[v.product_id] = [];
        }
        variantsByProduct[v.product_id].push({
          id: v.id,
          sku: v.sku,
          attrs: attrsObj,
          price: v.price,
          stock: v.stock,
          soldQty: v.sold_qty || 0,
        });
      }
    }

    const products = rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      soldTotal: p.sold,
      createdAt: p.created_at,
      categoryName: p.category_name,
      variants: variantsByProduct[p.id] || [],
    }));

    res.json({
      products,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (err) {
    next(err);
  }
});


// DETAIL: GET /api/admin/products/:id
router.get("/api/admin/products/:id", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const productId = parseInt(req.params.id, 10);
    if (!productId) {
      return res.status(400).json({ message: "Mã sản phẩm không hợp lệ." });
    }

    const [productRows] = await db.query(
      `SELECT id, slug, name, brand, short_desc, descriptions, sold, created_at
       FROM products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );
    if (productRows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }
    const product = productRows[0];

    // Danh mục
    const [catRows] = await db.query(
      `SELECT c.id, c.slug, c.name
       FROM categories c
       JOIN product_categories pc ON pc.category_id = c.id
       WHERE pc.product_id = ?
       ORDER BY c.name ASC`,
      [productId]
    );
    const categoryIds = catRows.map((c) => c.id);

    // Biến thể
    const [variantRows] = await db.query(
      `SELECT
          v.id,
          v.sku,
          v.attrs,
          v.price,
          v.stock,
          COALESCE(SUM(
            CASE WHEN o.status <> 'cancelled' THEN oi.qty ELSE 0 END
          ), 0) AS sold_qty
       FROM product_variants v
       LEFT JOIN order_items oi ON oi.variant_id = v.id
       LEFT JOIN orders o ON o.id = oi.order_id
       WHERE v.product_id = ?
       GROUP BY v.id, v.sku, v.attrs, v.price, v.stock
       ORDER BY v.id ASC`,
      [productId]
    );

    const variants = variantRows.map((v) => {
      let attrsObj = {};
      try {
        attrsObj = v.attrs ? JSON.parse(v.attrs) : {};
      } catch {
        attrsObj = {};
      }
      return {
        id: v.id,
        sku: v.sku,
        attrs: attrsObj,
        price: v.price,
        stock: v.stock,
        sold: v.sold_qty || 0,
      };
    });

    // Ảnh
    const [imgRows] = await db.query(
      `SELECT id, image_url, sort_order
       FROM product_images
       WHERE product_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [productId]
    );

    res.json({
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        short_desc: product.short_desc,
        descriptions: product.descriptions,
        sold: product.sold,
        created_at: product.created_at,
        categoryIds,
      },
      categories: catRows,
      variants,
      images: imgRows,
    });
  } catch (err) {
    next(err);
  }
});

// CREATE: POST /api/admin/products
// multipart/form-data: name, slug?, brand, short_desc, descriptions, categoryId,
// variants (JSON), image1/2/3
// CREATE: POST /api/admin/products
// multipart/form-data: name, slug?, brand, short_desc, descriptions,
// categoryIds (JSON hoặc 1 giá trị), variants (JSON), image1/2/3
router.post(
  "/api/admin/products",
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const adminUser = await getAdminUserOr403(req, res);
      if (!adminUser) return;

      const { name, slug, brand, short_desc, descriptions, categoryId } =
        req.body || {};

      if (!name || !name.trim()) {
        return res
          .status(400)
          .json({ message: "Tên sản phẩm không được để trống." });
      }

      let finalSlug = (slug && slug.trim()) || slugify(name);
      // đảm bảo slug không trùng
      const [slugRows] = await db.query(
        "SELECT id FROM products WHERE slug = ? LIMIT 1",
        [finalSlug]
      );
      if (slugRows.length > 0) {
        finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
      }

      const [insRes] = await db.query(
        `INSERT INTO products
           (name, slug, brand, short_desc, descriptions, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          name.trim(),
          finalSlug,
          brand || null,
          short_desc || null,
          descriptions || null,
        ]
      );
      const productId = insRes.insertId;

      // ===== Danh mục (nhiều cái) =====
      let categoryIds = [];
      if (req.body.categoryIds) {
        try {
          categoryIds = JSON.parse(req.body.categoryIds);
        } catch (e) {
          if (Array.isArray(req.body.categoryIds)) {
            categoryIds = req.body.categoryIds;
          } else {
            categoryIds = [req.body.categoryIds];
          }
        }
      } else if (typeof categoryId !== "undefined") {
        categoryIds = [categoryId];
      }

      categoryIds = (categoryIds || [])
        .map((id) => parseInt(id, 10))
        .filter((id) => !Number.isNaN(id) && id > 0);

      if (categoryIds.length > 0) {
        const uniqueCatIds = [...new Set(categoryIds)];
        for (const cid of uniqueCatIds) {
          await db.query(
            "INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)",
            [productId, cid]
          );
        }
      }

      // ===== Biến thể =====
      let variants = [];
      if (req.body.variants) {
        try {
          variants = JSON.parse(req.body.variants);
        } catch (e) {
          console.error("Parse variants error:", e);
        }
      }

      // nếu không có thì tạo 1 biến thể mặc định
      if (!Array.isArray(variants) || variants.length === 0) {
        variants = [
          {
            sku: "",
            attrs: {},
            price: 0,
            stock: 0,
          },
        ];
      }

      for (const v of variants) {
        const attrsObj =
          v.attrs && typeof v.attrs === "object" ? v.attrs : {};
        const vPrice = Number(v.price) || 0;
        const vStock = Number(v.stock) || 0;

        await db.query(
          `INSERT INTO product_variants (product_id, sku, attrs, price, stock)
           VALUES (?, ?, ?, ?, ?)`,
          [
            productId,
            v.sku || null,
            Object.keys(attrsObj).length ? JSON.stringify(attrsObj) : null,
            vPrice,
            vStock,
          ]
        );
      }

      // ===== Ảnh =====
      const hasFiles =
        req.files &&
        Object.values(req.files).some(
          (arr) => Array.isArray(arr) && arr.length > 0
        );
      if (hasFiles) {
        await saveProductImages(productId, finalSlug, req.files);
      }

      res.json({ message: "Đã thêm sản phẩm.", productId, slug: finalSlug });
    } catch (err) {
      next(err);
    }
  }
);


// UPDATE: PUT /api/admin/products/:id
// UPDATE: PUT /api/admin/products/:id
router.put(
  "/api/admin/products/:id",
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const adminUser = await getAdminUserOr403(req, res);
      if (!adminUser) return;

      const productId = parseInt(req.params.id, 10);
      if (!productId) {
        return res.status(400).json({ message: "Mã sản phẩm không hợp lệ." });
      }

      const {
        name,
        slug,
        brand,
        short_desc,
        descriptions,
        categoryId, // để tương thích cũ
      } = req.body || {};

      const [pRows] = await db.query(
        "SELECT id, slug FROM products WHERE id = ? LIMIT 1",
        [productId]
      );
      if (pRows.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
      }

      const currentSlug = pRows[0].slug;
      let finalSlug = (slug && slug.trim()) || currentSlug || slugify(name);

      if (!name || !name.trim()) {
        return res
          .status(400)
          .json({ message: "Tên sản phẩm không được để trống." });
      }

      if (finalSlug !== currentSlug) {
        const [slugRows] = await db.query(
          "SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1",
          [finalSlug, productId]
        );
        if (slugRows.length > 0) {
          finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
        }
      }

      await db.query(
        `UPDATE products
         SET name = ?, slug = ?, brand = ?, short_desc = ?, descriptions = ?
         WHERE id = ?`,
        [
          name.trim(),
          finalSlug,
          brand || null,
          short_desc || null,
          descriptions || null,
          productId,
        ]
      );

      // ===== Danh mục (nhiều cái) =====
      await db.query("DELETE FROM product_categories WHERE product_id = ?", [
        productId,
      ]);

      let categoryIds = [];
      if (req.body.categoryIds) {
        try {
          categoryIds = JSON.parse(req.body.categoryIds);
        } catch (e) {
          if (Array.isArray(req.body.categoryIds)) {
            categoryIds = req.body.categoryIds;
          } else {
            categoryIds = [req.body.categoryIds];
          }
        }
      } else if (typeof categoryId !== "undefined") {
        categoryIds = [categoryId];
      }

      categoryIds = (categoryIds || [])
        .map((id) => parseInt(id, 10))
        .filter((id) => !Number.isNaN(id) && id > 0);

      if (categoryIds.length > 0) {
        const uniqueCatIds = [...new Set(categoryIds)];
        for (const cid of uniqueCatIds) {
          await db.query(
            "INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)",
            [productId, cid]
          );
        }
      }

      // ===== Biến thể =====
      let variants = [];
      if (req.body.variants) {
        try {
          variants = JSON.parse(req.body.variants);
        } catch (e) {
          console.error("Parse variants error:", e);
        }
      }

      if (Array.isArray(variants) && variants.length > 0) {
        const [oldVarRows] = await db.query(
          "SELECT id FROM product_variants WHERE product_id = ?",
          [productId]
        );
        const oldIds = oldVarRows.map((r) => r.id);
        const newIds = variants
          .map((v) => parseInt(v.id, 10))
          .filter((id) => id);

        const toDelete = oldIds.filter((id) => !newIds.includes(id));
        if (toDelete.length > 0) {
          await db.query(
            "DELETE FROM product_variants WHERE product_id = ? AND id IN (?)",
            [productId, toDelete]
          );
        }

        for (const v of variants) {
          const vId = parseInt(v.id, 10) || 0;
          const attrsObj =
            v.attrs && typeof v.attrs === "object" ? v.attrs : {};
          const vPrice = Number(v.price) || 0;
          const vStock = Number(v.stock) || 0;

          if (vId && oldIds.includes(vId)) {
            await db.query(
              `UPDATE product_variants
               SET sku = ?, attrs = ?, price = ?, stock = ?
               WHERE id = ? AND product_id = ?`,
              [
                v.sku || null,
                Object.keys(attrsObj).length
                  ? JSON.stringify(attrsObj)
                  : null,
                vPrice,
                vStock,
                vId,
                productId,
              ]
            );
          } else {
            await db.query(
              `INSERT INTO product_variants (product_id, sku, attrs, price, stock)
               VALUES (?, ?, ?, ?, ?)`,
              [
                productId,
                v.sku || null,
                Object.keys(attrsObj).length
                  ? JSON.stringify(attrsObj)
                  : null,
                vPrice,
                vStock,
              ]
            );
          }
        }
      }

      // ===== Ảnh =====
      const hasFiles =
        req.files &&
        Object.values(req.files).some(
          (arr) => Array.isArray(arr) && arr.length > 0
        );
      if (hasFiles) {
        await saveProductImages(productId, finalSlug, req.files);
      }

      res.json({
        message: "Đã cập nhật sản phẩm.",
        productId,
        slug: finalSlug,
      });
    } catch (err) {
      next(err);
    }
  }
);


// DELETE: /api/admin/products/:id
router.delete("/api/admin/products/:id", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const productId = parseInt(req.params.id, 10);
    if (!productId) {
      return res.status(400).json({ message: "Mã sản phẩm không hợp lệ." });
    }

    // Xoá các bảng phụ
    await db.query("DELETE FROM product_images WHERE product_id = ?", [
      productId,
    ]);
    await db.query("DELETE FROM product_variants WHERE product_id = ?", [
      productId,
    ]);
    await db.query("DELETE FROM product_categories WHERE product_id = ?", [
      productId,
    ]);

    await db.query("DELETE FROM products WHERE id = ?", [productId]);

    res.json({ message: "Đã xóa sản phẩm." });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   API ADMIN: USERS
   =========================== */

// GET /api/admin/users
router.get("/api/admin/users", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    const q = (req.query.q || "").trim();
    const role = (req.query.role || "").trim();
    const banned = (req.query.banned || "").trim(); // "1" | "0" | ""

    let where = "WHERE 1=1";
    const params = [];

    if (q) {
      const like = `%${q}%`;
      where += " AND (u.email LIKE ? OR u.full_name LIKE ?)";
      params.push(like, like);
    }

    if (role === "admin" || role === "customer") {
      where += " AND u.role = ?";
      params.push(role);
    }

    if (banned === "1" || banned === "0") {
      where += " AND u.is_banned = ?";
      params.push(banned === "1" ? 1 : 0);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM users u
       ${where}`,
      params
    );
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const [rows] = await db.query(
      `SELECT
          u.id,
          u.email,
          u.full_name,
          u.role,
          u.is_banned,
          u.loyalty_points,
          u.created_at
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const users = rows.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      is_banned: !!u.is_banned,
      loyalty_points: u.loyalty_points || 0,
      created_at: u.created_at,
    }));

    res.json({
      users,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id
router.get("/api/admin/users/:id", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const userId = parseInt(req.params.id, 10);
    if (!userId) {
      return res.status(400).json({ message: "Mã user không hợp lệ." });
    }

    const [rows] = await db.query(
      `SELECT
          id, email, full_name, role, is_banned, loyalty_points, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy user." });
    }

    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        is_banned: !!u.is_banned,
        loyalty_points: u.loyalty_points || 0,
        created_at: u.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id
router.put("/api/admin/users/:id", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const targetId = parseInt(req.params.id, 10);
    if (!targetId) {
      return res.status(400).json({ message: "Mã user không hợp lệ." });
    }

    const { full_name, role, is_banned, loyalty_points } = req.body || {};

    // DEBUG xem request thực tế nhận được
    // console.log("PUT /api/admin/users/:id body =", req.body);

    // role chỉ nhận "admin" hoặc "customer"
    let finalRole = role === "admin" || role === "customer" ? role : null;

    // CHỖ QUAN TRỌNG: chuyển is_banned về 0/1 chắc chắn
    let bannedFlag = 0;
    if (typeof is_banned === "boolean") {
      bannedFlag = is_banned ? 1 : 0;
    } else if (
      is_banned === "1" ||
      is_banned === 1 ||
      is_banned === "true" ||
      is_banned === "on" // phòng TH gửi form khác
    ) {
      bannedFlag = 1;
    } else {
      bannedFlag = 0;
    }

    // loyalty_points
    let points = parseInt(loyalty_points, 10);
    if (Number.isNaN(points) || points < 0) points = 0;

    const fields = [];
    const params = [];

    if (typeof full_name === "string") {
      fields.push("full_name = ?");
      params.push(full_name.trim());
    }

    if (finalRole) {
      fields.push("role = ?");
      params.push(finalRole);
    }

    // luôn update cờ is_banned
    fields.push("is_banned = ?");
    params.push(bannedFlag);

    // luôn update điểm
    fields.push("loyalty_points = ?");
    params.push(points);

    if (fields.length === 0) {
      return res.json({ message: "Không có gì để cập nhật." });
    }

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    params.push(targetId);

    await db.query(sql, params);

    return res.json({ message: "Đã cập nhật thông tin người dùng." });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   API ADMIN: ORDERS
   =========================== */

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipping",
  "completed",
  "cancelled",
];

// GET /api/admin/orders
// ?page=&limit=&status=&q=&date_from=&date_to=
router.get("/api/admin/orders", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    const status = (req.query.status || "").trim(); // pending / confirmed ...
    const q = (req.query.q || "").trim();          // search id/email/name
    const dateFrom = (req.query.date_from || "").trim();
    const dateTo = (req.query.date_to || "").trim();

    let where = "WHERE 1=1";
    const paramsCount = [];
    const params = [];

    // Lọc trạng thái
    if (ORDER_STATUSES.includes(status)) {
      where += " AND o.status = ?";
      paramsCount.push(status);
      params.push(status);
    }

    // Tìm kiếm theo id / email / tên
    if (q) {
      const like = `%${q}%`;
      where += " AND (o.email LIKE ? OR o.full_name LIKE ? OR o.receiver_name LIKE ? OR o.id = ?)";
      const idNum = parseInt(q, 10) || 0;
      paramsCount.push(like, like, like, idNum);
      params.push(like, like, like, idNum);
    }

    // Lọc theo ngày
    if (dateFrom) {
      where += " AND DATE(o.created_at) >= ?";
      paramsCount.push(dateFrom);
      params.push(dateFrom);
    }
    if (dateTo) {
      where += " AND DATE(o.created_at) <= ?";
      paramsCount.push(dateTo);
      params.push(dateTo);
    }

    // Đếm tổng
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM orders o
       ${where}`,
      paramsCount
    );
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // Lấy list + thống kê items
    const [rows] = await db.query(
      `SELECT
          o.id,
          o.email,
          o.full_name,
          o.receiver_name,
          o.phone,
          o.status,
          o.total_amount,
          o.created_at,
          COUNT(oi.id) AS total_items,
          COALESCE(SUM(oi.qty), 0) AS total_qty
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${where}
       GROUP BY o.id, o.email, o.full_name, o.receiver_name, o.phone, o.status, o.total_amount, o.created_at
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const orders = rows.map((o) => ({
      id: o.id,
      email: o.email,
      full_name: o.full_name,
      receiver_name: o.receiver_name,
      phone: o.phone,
      status: o.status,
      total_amount: o.total_amount,
      created_at: o.created_at,
      total_items: o.total_items,
      total_qty: o.total_qty,
    }));

    res.json({
      orders,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/orders/:id/status
router.put("/api/admin/orders/:id/status", async (req, res, next) => {
  try {
    // Chỉ cho admin
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const orderId = parseInt(req.params.id, 10);
    if (!orderId) {
      return res.status(400).json({ message: "Mã đơn hàng không hợp lệ." });
    }

    const { status, note } = req.body || {};

    // Chỉ cho phép các trạng thái hợp lệ
    if (!status || !ORDER_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ message: "Trạng thái đơn hàng không hợp lệ." });
    }

    // Kiểm tra đơn có tồn tại không
    const [oRows] = await db.query(
      "SELECT id, status FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );
    if (oRows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    const oldStatus = oRows[0].status;

    // Cập nhật trạng thái hiện tại trong bảng orders
    await db.query("UPDATE orders SET status = ? WHERE id = ?", [
      status,
      orderId,
    ]);

    // Ghi lịch sử trạng thái (nếu bạn có bảng order_status_history)
    await db.query(
      `INSERT INTO order_status_history (order_id, status, note, created_at)
       VALUES (?, ?, ?, NOW())`,
      [orderId, status, note || `Change from ${oldStatus} to ${status}`]
    );

    return res.json({
      message: "Đã cập nhật trạng thái đơn hàng.",
      status,
    });
  } catch (err) {
    next(err);
  }
});


// GET /api/admin/orders/:id
router.get("/api/admin/orders/:id", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const orderId = parseInt(req.params.id, 10);
    if (!orderId) {
      return res.status(400).json({ message: "Mã đơn hàng không hợp lệ." });
    }

    const [oRows] = await db.query(
      "SELECT * FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );
    if (oRows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }
    const order = oRows[0];

    const [itemRows] = await db.query(
      `SELECT product_id, variant_id, name, attrs, unit_price, qty, line_total
       FROM order_items
       WHERE order_id = ?`,
      [orderId]
    );

    const items = itemRows.map((r) => {
      let variantText = null;
      if (r.attrs) {
        try {
          const obj = JSON.parse(r.attrs);
          const parts = [];
          for (const [k, v] of Object.entries(obj)) {
            parts.push(`${k}: ${v}`);
          }
          variantText = parts.join(", ");
        } catch {
          variantText = null;
        }
      }
      return {
        product_id: r.product_id,
        variant_id: r.variant_id,
        product_name: r.name,
        variant_text: variantText,
        price: r.unit_price,
        qty: r.qty,
        line_total: r.line_total || r.unit_price * r.qty,
      };
    });

    let statusHistory = [];
    try {
      const [hRows] = await db.query(
        `SELECT status, note, created_at
         FROM order_status_history
         WHERE order_id = ?
         ORDER BY created_at DESC`,
        [orderId]
      );
      statusHistory = hRows.map((h) => ({
        status: h.status,
        note: h.note,
        created_at: h.created_at,
      }));
    } catch {
      statusHistory = [];
    }

    res.json({
      order: {
        id: order.id,
        email: order.email,
        full_name: order.full_name,
        receiver_name: order.receiver_name,
        phone: order.phone,
        address_details: order.address_details,
        district: order.district,
        city: order.city,
        postal_code: order.postal_code,
        status: order.status,
        created_at: order.created_at,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping_fee: order.shipping_fee,
        discount_amount: order.discount_amount,
        point_discount: order.point_discount,
        total_amount: order.total_amount,
        coupon_code: order.coupon_code,
        loyalty_points_used: order.loyalty_points_used,
        loyalty_points_earned: order.loyalty_points_earned,
      },
      items,
      statusHistory,
      allowedStatuses: ORDER_STATUSES,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/orders/:id/status
router.put("/api/admin/orders/:id/status", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const orderId = parseInt(req.params.id, 10);
    if (!orderId) {
      return res.status(400).json({ message: "Mã đơn hàng không hợp lệ." });
    }

    const { status, note } = req.body || {};
    if (!status || !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Trạng thái đơn hàng không hợp lệ." });
    }

    // Kiểm tra tồn tại đơn
    const [oRows] = await db.query(
      "SELECT id, status FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );
    if (oRows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    // Cập nhật orders
    await db.query(
      "UPDATE orders SET status = ? WHERE id = ?",
      [status, orderId]
    );

    // Ghi lịch sử
    await db.query(
      `INSERT INTO order_status_history (order_id, status, note, created_at)
       VALUES (?, ?, ?, NOW())`,
      [orderId, status, note || null]
    );

    // (Optional) Emit socket nếu sau này bạn muốn realtime cho admin/user
    // const io = req.app.get("io");
    // if (io) {
    //   io.to(`order_${orderId}`).emit("order:statusUpdated", {
    //     orderId,
    //     status,
    //     note: note || null,
    //     created_at: new Date().toISOString(),
    //   });
    // }

    res.json({ message: "Đã cập nhật trạng thái đơn hàng.", status });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   API ADMIN: DISCOUNTS
   =========================== */

// LIST: GET /api/admin/discounts
router.get("/api/admin/discounts", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    const q = (req.query.q || "").trim();

    let where = "WHERE 1=1";
    const params = [];

    if (q) {
      where += " AND dc.code LIKE ?";
      params.push(`%${q}%`);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM discount_codes dc
       ${where}`,
      params
    );
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const [rows] = await db.query(
      `SELECT
          dc.id,
          dc.code,
          dc.percent_off,
          dc.max_uses,
          dc.used_count,
          dc.created_at,
          COUNT(o.id) AS orders_count,
          COALESCE(SUM(o.total_amount), 0) AS orders_total_amount
       FROM discount_codes dc
       LEFT JOIN orders o ON o.coupon_code = dc.code
       ${where}
       GROUP BY dc.id, dc.code, dc.percent_off, dc.max_uses, dc.used_count, dc.created_at
       ORDER BY dc.created_at DESC, dc.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const discounts = rows.map((r) => {
      const maxUses = r.max_uses || 0;
      const effectiveMaxUses = Math.min(maxUses || 0, 10); // logic đang dùng ở checkout/validate
      const usedCount = r.used_count || 0;
      const remainingUses = Math.max(effectiveMaxUses - usedCount, 0);

      return {
        id: r.id,
        code: r.code,
        percent_off: r.percent_off,
        max_uses: maxUses,
        used_count: usedCount,
        effective_max_uses: effectiveMaxUses,
        remaining_uses: remainingUses,
        created_at: r.created_at,
        orders_count: r.orders_count || 0,
        orders_total_amount: r.orders_total_amount || 0,
      };
    });

    res.json({
      discounts,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DETAIL: GET /api/admin/discounts/:id
router.get("/api/admin/discounts/:id", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    const discountId = parseInt(req.params.id, 10);
    if (!discountId) {
      return res.status(400).json({ message: "Mã giảm giá không hợp lệ." });
    }

    const [rows] = await db.query(
      `SELECT
          id,
          code,
          percent_off,
          max_uses,
          used_count,
          created_at
       FROM discount_codes
       WHERE id = ?
       LIMIT 1`,
      [discountId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
    }

    const dc = rows[0];
    const maxUses = dc.max_uses || 0;
    const effectiveMaxUses = Math.min(maxUses || 0, 10);
    const usedCount = dc.used_count || 0;
    const remainingUses = Math.max(effectiveMaxUses - usedCount, 0);

    const [orderRows] = await db.query(
      `SELECT
          id,
          email,
          full_name,
          total_amount,
          status,
          created_at
       FROM orders
       WHERE coupon_code = ?
       ORDER BY created_at DESC`,
      [dc.code]
    );

    const orders = orderRows.map((o) => ({
      id: o.id,
      email: o.email,
      full_name: o.full_name,
      total_amount: o.total_amount,
      status: o.status,
      created_at: o.created_at,
    }));

    res.json({
      discount: {
        id: dc.id,
        code: dc.code,
        percent_off: dc.percent_off,
        max_uses: maxUses,
        used_count: usedCount,
        effective_max_uses: effectiveMaxUses,
        remaining_uses: remainingUses,
        created_at: dc.created_at,
        orders_count: orders.length,
      },
      orders,
    });
  } catch (err) {
    next(err);
  }
});

// CREATE: POST /api/admin/discounts
router.post("/api/admin/discounts", async (req, res, next) => {
  try {
    const adminUser = await getAdminUserOr403(req, res);
    if (!adminUser) return;

    let { code, percent_off, max_uses } = req.body || {};

    if (!code || typeof code !== "string") {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập mã giảm giá." });
    }

    code = code.trim().toUpperCase();

    if (!/^[A-Z0-9]{5}$/.test(code)) {
      return res.status(400).json({
        message: "Mã giảm giá phải gồm đúng 5 ký tự chữ và số (A-Z, 0-9).",
      });
    }

    let percent = parseInt(percent_off, 10);
    if (Number.isNaN(percent) || percent <= 0 || percent > 100) {
      return res.status(400).json({
        message: "Phần trăm giảm giá phải là số nguyên từ 1 đến 100.",
      });
    }

    let maxUses = parseInt(max_uses, 10);
    if (Number.isNaN(maxUses) || maxUses <= 0) {
      maxUses = 1;
    }

    const [exists] = await db.query(
      "SELECT id FROM discount_codes WHERE code = ? LIMIT 1",
      [code]
    );
    if (exists.length > 0) {
      return res
        .status(400)
        .json({ message: "Mã giảm giá này đã tồn tại, vui lòng chọn mã khác." });
    }

    // ⚠️ Lưu ý: cần đảm bảo bảng discount_codes có cột created_at (DATETIME/TIMESTAMP).
    const [insRes] = await db.query(
      `INSERT INTO discount_codes (code, percent_off, max_uses, used_count, created_at)
       VALUES (?, ?, ?, 0, NOW())`,
      [code, percent, maxUses]
    );

    res.status(201).json({
      message: "Đã tạo mã giảm giá.",
      discount: {
        id: insRes.insertId,
        code,
        percent_off: percent,
        max_uses: maxUses,
        used_count: 0,
      },
    });
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ message: "Mã giảm giá này đã tồn tại." });
    }
    next(err);
  }
});



/* ===========================
   HELPER FORMAT
   =========================== */

function formatPrice(num) {
  const n = Number(num) || 0;
  return n.toLocaleString("vi-VN") + "₫";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = router;
