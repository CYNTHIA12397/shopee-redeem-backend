require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rateLimiter');

const redeemRoutes = require('./routes/redeem');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 安全性中間件 ──
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-admin-key']
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

// ── 路由 ──
app.use('/api', redeemRoutes);
app.use('/admin', adminRoutes);

// ── 健康檢查（部署平台用）──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ── 全域錯誤處理 ──
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ success: false, error: '伺服器內部錯誤' });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行中：http://localhost:${PORT}`);
  console.log(`環境：${process.env.NODE_ENV || 'development'}`);
});
