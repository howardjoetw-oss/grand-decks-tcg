# GRAND DECKS｜v3–v9 一次整合測試版

非官方 ONE PIECE CARD GAME 競技資料與組牌 PWA（繁體中文優先）。不屬於 OPTC 專案。採 **Cloudflare Pages Free + GitHub 公開儲存庫 Actions** 的靜態網站架構。沒有啟用付費 X API、付費伺服器、Cloudflare D1 或付費網域。使用前請注意資料使用條款。

> **重要狀態**：這是**整合測試版，不是已上線的即時資料庫**。本次在離線執行環境完成了 Python 單元測試及瀏覽器介面測試；第三方網站實際抓取、GitHub 定期執行、Cloudflare PWA 安裝均需在你自己的免費帳號首次操作後確認。現在 `public/data/cards.json` 仍是待同步快照，網站顯示的 96 張示範卡牌不是真實卡庫。

## 功能實作與界線

| 原藍圖 | 本整合包實作內容 | 未完成／實務限制 |
|---|---|---|
| v3 卡牌索引 | 卡號去除異圖重複、失敗保留快照、官方/來源對照、TOP DECKS 系列監看 | 首次遠端卡表同步尚未驗證；沒有大量鏡像卡圖、效果全文 |
| v4 全球優勝牌組 | Limitless API 取得程式、TOP DECKS OP17 解析嘗試、來源區分、重複結果去除、50 張完整性檢查 | TOP DECKS 僅有 OP17 兩頁範例；更多各國來源需增加轉接器，且尊重 robots 與條款 |
| v5 Meta | 7/30/90 天/全部、地區統計、領航員前八佔比、冠軍次數、樣本量提示 | 不等於全球勝率；來源若未提供賽制/禁限卡環境，不會假裝可比較 |
| v6 社群 | 使用者本機新增 X/Reddit/YouTube 候選、來源去重、公開 RSS/Atom 自動發現*架構* | 預設沒有任何已核准社群 RSS 來源；X 付費 API 未啟用；候選不是驗證戰績 |
| v7 智慧組牌 | 50 張、單張上限、領航員顏色、搜尋、從賽事帶入、兩套牌組張數差異、規則檔接口 | 當期禁限卡規則清單為空，**不能保證符合正式比賽規則** |
| v8 PWA 操作 | Android 響應式、卡牌搜尋、收藏、個人牌組、備份與還原、來源狀態、離線快取 | PWA 安裝需 Cloudflare HTTPS 驗收；個人資料本機存放，跨裝置不自動同步 |
| v9 維運 | 資料驗證與摘要、GitHub 每日 Cron、自動提交、來源錯誤標示、單元測試、操作 SOP | GitHub/Cloudflare 真實端到端測試仍須完成 |

**七個模組已整合於同一個網站資料夾；以上未完成項目不是已實現的功能。**

## 網站重要目錄

```text
.github/workflows/sync-results.yml   # 每日台灣 02:23 排程、整合測試、提交更新
config/community_feeds.json           # 預設空；可加入獲准公開讀取的 RSS/Atom
public/index.html                     # Cloudflare Pages 網站首頁
public/app.js                         # 卡牌與組牌前端
public/results.js                     # 全球賽事、Meta、牌組比較、社群候選
public/sw.js                          # 離線快取
public/data/cards.json                # 需首次 GitHub Actions 同步
public/data/decks.json                # 附 7 套來源快照（非即時結果）
public/data/meta.json                 # 可驗證前八樣本的彙整
public/data/integrity.json            # 資料健全性統計
public/data/rules.json                # 禁限卡規則接口（目前空）
public/data/community.json            # 已審核來源的 RSS 摘要（目前空）
scripts/run_sync.py                   # 隔離執行同步程式並記錄各來源狀態
scripts/build_reports.py              # 去重、驗證、產生 Meta 統計
scripts/test_*.py                     # 離線測試
```

## Android 手機部署 SOP（不需要電腦）

**Step 1：解壓縮**

1. 在手機下載本 ZIP，用 Android 檔案管理工具解壓。
2. 請開啟「顯示隱藏檔案」，確認 `.github` 資料夾可見。
3. 不要把整份 ZIP 當成 Cloudflare 部署目錄，GitHub 必須保留資料夾結構。

**Step 2：建 GitHub Repo**

1. 在 `https://github.com/new` 建立免費的 **Public** 儲存庫，例如 `grand-decks-tcg`。
2. 上傳**解壓後資料夾裡面的內容**到 Repo 根目錄，讓 GitHub 主頁能直接看到 `public/`、`scripts/`、`config/`、`.github/` 與 `README.md`。
3. 如果 Android 的網頁上傳無法保留資料夾，請用 GitHub `Add file → Create new file`，在檔名輸入如 `public/index.html` 或 `.github/workflows/sync-results.yml`，將對應檔案內容逐一貼上提交；二進位 PNG 圖示則使用 `Upload files`。
4. **不要**將 ZIP 的最外層資料夾又建成 Repo 第一層，否則 Cloudflare 找不到 `public`。

