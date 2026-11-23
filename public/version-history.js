/* GRAND DECKS version history. Update this file whenever shipping a new UI release. */
(() => {
  'use strict';
  const RELEASES = [
    {version:'13.8', date:'2026-11-23', status:'跨區卡圖修正', title:'全部系列實際卡面與就地預覽', changes:[
      '同一印刷版本合併繁中、英文、日文與其他有圖片來源，不再只依賴繁中網址',
      '一般、平行異圖及復刻依版本 ID 去重；同版本圖片失效時依序嘗試備援',
      '點選卡庫中的特定版本，詳情中直接預覽該版本；不修改組牌及賽事資料'
    ]},
    {version:'13.7', date:'2026-11-23', status:'卡圖載入修正', title:'修復篩選有結果卻沒有卡圖', changes:[
      '平行異圖及復刻卡面失敗時依序檢查同一印刷版的其他官方來源；不拿一般版冒充異圖',
      '無法載圖時顯示真正成功載入數量及明確提示，不再只留下空白區域',
      '保留 v13.6 四種卡庫篩選和卡牌詳情就地預覽，不修改組牌與賽事資料'
    ]},
    {version:'13.6', date:'2026-11-23', status:'顯示回復與操作優化', title:'回復 v13.4 卡面分類、點選版本就地預覽', changes:[
      '移除 v13.5 全語言分頁，回復 v13.4 主卡庫及三種逐張卡面篩選',
      '卡牌詳情點選不同卡面縮圖，直接替換上方主預覽圖，不另開視窗',
      '未成功載入的卡圖不顯示空白格，保留原組牌、賽事及本機牌組資料'
    ]},
    {version:'13.4', date:'2026-11-23', status:'圖鑑呈現改版', title:'全部卡牌與三種卡面清單', changes:[
      '全部卡牌：同卡號只顯示一次，優先使用繁中一般版卡面',
      '一般版、平行／異圖、復刻版：每張符合的繁中卡面獨立列出，相同卡號可重複',
      '版本下拉選單縮減為四項，保留既有組牌、賽事及個人牌組'
    ]},
    {version:'13.3', date:'2026-11-23', status:'卡面來源修正', title:'恢復台灣繁體中文版卡面', changes:[
      '卡面與印刷版本改回 zh-TW 台灣繁體中文版來源，不再僅篩選日本版',
      '保留同卡號的普通版、平行異圖與正確稀有度，無圖卡片不佔版面',
      '修正印刷版本篩選標籤、網站快取版本，保留 v13.2 組牌及賽事資料'
    ]},
    {version:'13.2', date:'2026-11-23', status:'修正', title:'日版卡圖載入修正', changes:[
      '日文版卡圖要求不傳送 Referer，載入失敗時再嘗試一次官方圖片網址',
      '清楚區分已收錄日版版本數量與成功顯示的卡圖數量',
      '無圖片版本不佔格子，但不再把載入失敗誤認成資料庫缺卡'
    ]},
    {version:'13.1', date:'2026-11-23', status:'正式改版', title:'日版卡圖與精準篩選', changes:[
      '卡面與印刷版本僅顯示有可用圖片網址的日文版，失效卡圖移除整張版本卡片',
      '展示來源稀有度 L、SR、SEC 等，新增卡牌稀有度及日版印刷版本篩選',
      '修正卡名 HTML 實體顯示，延續 v13 所有組牌與賽事功能'
    ]},
    {version:'13.0', date:'2026-11-22', status:'卡庫擴充', title:'全系列與不同卡面版本', changes:[
      '以多語官方資料補充繁中未收錄的卡牌與新系列',
      '將同卡號的平行、異圖、復刻與區域版本個別列出',
      '保留舊牌組的組牌規則與資料，後續每天自動同步新版本'
    ]},
    {version:'12.0', date:'2026-11-01', status:'正式更新', title:'版本紀錄與卡牌效果查詢', changes:[
      '首頁左上角新增固定版本號，點選可閱讀歷次更新紀錄',
      '點開卡牌時，依繁中系列完整資料按需載入卡牌效果與觸發效果',
      '保留卡圖、已儲存牌組與原有卡表，不將卡面文字大量鏡像到 GitHub'
    ]},
    {version:'11.0', date:'2026-11-01', status:'正式更新', title:'全站點卡看詳細資料', changes:[
      '圖鑑、組牌、賽事牌組、Meta 與比較畫面共用卡牌詳情視窗',
      '點卡圖只看詳情，不會誤改牌組；選牌與加減張數仍使用獨立按鈕'
    ]},
    {version:'10.0', date:'2026-11-01', status:'正式更新', title:'全站卡圖與中文系列選單', changes:[
      '卡牌圖鑑、組牌工作室與賽事完整牌組改用圖片輔助辨識',
      '卡圖失效時加入備援處理；系列選單顯示 OP、ST、EB 等代碼與中文名稱'
    ]},
    {version:'9.0', date:'2026-10-31', status:'整合發布', title:'競技資料整合版', changes:[
      '整合全球賽事資料、來源追蹤、Meta、牌組比較與手機 PWA',
      '加入資料同步狀態、來源驗證、每日 GitHub Actions 同步及 Cloudflare 發布'
    ]},
    {version:'8', date:'2026-10-31', status:'整合開發階段', title:'手機 PWA 與操作體驗', changes:['手機操作、快速查卡、離線快取與牌組備份的開發模組；未獨立正式發布']},
    {version:'7', date:'2026-10-31', status:'整合開發階段', title:'組牌與差異比較', changes:['領航員選擇、50 張驗證、牌組複製及差異比較模組；未獨立正式發布']},
    {version:'6', date:'2026-10-31', status:'整合開發階段', title:'社群來源與候選牌組', changes:['社群來源追蹤與待核實候選清單模組；未獨立正式發布']},
    {version:'5', date:'2026-10-31', status:'整合開發階段', title:'Meta 賽事統計', changes:['地區、時間窗、領航員前八與冠軍統計模組；未獨立正式發布']},
    {version:'4', date:'2026-10-31', status:'整合開發階段', title:'全球賽事來源整合', changes:['Limitless Play、TOP DECKS 等來源解析與去重模組；未獨立正式發布']},
    {version:'3', date:'2026-10-31', status:'開發基礎', title:'卡表與賽事同步基礎', changes:['建立繁中卡號索引、同步狀態與資料來源追蹤基礎']},
    {version:'2', date:'2026-10-31', status:'早期版本', title:'GitHub 與 Cloudflare 串接', changes:['建立雲端部署與卡牌資料同步的基礎流程']},
    {version:'1', date:'2026-10-31 之前', status:'初始版本', title:'GRAND DECKS PWA 雛形', changes:['卡牌查詢、基本組牌與私人牌組儲存的初始介面']}
  ];
  window.GRAND_DECKS_RELEASES = RELEASES;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function init() {
    const trigger = document.getElementById('versionHistoryBtn');
    const dialog = document.getElementById('versionDialog');
    const body = document.getElementById('versionList');
    const close = document.getElementById('closeVersionDialog');
    if (!trigger || !dialog || !body || !close) return;
    trigger.setAttribute('aria-label', `目前 v${RELEASES[0].version}，查看版本更新紀錄`);
    body.innerHTML = RELEASES.map((v,i) =>
      `<article class="releaseEntry"><div class="releaseRow"><strong>v${escape(v.version)}${i===0?' · 目前版本':''}</strong><small>${escape(v.date)} · ${escape(v.status)}</small></div><h3>${escape(v.title)}</h3><ul>${v.changes.map(item=>`<li>${escape(item)}</li>`).join('')}</ul></article>`
    ).join('');
    trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
