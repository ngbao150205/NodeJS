const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev';

module.exports = (req, res, next) => {
  // 1) Lấy token từ header Authorization (khi PHP gửi)
  const h = req.headers.authorization || '';
  let token = h.startsWith('Bearer ') ? h.slice(7) : null;

  // 2) Nếu không có → lấy từ cookie (khi dashboard dùng JS → cookie tự gửi)
  if (!token && req.cookies?.authToken) {
    token = req.cookies.authToken;
  }

  // 3) Nếu vẫn không có token → báo lỗi
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // 4) Xác thực JWT
  try {
    req.user = jwt.verify(token, SECRET); // { uid, email, name, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
