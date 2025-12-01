// src/middlewares/adminOnly.js

/**
 * Middleware kiểm tra quyền admin.
 * YÊU CẦU: middleware auth đã chạy trước, nên req.user đã có { uid, email, role, ... }
 */
module.exports = (req, res, next) => {
  // Nếu chưa có user (chưa chạy auth hoặc token sai) -> 401
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Nếu không phải admin -> 403
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }

  // OK, cho đi tiếp
  next();
};