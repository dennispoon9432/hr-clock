# 人臉打卡系統（GitHub Pages + Google Sheet）

平板用鏡頭認樣打卡，資料存 Google Sheet，多分店，管理員匯入更表自動計遲到 / 早退 / 缺勤。**全部免費，唔使 server。**

```
平板 (GitHub Pages)  ──►  Google Apps Script (API)  ──►  Google Sheet + Drive (打卡相)
  人臉識別喺平板本地做         檢查 PIN / 密碼            Shops / Staff / Punches / Roster / Shifts
```

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 打卡機（擺喺分店嘅平板） |
| `admin.html` | 管理後台：員工、登記樣貌、分店、匯入更表、遲到報告 |
| `apps-script/Code.gs` | 後端，貼入 Google Apps Script |
| `js/config.js` | **要填 API 網址** |
| `sample-roster.csv` | 更表範例 |

---

## 設定步驟（大約 15 分鐘）

### 1. 開 Google Sheet + 後端
1. 去 Google Drive 開一個新 Google Sheet，改名例如「HR 打卡」
2. 選單 **擴充功能 → Apps Script**
3. 刪走原本內容，貼入 `apps-script/Code.gs` 全部內容，儲存
4. 上面揀函數 `setup` → 撳 **執行** → 批准權限（會問 Sheet 同 Drive 權限）
5. 完成後 Sheet 會多咗 5 個分頁，Drive 會多咗「HR打卡相片」資料夾
6. **改管理員密碼**：左邊 ⚙️ 專案設定 → 指令碼屬性 → `ADMIN_PASSWORD`（預設 `admin1234`）

### 2. 部署 API
1. Apps Script 右上 **部署 → 新增部署作業** → 類型揀「網頁應用程式」
2. 執行身分：**我**；存取權：**所有人**
3. 部署，複製個網址（`https://script.google.com/macros/s/.../exec`）
4. 貼入 `js/config.js` 嘅 `API_URL`

> 之後改咗 Code.gs，要「部署 → 管理部署作業 → 編輯 → 新版本」先生效，網址唔變。

### 3. 放上 GitHub Pages
1. GitHub 開新 repo（例如 `hr-clock`），上載成個資料夾（唔包 `apps-script` 都得）
2. repo **Settings → Pages** → Branch 揀 `main` / root → Save
3. 等一分鐘，網址會係 `https://你個帳號.github.io/hr-clock/`
   - 打卡機：`.../hr-clock/`
   - 管理：`.../hr-clock/admin.html`

### 4. 開始用
1. 開 `admin.html` 登入 → **分店** 加分店（每間有自己 PIN）
2. **員工** → 新增員工 → 撳「登記樣貌」影 5 下
   - 建議喺分店平板度做，同一部鏡頭、同一個燈光，認得最準
3. 分店平板開打卡網址 → 揀分店 + 入 PIN（只做一次）
4. 平板 Chrome/Safari 揀「加到主畫面」，開全螢幕；設定入面關閉自動鎖屏

---

## 每日流程
- 員工行到平板前面 → 自動認到 → 撳 **上班** / **下班**（系統會用黃框提示應該撳邊個）
- 打卡會影一張細相存 Drive，方便查有冇人用相片呃卡
- 斷網都照打得，平板會暫存，有網自動補上傳

## 匯入更表
最簡單：**喺 Excel 揀晒成個更表 → Ctrl+C → 貼入「匯入更表」→ 預覽 → 確認**。亦可以直接揀 .xlsx / .csv 檔。

```
員工     1/11   2/11   3/11
陳大文   A      OFF    09:30-18:30
李小明   B      9-18   休
```
- 第一行日期：`1/11`、`2026-11-01`、`11月1日` 都得（日/月）
- 格入面：更份代號 `A`、`09:00-18:00`、`9-18`、`0930-1830`、`OFF`/`休`/`AL`
- 通宵更 `22:00-07:00` 都識計
- 同日同人再匯入會覆蓋舊更

## 遲到報告
揀日期範圍 + 分店 → 產生報告：
- **員工總結**：遲到次數、遲到總分鐘、早退、缺勤、漏打卡、總工時
- **每更明細**：可以只睇有問題嘅
- **冇編更但有打卡**：方便發現 OT / 頂更
- 一鍵匯出 CSV（Excel 開到中文）

計法：更開始前 4 小時至更完之間最早嘅「上班」卡 = 上班時間；遲過 開始 + 寬限分鐘 = 遲到。

---

## 注意
- **私隱**：Sheet 只存臉部特徵數字（128 個數），唔存相；但打卡相會存 Drive。按《個人資料（私隱）條例》，登記前要員工書面同意，講清楚用途同保存期。唔想存相：`config.js` 設 `SAVE_PHOTO: false`
- **準確度**：認錯人 → 將 `MATCH_THRESHOLD` 調細（0.40）；成日認唔到 → 調大（0.5）或者重新登記樣貌
- **防呃**：用相片可能呃到人臉識別，打卡相就係用嚟事後抽查
- **保安**：分店 PIN 同管理員密碼係基本保護，唔好將 Sheet 公開分享
- Google Sheet 夠用幾年（每年大約幾萬行）；太大可以每年開新 Sheet
