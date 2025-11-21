const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev';

module.exports = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ message: 'Invalid token' }); }
};
