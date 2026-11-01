/* GRAND DECKS version history. Update this file whenever shipping a new UI release. */
(() => {
  'use strict';
  const RELEASES = [
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
