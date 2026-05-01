const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }  // Railway / Render 需要
    : false
});

// 測試連線
pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ 資料庫連線成功');
  }
});

pool.on('error', (err) => {
  console.error('❌ 資料庫連線錯誤:', err);
});

module.exports = pool;
