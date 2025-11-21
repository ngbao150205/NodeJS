const mysql = require('mysql2/promise');

let pool;

async function initDB() {
  if (!pool) {
    pool = await mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'estorepc',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      namedPlaceholders: true
    });
    console.log('✅ MySQL pool created');
  }
  return pool;
}

function getDB() {
  if (!pool) throw new Error('DB not initialized. Call initDB() first.');
  return pool;
}

module.exports = { initDB, getDB };
