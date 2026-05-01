const rateLimit = require('express-rate-limit');

// 一般 API：每分鐘最多 20 次
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: '請求太頻繁，請稍後再試。' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 兌換 API：每小時每 IP 最多 10 次（防止暴力猜測）
const redeemLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: '兌換嘗試次數過多，請 1 小時後再試。' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, redeemLimiter };
