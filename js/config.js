// ⚠️ 部署 Apps Script 之後，將 Web App 網址貼喺度
window.CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwxLFIE47v1Pi14qrX-tovsnWQTVddolGAhUinI6nUoS1Fv0aLFM5zPx1LjckRbVFVFQA/exec',

  // 人臉比對門檻：越細越嚴格（0.40 嚴 ~ 0.55 鬆），建議 0.45
  MATCH_THRESHOLD: 0.45,
  // 連續幾多格畫面認到同一個人先確認（防誤認）
  CONFIRM_FRAMES: 3,
  // 同一個人打完卡之後幾多秒內唔再彈出
  COOLDOWN_SEC: 30,
  // 打卡時影一張細相存 Google Drive 做證據
  SAVE_PHOTO: true,
  // 遲到寬限（分鐘）預設值，報告頁可以改
  GRACE_MIN: 5,
};
