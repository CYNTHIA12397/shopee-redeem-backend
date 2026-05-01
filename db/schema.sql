-- =============================================
-- 蝦皮兌換系統 - 資料庫結構
-- 執行方式: node db/init.js
-- =============================================

-- 訂單表（從蝦皮 CSV 匯入）
CREATE TABLE IF NOT EXISTS orders (
  order_id      TEXT PRIMARY KEY,           -- 蝦皮訂單編號
  product_id    TEXT NOT NULL,              -- 對應商品 ID
  product_name  TEXT NOT NULL,              -- 商品名稱（顯示用）
  status        TEXT DEFAULT 'paid',        -- paid / redeemed / invalid
  redeemed      BOOLEAN DEFAULT false,
  redeemed_at   TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 序號池（你的數位商品序號）
CREATE TABLE IF NOT EXISTS codes (
  id            SERIAL PRIMARY KEY,
  product_id    TEXT NOT NULL,              -- 對應哪個商品
  code          TEXT NOT NULL UNIQUE,       -- 序號本體
  used          BOOLEAN DEFAULT false,
  order_id      TEXT REFERENCES orders(order_id),
  assigned_at   TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 兌換記錄（稽核 / 防詐用）
CREATE TABLE IF NOT EXISTS redemption_logs (
  id            SERIAL PRIMARY KEY,
  order_id      TEXT NOT NULL,
  code          TEXT NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 索引加速查詢
CREATE INDEX IF NOT EXISTS idx_codes_product_unused 
  ON codes(product_id) WHERE used = false;

CREATE INDEX IF NOT EXISTS idx_orders_status 
  ON orders(status);

CREATE INDEX IF NOT EXISTS idx_logs_order 
  ON redemption_logs(order_id);
