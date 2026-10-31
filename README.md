# GRAND DECKS — Cloudflare Pages + GitHub Actions 版本（v2）

**純靜態 PWA + 公開比賽資料同步**。不使用 Cloudflare D1、Workers、付費 X API。

## 目錄結構

- `public/`：Cloudflare Pages 唯一發布的靜態網站，輸出目錄必須設定為 `public`。
- `public/data/decks.json`：顯示在網頁上的賽事牌組資料，內建歷史來源快照。
- `scripts/`：在 GitHub Actions 執行資料匯入與測試，不會被發布到 Pages。
- `.github/workflows/sync-results.yml`：台灣時間 02:23 每日排程（UTC 18:23），可在 GitHub Actions 手動執行。

## Cloudflare Pages 設定

- 產品：**Workers & Pages → Pages → Connect to Git**（不是新建 Worker，也不是 Direct Upload）。
- GitHub 儲存庫：自己的 GRAND DECKS 專用 repo。
- 專案名稱：任選未占用名稱，例如 `grand-decks-tcg`。
- 正式分支：`main`。
- Framework preset：`None`（未使用框架）。
- Root directory：留空，使用 GitHub repo 根目錄。
- Build command：`exit 0`（純靜態網站，不需編譯）。
- Build output directory：`public`（**不是根目錄 `.`，也不是 `dist`**）。
- Environment variables：**留空**。
- 方案：Cloudflare Free，不開付費 Workers／D1／自訂網域。

## 手機上傳 GitHub 時特別注意

1. **ZIP 不能直接當成網站 GitHub 內容**。先解壓，依目錄分別上傳檔案。
2. GitHub repo 的根目錄要看到 `public`、`scripts`、`.github`；**不可多包一層 `GRAND_DECKS_Cloudflare_GitHub_v2/`**。
3. 要完整上傳隱藏 `.github` 目錄；Android 檔案管理器可以開啟「顯示隱藏檔案」。
4. 如果手機無法選擇資料夾，先透過 GitHub Web 的 `Add file → Create new file` 建立 `public/.keep`、`public/icons/.keep`、`public/data/.keep`、`scripts/.keep` 等暫存檔，進入該資料夾後用 `Add file → Upload files` 上傳該層檔案；`.github/workflows/sync-results.yml` 也可在 `Create new file` 用完整路徑建立再貼入內容。

## GitHub Actions

1. GitHub repo → `Actions` → `Sync ONE PIECE tournament results (free API)` → `Run workflow` → 選 `main`。
2. 如果 `Run workflow` 沒有出現，確認 `.github/workflows/sync-results.yml` 位於 `main`、Actions 已啟用。
3. 工作流程有 `permissions: contents: write`；若遇到 Git push 403，查看 repo Settings → Actions → General → Workflow permissions 與分支保護。
4. 若成功更新 `public/data/decks.json`，提交到 `main`，Cloudflare Git 整合預期自動部署；實際操作必須確認 GitHub run 與 Cloudflare Deployments。
5. 如果外部 API/網站拒絕存取，應保留舊資料；不可把沒有取得的資料視為已驗證。

## 驗證路徑

- 首頁：`https://<your-project>.pages.dev/`
- 資料：`https://<your-project>.pages.dev/data/decks.json`
- PWA manifest：`https://<your-project>.pages.dev/manifest.webmanifest`

## 注意與尚未實作

- 網站內的卡牌搜尋初始使用示範卡資料；須手動同步可用卡牌資料集。
- 目前只實作 Limitless 公開 API 與 TOP DECKS 兩個 OP17 集合頁的自動抓取嘗試；不保證 TOP DECKS 授權、robots、版型永久可用。
- 比賽個人勝敗記錄不等於一套牌的全球 Meta 勝率；資料頁面會標註可信度。
- 尚未實作付費 X API、社群自動搜尋、D1、使用者登入與跨裝置同步。
- GitHub public repo 的 Actions 使用標準 hosted runner 免費，Cloudflare Free 有每月 500 次 Pages build 額度；任何超額／升級費用都需由使用者自行審核，不應自動升級。
