const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ 資料庫初始化完成');
  } catch (err) {
    console.error('❌ 初始化失敗:', err.message);
  } finally {
    await pool.end();
  }
}

init();
