# 🎁 蝦皮訂單自助兌換系統 — 後端

## 專案結構

```
shopee-redeem-backend/
├── server.js                  # 主程式入口
├── .env.example               # 環境變數範本
├── package.json
├── db/
│   ├── pool.js                # 資料庫連線池
│   ├── schema.sql             # 資料庫建表 SQL
│   └── init.js                # 初始化腳本
├── routes/
│   ├── redeem.js              # 兌換 API（/api/verify、/api/redeem）
│   └── admin.js               # 後台管理 API（匯入訂單、序號）
├── middleware/
│   └── rateLimiter.js         # 速率限制
└── utils/
    └── frontend-api-bridge.js # 前端串接範例程式碼
```

---

## 🚀 快速部署（Railway，推薦）

### 步驟 1：建立 Railway 專案
1. 前往 [railway.app](https://railway.app) 登入
2. 點 **New Project → Deploy from GitHub repo**
3. 選擇此專案的 GitHub repository

### 步驟 2：加入 PostgreSQL
1. 在 Railway 專案中點 **+ Add Service → Database → PostgreSQL**
2. 建立後點 PostgreSQL 服務 → **Variables** → 複製 `DATABASE_URL`

### 步驟 3：設定環境變數
在 Railway 的 **Variables** 頁面加入：
```
DATABASE_URL=（從 PostgreSQL 服務複製）
JWT_SECRET=（隨機長字串，例如用 openssl rand -hex 32 產生）
ADMIN_KEY=（你自訂的後台密鑰）
FRONTEND_URL=https://your-frontend.netlify.app
NODE_ENV=production
```

### 步驟 4：初始化資料庫
Railway 部署完成後，在本機執行：
```bash
DATABASE_URL="你的連線字串" node db/init.js
```

---

## 📋 使用流程

### 1. 匯入蝦皮訂單
從蝦皮賣家後台匯出訂單 CSV，格式需包含：
```
訂單編號,商品名稱,商品ID
250429ABCDEF,Nintendo eShop 點數 300 元,ESHOP_300
```

上傳指令（curl）：
```bash
curl -X POST https://your-backend.railway.app/admin/import/orders \
  -H "x-admin-key: 你的ADMIN_KEY" \
  -F "file=@orders.csv"
```

### 2. 上傳序號
準備序號 CSV：
```
product_id,code
ESHOP_300,ESHOP-3N7K-W2PQ-9MXZ
ESHOP_300,ESHOP-AB1C-DE2F-GH3I
```

上傳指令：
```bash
curl -X POST https://your-backend.railway.app/admin/import/codes \
  -H "x-admin-key: 你的ADMIN_KEY" \
  -F "file=@codes.csv"
```

### 3. 查看庫存狀況
```bash
curl https://your-backend.railway.app/admin/stats \
  -H "x-admin-key: 你的ADMIN_KEY"
```

---

## 🔌 API 說明

### POST /api/verify — 查詢訂單
```json
請求：{ "order_id": "250429ABCDEF" }

成功回應：
{
  "success": true,
  "redeemed": false,
  "order_id": "250429ABCDEF",
  "product_name": "Nintendo eShop 點數 300 元",
  "token": "eyJ..."   ← 5 分鐘內有效，兌換時需帶此 token
}
```

### POST /api/redeem — 執行兌換
```json
請求：{ "token": "eyJ..." }

成功回應：
{
  "success": true,
  "order_id": "250429ABCDEF",
  "product_name": "Nintendo eShop 點數 300 元",
  "code": "ESHOP-3N7K-W2PQ-9MXZ",
  "redeemed_at": "2025-04-29T12:34:56.000Z"
}
```

---

## 🔒 安全機制

| 機制 | 說明 |
|------|------|
| JWT Token | verify 成功才能兌換，5 分鐘有效 |
| DB Transaction | 防止同一訂單被重複兌換 |
| SKIP LOCKED | 防止同時兌換導致序號衝突 |
| Rate Limiting | 每小時每 IP 最多 10 次兌換請求 |
| Helmet | 設置安全 HTTP headers |
| CORS | 只允許指定前端網域呼叫 |

---

## 🛠 本機開發

```bash
# 安裝依賴
npm install

# 複製環境變數
cp .env.example .env
# 編輯 .env 填入本機 PostgreSQL 連線資訊

# 初始化資料庫
npm run db:init

# 啟動開發伺服器
npm run dev
```
