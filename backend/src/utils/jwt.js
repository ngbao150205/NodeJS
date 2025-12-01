// utils/jwt.js
const jwt = require('jsonwebtoken');

const SECRET  = process.env.JWT_SECRET || 'dev';
const EXPIRES = '7d';

function signUser(u) {
  return jwt.sign(
    { uid: u.id, email: u.email, name: u.full_name, role: u.role },
    SECRET,
    { expiresIn: EXPIRES }
  );
}

module.exports = { signUser, SECRET, EXPIRES };
