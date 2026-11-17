# 🎁 交換禮物網站

GitHub Pages（前端）＋ Google Sheet（資料儲存，透過 Apps Script 當 API）。

| 頁面 | 用途 |
|---|---|
| `index.html` | 填寫頁（QR code 指向這裡）：姓名＋三個禮物特徵，勾選哪一個是假的 |
| `display.html` | 大螢幕：全部顯示 / 輪播，右下角有 QR code，管理者按「公佈」時跳出揭曉動畫 |
| `admin.html` | 管理後台（需密碼）：看所有答案、公佈、刪除、全部重置 |

---

## 架設步驟

### 1. 建立 Google Sheet 與 Apps Script
1. 到 Google 雲端硬碟新增一個 Google 試算表（名稱隨意，例如「交換禮物」）。
2. 上方選單「擴充功能 → Apps Script」。
3. 把 `apps-script/Code.gs` 的內容整份貼上，取代原本的程式碼，存檔。
4. 左側「⚙ 專案設定」→ 最下方「指令碼屬性」→ 新增屬性：
   - 屬性：`ADMIN_PASSWORD`
   - 值：你的後台密碼
5. 回到編輯器，上方函式選單選 `setup` → 按「執行」，依提示授權（會出現「Google 尚未驗證這個應用程式」→ 進階 → 前往（不安全）→ 允許，這是你自己的程式所以沒關係）。
   試算表中會出現 `Gifts` 與 `State` 兩個分頁。

### 2. 部署成網頁應用程式
1. 右上角「部署 → 新增部署作業」→ 齒輪選「網頁應用程式」。
2. 執行身分：**我**；存取權：**所有人**。
3. 按「部署」，複製「網頁應用程式網址」（`https://script.google.com/macros/s/.../exec`）。

> ⚠ 之後如果修改了 Code.gs，要用「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本：新版本」重新部署，網址才會維持不變。

### 3. 設定前端
打開 `assets/config.js`，把 `API_URL` 換成上一步的網址。

### 4. 發佈到 GitHub Pages
1. 在 GitHub 建一個 repository，把這個資料夾的檔案推上去。
2. Repository → Settings → Pages → Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)` → Save。
3. 約一分鐘後網址會是 `https://<你的帳號>.github.io/<repo 名稱>/`。

---

## 當天使用方式

1. 投影電腦開 `https://…/display.html`，按「全螢幕」。
   - 右下角就是填寫頁的 QR code，點一下可以放大，再點一下隱藏。
2. 大家掃 QR code 填寫，大螢幕每 3 秒自動更新。
3. 主持人用手機開 `https://…/admin.html` 登入。
4. 某份禮物被選走後，在後台按該筆的「公佈」→ 大螢幕跳出動畫：假的詞被打叉，並揭曉是誰的禮物。
5. 活動結束（或測試完）按「全部重置」清空資料。

### 大螢幕快捷鍵
| 鍵 | 功能 |
|---|---|
| `A` | 全部顯示 |
| `C` | 輪播（← → 手動切換） |
| `Q` | QR code：小 → 大 → 隱藏 |
| `F` | 全螢幕 |
| `H` | 隱藏工具列（滑鼠移上去會出現） |
| `Esc` / 點一下 | 關閉公佈動畫 |

---

## 本機測試
```bash
npx serve .
```
開 `http://localhost:3000/index.html`、`display.html`、`admin.html`（需先完成步驟 1～3）。

## 說明
- 送出時伺服器會把三個詞隨機打亂順序，所以假的不會固定在同一個位置。
- 公開 API 不會回傳未公佈禮物的姓名與假詞，只有後台（需密碼）看得到。
