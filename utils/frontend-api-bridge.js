// =============================================
// 前端串接後端說明
// 請將 index.html 中的 MOCK 區塊替換成以下程式碼
// =============================================

// 1. 在 <script> 頂部設定你的後端網址
const API_BASE = 'https://your-backend.railway.app'; // 換成你的後端網址

// 2. 替換 handleVerify() 函數
async function handleVerify() {
  const orderId = document.getElementById('orderInput').value.trim().toUpperCase();
  hideAlerts();
  if (!orderId) return showError('請輸入訂單編號');

  const btn = document.getElementById('verifyBtn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = '查詢中…';

  try {
    const res = await fetch(`${API_BASE}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId })
    });
    const data = await res.json();

    if (!data.success) {
      showError(data.error);
      btn.textContent = '🔍 查詢訂單';
      return;
    }

    // 儲存 token（verify 成功後 5 分鐘有效）
    window._redeemToken = data.token;
    currentOrder = { id: data.order_id, productName: data.product_name, redeemed: data.redeemed };

    document.getElementById('previewOrder').textContent = '#' + data.order_id;
    document.getElementById('previewName').textContent = data.product_name;
    document.getElementById('previewStatus').textContent = '✓ 已付款';
    document.getElementById('previewRedeem').textContent = data.redeemed ? '⚠ 已兌換' : '● 待兌換';
    document.getElementById('productPreview').classList.add('show');

    if (data.redeemed) {
      document.getElementById('alertWarningMsg').textContent = '此訂單已兌換過，如有疑問請聯繫客服。';
      document.getElementById('alertWarning').classList.add('show');
      btn.textContent = '🔍 查詢訂單';
    } else {
      btn.textContent = '🔄 重新查詢';
      document.getElementById('confirmBtn').style.display = 'block';
    }

  } catch (err) {
    showError('網路錯誤，請稍後再試。');
    btn.textContent = '🔍 查詢訂單';
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

// 3. 替換 handleConfirm() 函數
async function handleConfirm() {
  if (!currentOrder || !window._redeemToken) return;

  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = '兌換處理中…';

  try {
    const res = await fetch(`${API_BASE}/api/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: window._redeemToken })
    });
    const data = await res.json();

    if (!data.success) {
      showError(data.error);
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = '✅ 確認兌換';
      return;
    }

    // 兌換成功，顯示序號
    document.getElementById('rewardValue').textContent = data.code;
    document.getElementById('resultProductName').textContent = data.product_name;
    document.getElementById('resultTime').textContent = new Date(data.redeemed_at).toLocaleString('zh-TW');
    document.getElementById('resultOrder').textContent = '#' + data.order_id;
    document.getElementById('resultSubtitle').textContent = `您的「${data.product_name}」已成功兌換`;

    document.getElementById('step1').classList.add('done');
    document.getElementById('step2').classList.add('active');
    document.getElementById('formView').style.display = 'none';
    document.getElementById('resultView').classList.add('show');
    window._redeemToken = null;

  } catch (err) {
    showError('網路錯誤，請稍後再試。');
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.textContent = '✅ 確認兌換';
  }
}