**Step 3：Cloudflare Pages (Free) 連接 GitHub**

1. 登入 `https://dash.cloudflare.com` → `Workers & Pages` → `Create` → `Pages` → `Connect to Git`（控制台文字可能略有不同）。
2. 授權剛建立的 GitHub 儲存庫。
3. 選 `Framework: None`、`Production branch: main`、`Build command: exit 0`、`Build output directory: public`、`Root directory: 空白`。
4. 不需要任何 Environment Variable、API Key、信用卡付費方案或付費網域。按 Deploy 後取得 `https://你的專案.pages.dev`。
5. 網站正式網址確認後用 Chrome 開啟。PWA 可使用 Chrome 選單「安裝應用程式 / 加到主畫面」。

**Step 4：GitHub Actions 第一次同步**

1. 回 GitHub Repo → `Actions` → `GRAND DECKS - tournament and card metadata sync`。
2. 點 `Run workflow`，Branch 選 `main`，再按一次執行。
3. 檢查 `Test all source parsers`、`Source collection`、`Validate generated JSON`、`Commit only if ...`。成功提交 `public/data/` 後，Cloudflare Git 整合會部署資料更新。
4. 回網站 → 「資料管理」讀取來源同步狀態；確認 `卡牌索引` 有數量與成功檢查時間。再到「卡牌圖鑑」測試新卡號。
5. TOP DECKS 若 robots 被禁止或來源格式有變，程式會標示失敗/略過，不會規避封鎖或自動刪掉既有卡表。
6. GitHub 排程寫為 UTC `23 18 * * *`，即台灣每日 **02:23**，排程可能延遲；長期不活動時也可能停用。可以手動再次執行。

**Step 5：手機驗收**

- 首頁和卡牌圖鑑可切換，搜索卡號和名稱。
- 全球賽事可按地區、時間、名次查找，並能開啟原始來源。
- 任選兩套有 50 張清單的比賽牌組 → `加入比較` → 查看差異。
- 按 `帶入組牌`、更改卡片、儲存 → 「我的牌組」核對。
- 進入「資料管理」→ 「匯出所有牌組」→ 儲存 JSON 作安全備份。
- Chrome 安裝主畫面後，再測試離線讀取已存資料，並辨識沒有快取的資料會明確提示離線。

## 如果同步錯誤

- **卡表還是 DEMO**：代表 `cards.json` 尚未成功產生真實卡號索引；先查看 GitHub Action 日誌中 `繁中卡牌索引` 的錯誤。
- **來源跳過**：代表 robots、來源連線或公開資料不足，不等於程式抓到零件就假稱成功。完整性以 `public/data/sync-status.json` 為準。
- **Cloudflare 404**：檢查 `public/index.html` 是否在正確層級、Output Directory 是否為 `public`。
- **Git push 403**：檢查 Repo → Settings → Actions → General 的 workflow 權限，以及 `main` 是否受 branch protection 限制。
- **圖片沒有出現**：本版本沒有批次重製受著作權保護的卡圖；牌組卡號、名稱、基本元資料仍可使用。
- **手機私人資料**：個人組牌、收藏、候選存於瀏覽器，清除站點資料前務必備份；更換手機不會自動跟著走。

## 本機測試方式

```bash
python -m unittest discover -s scripts -p 'test_*.py'
python scripts/run_sync.py --offline
node --check public/app.js
node --check public/results.js
node --check public/sw.js
```

首次外部同步只在你的 GitHub Actions 執行；程式無須常駐手機。本整合包的 `public/data` 已含 7 筆附來源的示例資料，僅作界面驗收，不宣稱是全球最新熱門趨勢。

## 來源、合規與費用

- 公開賽事 API：[Limitless](https://docs.limitlesstcg.com/developer)（免費無金鑰端點仍有速率限制）
- 賽事上位情報參考：[ONE PIECE TOP DECKS](https://onepiecetopdecks.com/)（網站存取與素材再利用必須遵守權利與 robots 限制）
- 繁中卡號元資料來源：[Punk Records](https://github.com/buhbbl/punk-records)（同步程式使用基本識別欄位，不複製完整圖像/效果全文）
- 官方卡表核對：[繁中 ONE PIECE CARD GAME](https://asia-tc.onepiece-cardgame.com/cardlist/)
- **社群來源**：只使用經允許公開讀取的 RSS/Atom 或人工連結，不收集私人社群內容，也不使用付費 X API。`config/community_feeds.json` 預設空值。

任何未來需要付費的 API、Workers、網域、資料庫功能，都必須先取得使用者明確確認。**本 ZIP 不會自行產生費用，也不會替使用者部署。**
