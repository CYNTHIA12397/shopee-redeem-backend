const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const pool = require('../db/pool');

// 只接受記憶體內的檔案（不存到磁碟）
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// 簡易後台密鑰驗證（正式環境建議換成更嚴格的 auth）
const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: '無權限' });
  }
  next();
};

// ─────────────────────────────────────────
// POST /admin/import/orders
// 從蝦皮匯出的 CSV 匯入訂單
//
// CSV 欄位格式（蝦皮賣家後台匯出）：
// 訂單編號, 商品名稱, 商品ID, 訂單狀態
// ─────────────────────────────────────────
router.post('/import/orders', adminAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '請上傳 CSV 檔案' });
  }

  let records;
  try {
    records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: 'CSV 格式錯誤：' + err.message });
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const row of records) {
    // 支援蝦皮常見欄位名稱
    const orderId = (row['訂單編號'] || row['order_id'] || '').trim().toUpperCase();
    const productName = (row['商品名稱'] || row['product_name'] || '').trim();
    const productId = (row['商品ID'] || row['product_id'] || '').trim();

    if (!orderId || !productName || !productId) {
      errors.push(`略過不完整資料: ${JSON.stringify(row)}`);
      skipped++;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO orders (order_id, product_id, product_name, status)
         VALUES ($1, $2, $3, 'paid')
         ON CONFLICT (order_id) DO NOTHING`,
        [orderId, productId, productName]
      );
      imported++;
    } catch (err) {
      errors.push(`訂單 ${orderId} 匯入失敗: ${err.message}`);
      skipped++;
    }
  }

  return res.json({ 
    success: true, 
    imported, 
    skipped,
    errors: errors.slice(0, 10) // 最多顯示 10 筆錯誤
  });
});


// ─────────────────────────────────────────
// POST /admin/import/codes
// 上傳序號 CSV
//
// CSV 欄位格式：
// product_id, code
// ─────────────────────────────────────────
router.post('/import/codes', adminAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '請上傳 CSV 檔案' });
  }

  let records;
  try {
    records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: 'CSV 格式錯誤：' + err.message });
  }

  let imported = 0;
  let skipped = 0;

  for (const row of records) {
    const productId = (row['product_id'] || row['商品ID'] || '').trim();
    const code = (row['code'] || row['序號'] || '').trim();

    if (!productId || !code) { skipped++; continue; }

    try {
      await pool.query(
        `INSERT INTO codes (product_id, code) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
        [productId, code]
      );
      imported++;
    } catch {
      skipped++;
    }
  }

  return res.json({ success: true, imported, skipped });
});


// ─────────────────────────────────────────
// GET /admin/stats
// 查看目前庫存與兌換狀況
// ─────────────────────────────────────────
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [orders, codes, logs] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE NOT redeemed) AS pending,
          COUNT(*) FILTER (WHERE redeemed) AS redeemed,
          COUNT(*) AS total
        FROM orders
      `),
      pool.query(`
        SELECT product_id,
          COUNT(*) FILTER (WHERE NOT used) AS available,
          COUNT(*) FILTER (WHERE used) AS used,
          COUNT(*) AS total
        FROM codes
        GROUP BY product_id
        ORDER BY product_id
      `),
      pool.query(`
        SELECT COUNT(*) AS total_redeemed,
          DATE(created_at) AS date
        FROM redemption_logs
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 7
      `)
    ]);

    return res.json({
      success: true,
      orders: orders.rows[0],
      codes: codes.rows,
      recent_activity: logs.rows
    });
  } catch (err) {
    console.error('[stats error]', err);
    return res.status(500).json({ success: false, error: '查詢失敗' });
  }
});

module.exports = router;
