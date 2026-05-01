const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { redeemLimiter } = require('../middleware/rateLimiter');

// ─────────────────────────────────────────
// POST /api/verify
// 查詢訂單（不發出序號，只確認訂單存在）
// ─────────────────────────────────────────
router.post('/verify', redeemLimiter, async (req, res) => {
  const { order_id } = req.body;

  if (!order_id || typeof order_id !== 'string') {
    return res.status(400).json({ success: false, error: '請輸入訂單編號' });
  }

  const cleanId = order_id.trim().toUpperCase();

  try {
    const result = await pool.query(
      'SELECT order_id, product_name, status, redeemed FROM orders WHERE order_id = $1',
      [cleanId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: '找不到此訂單編號，請確認後重新輸入。' 
      });
    }

    const order = result.rows[0];

    if (order.redeemed) {
      return res.json({
        success: true,
        redeemed: true,
        order_id: order.order_id,
        product_name: order.product_name,
        message: '此訂單已兌換過，如有疑問請聯繫客服。'
      });
    }

    // 產生短效 JWT（5 分鐘內有效），前端拿此 token 才能兌換
    const token = jwt.sign(
      { order_id: cleanId, action: 'redeem' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.json({
      success: true,
      redeemed: false,
      order_id: order.order_id,
      product_name: order.product_name,
      status: order.status,
      token  // 前端需儲存此 token，兌換時帶上
    });

  } catch (err) {
    console.error('[verify error]', err);
    return res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試。' });
  }
});


// ─────────────────────────────────────────
// POST /api/redeem
// 正式兌換（需帶 verify 回傳的 token）
// ─────────────────────────────────────────
router.post('/redeem', redeemLimiter, async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: '缺少驗證 token，請重新查詢訂單。' });
  }

  // 驗證 JWT
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token 已過期或無效，請重新查詢訂單。' });
  }

  const { order_id } = payload;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  // 使用 Transaction 確保不會重複發出序號
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 鎖定訂單，確認尚未兌換（FOR UPDATE 防止同時兌換）
    const orderResult = await client.query(
      'SELECT order_id, product_id, product_name, redeemed FROM orders WHERE order_id = $1 FOR UPDATE',
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: '訂單不存在。' });
    }

    const order = orderResult.rows[0];

    if (order.redeemed) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: '此訂單已兌換過。', redeemed: true });
    }

    // 2. 從序號池取出一筆未使用序號（SKIP LOCKED 防止 race condition）
    const codeResult = await client.query(
      `SELECT id, code FROM codes 
       WHERE product_id = $1 AND used = false 
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [order.product_id]
    );

    if (codeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error(`[redeem] 序號不足 product_id=${order.product_id}`);
      return res.status(503).json({ 
        success: false, 
        error: '序號暫時不足，請聯繫客服處理。' 
      });
    }

    const { id: codeId, code } = codeResult.rows[0];

    // 3. 標記序號為已使用
    await client.query(
      'UPDATE codes SET used = true, order_id = $1, assigned_at = NOW() WHERE id = $2',
      [order_id, codeId]
    );

    // 4. 標記訂單為已兌換
    await client.query(
      'UPDATE orders SET redeemed = true, redeemed_at = NOW(), status = $1 WHERE order_id = $2',
      ['redeemed', order_id]
    );

    // 5. 寫入兌換記錄
    await client.query(
      'INSERT INTO redemption_logs (order_id, code, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [order_id, code, ip, ua]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      order_id,
      product_name: order.product_name,
      code,
      redeemed_at: new Date().toISOString()
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[redeem error]', err);
    return res.status(500).json({ success: false, error: '兌換失敗，請稍後再試。' });
  } finally {
    client.release();
  }
});

module.exports = router;
