// backend/src/server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const { initDB } = require('./config/db');
const { initSocial } = require('./social');
const ordersRoutes = require('./routes/orders');
const adminDashboardRoutes = require('./routes/adminDashboard');
const adminCategoriesRoutes = require('./routes/adminCategories');
const adminUsersRouter = require('./routes/adminUsers');
const adminOrdersRouter = require('./routes/adminOrders');
const adminDiscountsRouter = require('./routes/adminDiscounts');


const app = express();

/* ===== Middlewares ===== */
app.use(morgan('dev'));
app.use(compression());


// cấu hình CORS – cho phép PHP chạy ở 8000 (hoặc chỉnh theo thực tế)
const ALLOW_ORIGINS = [
  process.env.FRONTEND_BASE_URL || 'http://localhost:8000',
  'http://localhost', // nếu chạy Apache/XAMPP
];
app.use(cors({
  origin: (origin, cb) => cb(null, true), // nới lỏng để tiện dev; khi deploy nên dùng danh sách ALLOW_ORIGINS
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ===== Init DB ===== */
initDB()
  .then(() => console.log('🚀 DB ready'))
  .catch((e) => {
    console.error('❌ DB error:', e);
    process.exit(1);
  });

/* ===== Health check ===== */
app.get('/healthz', (req, res) => res.json({ ok: true }));

/* ===== API Routes ===== */
app.use('/api/home', require('./routes/home'));
app.use('/api/products', require('./routes/products'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/addresses', require('./routes/addresses'));
app.use('/api/orders', ordersRoutes);

// CHÚ Ý: file phải là ./routes/product-detail.js (không phải product-details)
app.use('/api/product', require('./routes/product-detail'));

app.use('/api/admin/dashboard', adminDashboardRoutes);

app.use('/api/admin/products', require('./routes/adminProducts'));

app.use('/api/admin/categories', adminCategoriesRoutes);

app.use('/api/admin/users', adminUsersRouter);

app.use('/api/admin/orders', adminOrdersRouter);

app.use('/api/admin/discount-codes', adminDiscountsRouter);

/* ===== Social OAuth (Passport) ===== */
initSocial(app);

/* ===== 404 & Error handlers ===== */
app.use((req, res, next) => {
  return res.status(404).json({ message: 'Not Found' });
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Server error' });
});

/* ===== Start HTTP server ===== */
const http = require('http');
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`running in http://localhost:${PORT}`);
});
