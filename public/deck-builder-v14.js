/* GRAND DECKS v14.0 — Official Deck Builder upgrade
 * Baseline: GRAND DECKS v13.9 (53b68c4c02a604e8d74a6267cc2b53a0cb939ef6)
 * Native frontend enhancement, same existing IndexedDB and card catalogue.
 * Loads after existing app.js and results.js. No paid API or new account requirement.
 * Note: league ban / rotation datasets still require verified official data.
 */
/* GRAND DECKS Deck Lab v14.0. Pure, zero-dependency helpers; no network or account. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GrandDeckLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ID = /^[A-Z0-9]{1,10}-\d{2,4}$/;
  const MAX_MAIN = 50;
  const MAX_PER_ID = 4;
  const TYPES = ['Leader', 'Character', 'Event', 'Stage', 'Don'];
  const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'];
  const COST_KEYS = [...Array.from({ length: 10 }, (_, n) => String(n)), '10+', '未知'];
  const COUNTER_KEYS = ['+1000', '+2000', '無 Counter', '未標示', '其他'];
  const trimId = value => String(value || '').trim().toUpperCase();
  const emptyCounts = keys => Object.fromEntries(keys.map(key => [key, 0]));
  const size = items => Object.values(items || {}).reduce((sum, n) => sum + n, 0);

  function normalizeDeck(source, options = {}) {
    const obj = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    const errors = [];
    const leaderId = trimId(obj.leaderId);
    if (!ID.test(leaderId)) errors.push('缺少或無效的 Leader 卡號');
    const raw = obj.items && typeof obj.items === 'object' && !Array.isArray(obj.items) ? obj.items : null;
    if (!raw) errors.push('未提供牌組卡片清單');
    const items = Object.create(null);
    for (const [key, rawCount] of Object.entries(raw || {})) {
      const id = trimId(key), n = Number(rawCount);
      if (!ID.test(id) || !Number.isInteger(n) || n < 1 || n > MAX_PER_ID) {
        errors.push(`${String(key).slice(0, 32)}：卡號或張數無效（單卡最多 4 張）`);
      } else if (Object.prototype.hasOwnProperty.call(items, id)) {
        errors.push(`${id}：卡號重複`);
      } else items[id] = n;
    }
    const total = size(items);
    if (total > MAX_MAIN) errors.push(`主牌超過 ${MAX_MAIN} 張`);
    if (options.requireFull && total !== MAX_MAIN) errors.push(`主牌必須剛好 ${MAX_MAIN} 張，目前 ${total} 張`);
    const artworks = Object.create(null);
    if (obj.artworks && typeof obj.artworks === 'object' && !Array.isArray(obj.artworks)) {
      for (const [key, printId] of Object.entries(obj.artworks)) {
        const id = trimId(key), version = String(printId || '').trim();
        if ((Object.prototype.hasOwnProperty.call(items, id) || id === leaderId) && version.length >= 1 && version.length <= 80 && /^[a-z0-9_-]+$/i.test(version)) {
          artworks[id] = version;
        }
      }
    }
    const format = obj.format === 'extended' ? 'extended' : 'standard';
    return { ok: errors.length === 0, errors, deck: {
      format, name: String(obj.name || '').slice(0, 60), leaderId, items: { ...items }, artworks: { ...artworks }
    }, count: total };
  }

  function parseText(text) {
    const input = String(text || '');
    if (input.length > 25000) return { ok: false, errors: ['匯入文字過長'], deck: null, count: 0 };
    const lines = input.split(/\r?\n/), items = Object.create(null), errors = [];
    let leaderId = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      const leader = line.match(/^(?:LEADER|領航員|領袖)\s*[:：]\s*([a-z0-9]{1,10}-\d{2,4})(?:\s|$)/i);
      if (leader) { leaderId = trimId(leader[1]); continue; }
      const leaderOther = /^(?:LEADER|領航員|領袖)\s*[:：]/i.test(line);
      if (leaderOther) { errors.push(`第 ${i + 1} 行：Leader 卡號格式無效`); continue; }
      const m = line.match(/^(\d{1,2})\s*[xX×＊*]\s*([a-z0-9]{1,10}-\d{2,4})(?:\s|$)/i)
        || line.match(/^([a-z0-9]{1,10}-\d{2,4})\s*[xX×＊*]\s*(\d{1,2})(?:\s|$)/i);
      if (!m) { errors.push(`第 ${i + 1} 行：無法辨識「${line.slice(0, 48)}」`); continue; }
      const firstIsCount = /^\d+$/.test(m[1]);
      const id = trimId(firstIsCount ? m[2] : m[1]);
      const count = Number(firstIsCount ? m[1] : m[2]);
      if (count < 1 || count > MAX_PER_ID) { errors.push(`第 ${i + 1} 行：${id} 只能有 1–4 張`); continue; }
      items[id] = (items[id] || 0) + count;
      if (items[id] > MAX_PER_ID) errors.push(`第 ${i + 1} 行：${id} 累計超過 4 張`);
    }
    const checked = normalizeDeck({ leaderId, items, name: '匯入牌組' });
    return { ...checked, ok: checked.ok && !errors.length, errors: [...errors, ...checked.errors] };
  }

  function summarize(deck, lookup) {
    const data = deck && deck.items ? deck.items : {};
    const types = emptyCounts(TYPES.concat('未知'));
    const colors = emptyCounts(COLORS.concat('未知'));
    const costs = emptyCounts(COST_KEYS);
    const counters = emptyCounts(COUNTER_KEYS);
    let total = 0, knownCostSum = 0, knownCostCount = 0, unknownCards = 0;
    const finder = typeof lookup === 'function' ? lookup : () => null;
    for (const [id, rawQty] of Object.entries(data)) {
      const qty = Number(rawQty);
      if (!Number.isInteger(qty) || qty <= 0) continue;
      total += qty;
      const card = finder(id);
      if (!card) { unknownCards += qty; types['未知'] += qty; colors['未知'] += qty; costs['未知'] += qty; counters['未標示'] += qty; continue; }
      const type = String(card.category || '未知');
      types[Object.prototype.hasOwnProperty.call(types, type) ? type : '未知'] += qty;
      const cardColors = Array.isArray(card.colors) ? [...new Set(card.colors)] : [];
      if (!cardColors.length) colors['未知'] += qty;
      else for (const color of cardColors) colors[Object.prototype.hasOwnProperty.call(colors, color) ? color : '未知'] += qty;
      const cost = card.cost === null || card.cost === undefined || card.cost === '' ? null : Number(card.cost);
      if (cost === null || !Number.isFinite(cost) || cost < 0) costs['未知'] += qty;
      else {
        costs[cost >= 10 ? '10+' : String(Math.floor(cost))] += qty;
        knownCostSum += cost * qty;
        knownCostCount += qty;
      }
      const counter = card.counter === null || card.counter === undefined || card.counter === '' ? null : Number(card.counter);
      if (type !== 'Character') counters['無 Counter'] += qty;
      else if (counter === null || !Number.isFinite(counter)) counters['未標示'] += qty;
      else if (counter === 0) counters['無 Counter'] += qty;
      else if (counter === 1000) counters['+1000'] += qty;
      else if (counter === 2000) counters['+2000'] += qty;
      else counters['其他'] += qty;
    }
    return { total, averageCost: knownCostCount ? knownCostSum / knownCostCount : null,
      knownCostCount, unknownCards, types, colors, costs, counters };
  }

  function deckText(source) {
    const checked = normalizeDeck(source);
    if (!checked.ok) return '';
    const d = checked.deck;
    return `LEADER: ${d.leaderId}\n${Object.entries(d.items).sort((a, b) => a[0].localeCompare(b[0])).map(([id, n]) => `${n}x ${id}`).join('\n')}`;
  }

  function shareHash(source) {
    const checked = normalizeDeck(source);
    if (!checked.ok) throw Error(checked.errors.join('；'));
    return '#deck=' + encodeURIComponent(JSON.stringify({ shareFormat: 'grand-decks-share-v1', ...checked.deck }));
  }

  function parseShareHash(hash) {
    const str = String(hash || '');
    if (!str.startsWith('#deck=')) return { ok: false, errors: ['這不是 GRAND DECKS 牌組連結'] };
    if (str.length > 12000) return { ok: false, errors: ['牌組連結過長'] };
    try {
      const d = JSON.parse(decodeURIComponent(str.slice(6)));
      if (d.shareFormat !== 'grand-decks-share-v1') throw Error('不支援的牌組分享格式');
      return normalizeDeck(d);
    } catch (error) { return { ok: false, errors: [`無法讀取分享牌組：${error.message}`] }; }
  }
  return Object.freeze({ normalizeDeck, parseText, summarize, deckText, shareHash, parseShareHash,
    COST_KEYS, COUNTER_KEYS, TYPES, COLORS });
});


/* Embedded UI styles for a single GitHub file upload */
(() => {
  'use strict';
  if (document.getElementById('grand-deck-builder-v14-style')) return;
  const style = document.createElement('style');
  style.id = 'grand-deck-builder-v14-style';
  style.textContent = `/* GRAND DECKS Deck Lab v14 production: additive CSS only, does not overwrite v13.9 selectors. */
.deckLabTabs{display:flex;align-items:center;gap:8px;margin:0 0 14px;flex-wrap:wrap}
.deckLabTabs button{border:1px solid #45566e;color:#d5dfec;background:#1a2b41;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:750}
.deckLabTabs button[aria-pressed="true"]{background:#413720;color:#ffe0a2;border-color:#d6b573}
.deckLabFilters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 8px}
.deckLabFilters select{min-width:0}
.deckLabStatsPanel .panelheading{margin-bottom:10px}
.deckLabKpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:10px 0 15px}
.deckLabKpis>div{display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid #384d67;border-radius:9px;padding:12px 4px;background:#111f32}
.deckLabKpis b{font-size:22px;color:#f1ca87;font-variant-numeric:tabular-nums}
.deckLabKpis small{font-size:10px;line-height:1.4;color:#afc0d4;margin-top:3px}
.deckLabStatsPanel details{border-top:1px solid #37455a;padding:9px 0}
.deckLabStatsPanel details>summary{font-size:13px;font-weight:750;color:#e1e8f0;cursor:pointer;margin-bottom:9px}
.deckLabBar{display:grid;grid-template-columns:76px minmax(0,1fr) 30px;gap:8px;align-items:center;padding:5px 0}
.deckLabBar span{color:#d1dfed;font-size:11px}
.deckLabBar b{font-size:11px;text-align:right;color:#f1ca87;font-variant-numeric:tabular-nums}
.deckLabTrack{height:9px;background:#25344b;border-radius:12px;overflow:hidden}
.deckLabTrack i{display:block;height:100%;background:linear-gradient(90deg,#78a7df,#e3bc77);border-radius:12px}
.deckLabTools{border-top:1px solid #38465d;margin-top:14px;padding-top:14px}
.deckLabActions{display:flex;gap:8px;flex-wrap:wrap}
.deckLabImport{margin-top:11px;border:1px solid #35455e;border-radius:9px;padding:11px}
.deckLabImport summary{color:#d9e3ed;font-size:12px;font-weight:700;cursor:pointer}
.deckLabImport textarea{width:100%;box-sizing:border-box;resize:vertical;background:#0c1424;border:1px solid #35465e;border-radius:8px;color:#ecf2fa;padding:10px;margin:5px 0 10px;min-height:110px;font-size:12px;line-height:1.5}
#deckLabMessage{min-height:1.2em;color:#cbd8e7}
.deckentry .deckLabArtPick{font-size:10px;white-space:nowrap;padding:4px 6px;width:auto;height:auto;min-width:38px;border-color:#786645;color:#eccc91;background:#292c38}
#deckLabArtDialog{width:min(750px,94vw);max-height:88dvh}
.deckLabArtBody{padding:15px}
.deckLabArtGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:12px}
.deckLabArtOption{display:flex;flex-direction:column;align-items:center;text-align:center;gap:5px;color:#e4ecf4;background:#14243a;border:1px solid #445775;border-radius:10px;padding:8px;min-width:0}
.deckLabArtOption img{width:100%;aspect-ratio:5/7;object-fit:contain;background:#081120;border-radius:6px}
.deckLabArtOption strong{font-size:12px;max-width:100%;overflow-wrap:anywhere}
.deckLabArtOption small{font-size:10px;color:#aebdd2}
.deckLabArtOption.selected{border:2px solid #ecc789;background:#3c3326}
.deckLabArtOption[hidden]{display:none}
.deckLabArtDefault{width:100%;aspect-ratio:5/7;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#e7cb99;background:linear-gradient(145deg,#293f5b,#0d182c);border-radius:6px}
@media(min-width:761px){.deckLabTabs{display:none}}
@media(max-width:760px){
  #page-builder[data-deck-lab-view="cards"] #deckLabDeckPanel,
  #page-builder[data-deck-lab-view="cards"] #deckLabStatsPanel,
  #page-builder[data-deck-lab-view="deck"] #deckLabLeaderPanel,
  #page-builder[data-deck-lab-view="deck"] #deckLabPoolPanel,
  #page-builder[data-deck-lab-view="deck"] #deckLabStatsPanel,
  #page-builder[data-deck-lab-view="stats"] #deckLabLeaderPanel,
  #page-builder[data-deck-lab-view="stats"] #deckLabPoolPanel,
  #page-builder[data-deck-lab-view="stats"] #deckLabDeckPanel{display:none}
  .deckLabStatsPanel{margin-top:0}
  .deckLabTabs{position:sticky;top:0;z-index:10;background:#0c1424f2;padding:8px 0}
  .deckLabTabs button{flex:1;padding:11px 7px}
}
@media(max-width:370px){.deckLabBar{grid-template-columns:68px minmax(0,1fr) 24px;gap:5px}}

.deckLabLeaderArt{width:100%;margin:0 0 12px}

.deckLabFormat{margin:10px 0 5px}
#deckLabFormat{margin:0 0 12px}

.deckLabJsonImport{display:block;margin-top:12px;padding-top:9px;border-top:1px solid #35455e;font-size:12px;color:#d9e3ed}.deckLabJsonImport input{display:block;margin-top:7px;font-size:12px;max-width:100%;min-height:42px}#deckLabImportJson::file-selector-button{margin-right:8px;border:1px solid #586f8c;border-radius:6px;background:#1c344e;color:#f0f3f8;padding:7px}
`;
  document.head.appendChild(style);
})();

/* GRAND DECKS v14.0: non-destructive Deck Builder enhancement for existing v13.9. */
(function () {
  'use strict';
  const LAB = window.GrandDeckLab;
  const $ = selector => document.querySelector(selector);
  if (!LAB || typeof renderBuilder !== 'function' || !$('#page-builder')) {
    console.warn('Deck Lab: missing core or incompatible GRAND DECKS base');
    return;
  }
  let mounted = false;
  let selectedArtCard = '';
  let activeView = 'cards';
  let handleShareOnce = false;
  let pendingShareNotice = '';
  const esc = value => String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const count = () => Object.values(currentDeck.items || {}).reduce((sum, n) => sum + Number(n || 0), 0);
  const showMessage = msg => { const target = $('#deckLabMessage'); if (target) target.textContent = String(msg || ''); };
  const showToast = msg => typeof toast === 'function' ? toast(msg) : showMessage(msg);
  const iconLabel = { Character: '角色', Event: '事件', Stage: '場景', Leader: '領航員', Don: 'DON!!', '未知': '未知' };
  const colorLabel = { Red: '紅', Green: '綠', Blue: '藍', Purple: '紫', Black: '黑', Yellow: '黃', '未知': '未知' };

  function mount() {
    if (mounted) return;
    const page = $('#page-builder'), layout = page?.querySelector('.builderlayout');
    const leftPanels = layout?.querySelectorAll('.builderLeft > .panel');
    const rightPanel = layout?.querySelector('.builderRight > .panel');
    const available = $('#buildAvailable');
    if (!layout || !rightPanel || !leftPanels || leftPanels.length < 2 || !available) return;
    mounted = true;
    leftPanels[0].id = 'deckLabLeaderPanel';
    leftPanels[1].id = 'deckLabPoolPanel';
    rightPanel.id = 'deckLabDeckPanel';
    const tabs = document.createElement('div');
    tabs.className = 'deckLabTabs';
    tabs.innerHTML = '<button type="button" data-lab-view="cards" aria-pressed="true">卡片池</button><button type="button" data-lab-view="deck" aria-pressed="false">我的牌組</button><button type="button" data-lab-view="stats" aria-pressed="false">統計</button>';
    layout.parentNode.insertBefore(tabs, layout);
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-lab-view]');
      if (btn) setView(btn.dataset.labView);
    });

    const filters = document.createElement('div');
    filters.className = 'deckLabFilters';
    filters.innerHTML = '<select id="deckLabType" aria-label="卡片類型"><option value="">全部類型</option><option value="Character">角色</option><option value="Event">事件</option><option value="Stage">場景</option></select>' +
      '<select id="deckLabCost" aria-label="卡片費用"><option value="">全部費用</option>' + Array.from({ length: 10 }, (_, i) => `<option value="${i}">${i} 費</option>`).join('') + '<option value="10+">10 費以上</option></select>';
    available.parentNode.insertBefore(filters, available);
    filters.addEventListener('change', () => { shownBuilder = 50; renderBuilder(); });

    const stats = document.createElement('section');
    stats.id = 'deckLabStatsPanel';
    stats.className = 'panel deckLabStatsPanel';
    stats.innerHTML = '<div class="panelheading"><strong>04 · 牌組分析</strong><span>即時計算</span></div><div id="deckLabStats" aria-live="polite"></div>';
    layout.querySelector('.builderRight').appendChild(stats);

    const formatLabel = document.createElement('label');
    formatLabel.className = 'deckLabFormat inputlabel';
    formatLabel.htmlFor = 'deckLabFormat';
    formatLabel.textContent = '賽制（僅作標記，當期輪替規則尚未驗證）';
    const formatSelect = document.createElement('select');
    formatSelect.id = 'deckLabFormat';
    formatSelect.innerHTML = '<option value="standard">Standard 標準</option><option value="extended">Extended 延伸</option>';
    const originalRegion = rightPanel.querySelector('#ruleRegion');
    if (originalRegion) {
      originalRegion.insertAdjacentElement('afterend', formatSelect);
      formatSelect.insertAdjacentElement('beforebegin', formatLabel);
    } else rightPanel.prepend(formatLabel, formatSelect);
    formatSelect.addEventListener('change', () => {
      currentDeck.format = formatSelect.value;
      saveDraft();
    });
    const leaderArt = document.createElement('button');
    leaderArt.type = 'button';
    leaderArt.id = 'deckLabLeaderArt';
    leaderArt.className = 'secondary small deckLabLeaderArt';
    leaderArt.textContent = '選擇領航員卡面';
    rightPanel.insertBefore(leaderArt, rightPanel.querySelector('#deckEntries'));
    leaderArt.addEventListener('click', () => {
      if (!currentDeck.leaderId) { showToast('請先選擇領航員'); return; }
      openArtDialog(currentDeck.leaderId);
    });
    const box = document.createElement('div');
    box.className = 'deckLabTools';
    box.innerHTML = '<div class="deckLabActions"><button class="secondary small" type="button" id="deckLabShare">複製分享連結</button>' +
      '<button class="secondary small" type="button" id="deckLabExport">下載此副牌組 JSON</button></div>' +
      '<details class="deckLabImport"><summary>匯入其他牌組文字</summary><p class="tiny">支援 LEADER: OP01-001、4x OP01-002 或 OP01-002 x4。匯入前不會更動現有草稿。</p>' +
      '<textarea id="deckLabImportText" rows="5" maxlength="25000" placeholder="LEADER: OP01-001&#10;4x OP01-002&#10;…" aria-label="貼上牌組清單"></textarea><button class="secondary small" type="button" id="deckLabApplyImport">檢查並匯入文字</button>' +
      '<label class="deckLabJsonImport">或選擇本站匯出的單副牌組 JSON <input type="file" id="deckLabImportJson" accept=".json,application/json" aria-label="匯入單副牌組 JSON"></label></details><p class="tiny" id="deckLabMessage" role="status" aria-live="polite"></p>';
    rightPanel.appendChild(box);
    const actions = $('.deckLabActions');
    actions.addEventListener('click', event => {
      const id = event.target.id;
      if (id === 'deckLabShare') shareLink();
      if (id === 'deckLabExport') exportDeck();
    });
    $('#deckLabApplyImport').addEventListener('click', importText);
    $('#deckLabImportJson').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (file) await importJsonFile(file);
      event.target.value = '';
    });

    const dialog = document.createElement('dialog');
    dialog.id = 'deckLabArtDialog';
    dialog.setAttribute('aria-labelledby', 'deckLabArtTitle');
    dialog.innerHTML = '<div class="dialogHead"><strong id="deckLabArtTitle">選擇牌組卡面</strong><button type="button" class="iconBtn" id="deckLabArtClose" aria-label="關閉">✕</button></div><div class="deckLabArtBody"><p class="tiny" id="deckLabArtHint"></p><div id="deckLabArtGrid" class="deckLabArtGrid"></div></div>';
    document.body.appendChild(dialog);
    $('#deckLabArtClose').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    $('#deckLabArtGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-art-version]');
      if (!button || button.hidden || !selectedArtCard || !(currentDeck.items?.[selectedArtCard] || selectedArtCard === currentDeck.leaderId)) return;
      const version = button.dataset.artVersion;
      const available = allArtworkVersions(selectedArtCard).some(item => item.printId === version);
      if (version && !available) { showMessage('選取的卡面版本已不在來源清單，未變更。'); return; }
      if (!currentDeck.artworks || typeof currentDeck.artworks !== 'object') currentDeck.artworks = {};
      if (version) currentDeck.artworks[selectedArtCard] = version;
      else delete currentDeck.artworks[selectedArtCard];
      saveDraft();
      renderBuilder();
      dialog.close();
      showToast(version ? '此副牌組的卡面版本已更新' : '已恢復日文優先的預設卡面');
    });
    $('#myDecks')?.addEventListener('click', event => {
      const button = event.target.closest('[data-edit]');
      if (!button) return;
      const saved = decks.find(d => d.id === button.dataset.edit);
      if (!saved) return;
      queueMicrotask(() => {
        if (currentDeck.leaderId !== saved.leaderId) return;
        currentDeck.artworks = { ...(saved.artworks || {}) };
        currentDeck.format = saved.format === 'extended' ? 'extended' : 'standard';
        saveDraft(); renderBuilder();
      });
    }, true);
    $('#deckEntries').addEventListener('click', event => {
      const b = event.target.closest('[data-deck-art]');
      if (!b) return;
      // The original deck editor processes only data-add/data-dec; keep artwork controls separate.
      event.preventDefault();
      openArtDialog(b.dataset.deckArt);
    });
    setView(activeView);
    filterPool();
    renderInsights();
  }

  function setView(value) {
    activeView = ['cards', 'deck', 'stats'].includes(value) ? value : 'cards';
    const page = $('#page-builder');
    if (!page) return;
    page.dataset.deckLabView = activeView;
    page.querySelectorAll('[data-lab-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.labView === activeView)));
  }

  function filterPool() {
    const type = $('#deckLabType')?.value || '', cost = $('#deckLabCost')?.value || '';
    // Do not filter only the first 50 rendered cards: use the entire real catalogue.
    if (!type && !cost) return;
    const q = $('#buildSearch')?.value.toLowerCase().trim() || '';
    const pool = cards.filter(card => canInclude(card)
      && (!type || card.category === type)
      && (!cost || (cost === '10+' ? Number(card.cost) >= 10 : card.cost === Number(cost)))
      && (!q || [card.name, card.id, card.effect].some(value => String(value || '').toLowerCase().includes(q))));
    $('#buildAvailable').innerHTML = pool.slice(0, shownBuilder).map(card => {
      const n = currentDeck.items[card.id] || 0;
      const cName = card.colors?.[0] || '';
      return `<div class="buildrow">${cardMini(card)}<div><strong class="cardTextTrigger" data-card-detail="${esc(card.id)}" role="button" tabindex="0">${esc(card.name)}</strong><small>${esc(card.id)} · 費用 ${esc(card.cost ?? '—')} · ${esc(colorLabel[cName] || cName)}</small></div><button class="plus" data-add="${esc(card.id)}" ${n >= 4 || count() >= 50 ? 'disabled' : ''}>+ ${n ? `${n}/4` : '加入'}</button></div>`;
    }).join('') || '<p class="note">沒有符合條件的卡牌，請調整篩選。</p>';
    $('#buildMore').hidden = pool.length <= shownBuilder;
  }

  function chartRows(map, labels, denominator) {
    return Object.entries(map).filter(([, n]) => n > 0).map(([key, n]) => {
      const p = denominator ? Math.min(100, n / denominator * 100) : 0;
      return `<div class="deckLabBar" aria-label="${esc(labels[key] || key)} ${n} 張"><span>${esc(labels[key] || key)}</span><div class="deckLabTrack"><i style="width:${p.toFixed(1)}%"></i></div><b>${n}</b></div>`;
    }).join('') || '<p class="tiny">尚無卡片資料</p>';
  }

  function renderInsights() {
    const target = $('#deckLabStats');
    if (!target) return;
    const s = LAB.summarize(currentDeck, byId);
    const formatSelect = $('#deckLabFormat');
    if (formatSelect && document.activeElement !== formatSelect) formatSelect.value = currentDeck.format === 'extended' ? 'extended' : 'standard';
    const leaderArt = $('#deckLabLeaderArt');
    if (leaderArt) leaderArt.textContent = currentDeck.artworks?.[currentDeck.leaderId] ? '✓ 已選領航員卡面' : '選擇領航員卡面';
    const costLabels = Object.fromEntries(LAB.COST_KEYS.map(key => [key, key === '未知' ? '費用未標示' : key === '10+' ? '10 費以上' : `${key} 費`]));
    const counterNote = '部分來源未提供 Counter；「未標示」不視為 0。';
    target.innerHTML = `<div class="deckLabKpis"><div><b>${s.total}/50</b><small>主牌張數</small></div><div><b>${s.averageCost === null ? '—' : s.averageCost.toFixed(2)}</b><small>平均費用（${s.knownCostCount} 張有資料）</small></div><div><b>${s.counters['+2000']}</b><small>Counter +2000</small></div></div>` +
      `<details open><summary>費用曲線</summary>${chartRows(s.costs, costLabels, s.total)}</details>` +
      `<details><summary>Counter 分布</summary>${chartRows(s.counters, {}, s.total)}<p class="tiny">${counterNote}</p></details>` +
      `<details><summary>卡牌種類</summary>${chartRows(s.types, iconLabel, s.total)}</details>` +
      `<details><summary>卡牌顏色</summary>${chartRows(s.colors, colorLabel, s.total)}<p class="tiny">雙色卡會分別計入兩種顏色。</p></details>` +
      (s.unknownCards ? `<p class="warningMeta">${s.unknownCards} 張卡號目前在卡庫中找不到，統計不完整。</p>` : '') +
      '<p class="tiny">統計依目前卡片索引計算；目前禁限卡規則資料尚未完整核實，不代表正式賽事合法。</p>';
  }

  function setImageFallback(img, sources, hideIfBroken) {
    if (!img || !sources?.length) return;
    let index = 0;
    img.removeAttribute('onerror');
    img.onerror = function () {
      index++;
      if (index < sources.length) img.src = sources[index];
      else if (hideIfBroken) img.closest('.deckLabArtOption')?.remove();
      else img.remove();
    };
    img.referrerPolicy = 'no-referrer';
    img.src = sources[0];
  }

  function decorateEntries() {
    const leaderVersionId = currentDeck.artworks?.[currentDeck.leaderId];
    const leaderVersion = leaderVersionId && allArtworkVersions(currentDeck.leaderId).find(item => item.printId === leaderVersionId);
    if (leaderVersion) {
      const leaderImg = $('#leaderPicks .leaderpick.selected .leaderCardArt img');
      if (leaderImg) setImageFallback(leaderImg, leaderVersion.sources, false);
    }
    $('#deckEntries')?.querySelectorAll('.deckentry').forEach(row => {
      const id = row.querySelector('[data-add]')?.dataset.add;
      if (!id) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'deckLabArtPick';
      button.dataset.deckArt = id;
      button.textContent = currentDeck.artworks?.[id] ? '✓ 卡面' : '卡面';
      button.setAttribute('aria-label', `選擇 ${id} 的卡面版本`);
      row.appendChild(button);
      const selected = currentDeck.artworks?.[id];
      const version = selected && allArtworkVersions(id).find(item => item.printId === selected);
      if (!version) return;
      const img = row.querySelector('.miniCard img');
      if (img) setImageFallback(img, version.sources, false);
    });
  }

  async function openArtDialog(id) {
    if (!(currentDeck.items?.[id] || currentDeck.leaderId === id)) return;
    selectedArtCard = id;
    const dialog = $('#deckLabArtDialog'), grid = $('#deckLabArtGrid'), hint = $('#deckLabArtHint');
    $('#deckLabArtTitle').textContent = `${id} · 選擇卡面`;
    hint.textContent = '讀取現有卡面版本索引中…';
    grid.innerHTML = '';
    dialog.showModal();
    try {
      await fetchPrintingsOnce();
      if (!dialog.open || selectedArtCard !== id) return;
      const versions = allArtworkVersions(id);
      const defaultActive = !currentDeck.artworks?.[id];
      grid.innerHTML = `<button class="deckLabArtOption ${defaultActive ? 'selected' : ''}" data-art-version="" type="button"><span class="deckLabArtDefault">日文優先</span><strong>恢復預設</strong></button>` +
        versions.map((v, idx) => `<button class="deckLabArtOption ${currentDeck.artworks?.[id] === v.printId ? 'selected' : ''}" type="button" data-art-version="${esc(v.printId)}"><img alt="${esc(v.printId)}" loading="lazy" data-art-index="${idx}"><strong>${esc(v.printId)}</strong><small>${esc(taiwanVersionKindLabel(v.kind))} · ${esc(v.locales.join(' / '))}</small></button>`).join('');
      grid.querySelectorAll('[data-art-index]').forEach(img => {
        const version = versions[Number(img.dataset.artIndex)];
        if (version) setImageFallback(img, version.sources, true);
      });
      hint.textContent = versions.length ? '同一張卡的不同畫面不增加牌組張數。僅儲存印刷版本 ID，不儲存圖片。' : '目前沒有具備圖片來源的額外卡面。';
    } catch (error) { if (dialog.open && selectedArtCard === id) hint.textContent = `無法取得卡面版本：${error.message}`; }
  }

  function applyImportedDeck(result, origin) {
    if (!result.ok) { showMessage((result.errors || ['匯入資料有誤']).slice(0, 4).join('；')); return false; }
    const unknown = Object.keys(result.deck.items).filter(id => !byId(id)).length;
    const leader = byId(result.deck.leaderId);
    if (!leader || leader.category !== 'Leader') { showMessage('領航員卡號不在目前卡牌資料中，未匯入。'); return false; }
    if ((currentDeck.leaderId || count() > 0) && !confirm('這會取代目前未儲存的組牌草稿。已儲存牌組不受影響，確定匯入嗎？')) return false;
    currentDeck = result.deck;
    saveDraft(); renderBuilder(); setView('deck');
    showMessage(`已由${origin}匯入 ${result.count} 張（${unknown} 種卡號未收錄）。${result.count !== 50 ? '目前還不是完整 50 張。' : '請依實際賽制再次檢查。'}`);
    return true;
  }

  function importText() {
    applyImportedDeck(LAB.parseText($('#deckLabImportText').value), '文字');
  }

  async function importJsonFile(file) {
    if (file.size > 100000) { showMessage('JSON 檔案超過 100 KB，已拒絕匯入。'); return; }
    try {
      const source = JSON.parse(await file.text());
      if (source?.shareFormat !== 'grand-decks-share-v1') { showMessage('不是本站的單副牌組 JSON；未更動草稿。'); return; }
      applyImportedDeck(LAB.normalizeDeck(source), 'JSON');
    } catch (error) { showMessage('讀取 JSON 失敗：' + error.message); }
  }

  function exportDeck() {
    const checked = LAB.normalizeDeck(currentDeck);
    if (!checked.ok) { showMessage(checked.errors.join('；')); return; }
    const documentData = { shareFormat: 'grand-decks-share-v1', savedAt: new Date().toISOString(), ...checked.deck };
    const object = new Blob([JSON.stringify(documentData, null, 2)], { type: 'application/json;charset=utf-8' });
    const href = URL.createObjectURL(object), link = document.createElement('a');
    link.href = href;
    link.download = `grand-decks-${checked.deck.leaderId}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    showMessage('已建立此副牌組的 JSON 備份，只有你的瀏覽器取得檔案。');
  }

  async function shareLink() {
    try {
      const hash = LAB.shareHash(currentDeck);
      const url = location.origin + location.pathname + location.search + hash;
      await navigator.clipboard.writeText(url);
      showMessage(location.hostname === '127.0.0.1' || location.hostname === 'localhost' ? '已複製本機測試連結。127.0.0.1 只能在本裝置測試；正式部署後的網址才能分享給其他裝置。' : '已複製牌組分享連結。開啟者須確認後才會匯入，不會覆蓋其原有草稿。');
    } catch (error) { showMessage('無法複製連結：' + error.message); }
  }

  function checkSharedLink() {
    if (handleShareOnce || !location.hash.startsWith('#deck=')) return;
    const checked = LAB.parseShareHash(location.hash);
    if (!checked.ok) {
      handleShareOnce = true;
      showMessage(checked.errors.join('；'));
      return;
    }
    // The original page restores IndexedDB before it asynchronously refreshes cards.json.
    // A valid Leader may not yet be indexed. Do NOT consume the share link while waiting.
    const leader = byId(checked.deck.leaderId);
    if (!leader || leader.category !== 'Leader') {
      if (pendingShareNotice !== checked.deck.leaderId) {
        pendingShareNotice = checked.deck.leaderId;
        showMessage('已收到分享牌組；等待卡牌資料載入。若卡號仍找不到，請先更新卡表。');
      }
      return;
    }
    handleShareOnce = true;
    pendingShareNotice = '';
    if (!confirm(`收到 ${checked.deck.leaderId} 的 ${checked.count} 張分享牌組。是否將它匯入目前的組牌草稿？`)) return;
    currentDeck = checked.deck;
    saveDraft();
    if (typeof nav === 'function') nav('builder');
    else renderBuilder();
    setView('deck');
    showMessage('已匯入分享牌組。請確認資料來源與當期禁限卡規則。');
  }

  function decorateSavedDecks() {
    $('#myDecks')?.querySelectorAll('.myDeck').forEach(row => {
      const id = row.querySelector('[data-edit]')?.dataset.edit;
      const saved = id && decks.find(item => item.id === id);
      const artId = saved?.artworks?.[saved.leaderId];
      const art = artId && allArtworkVersions(saved.leaderId).find(item => item.printId === artId);
      const image = row.querySelector('.myDeckHeader .miniCard img');
      if (art && image) setImageFallback(image, art.sources, false);
    });
  }
  const originalRenderHome = renderHome;
  renderHome = function () {
    originalRenderHome();
    if (!handleShareOnce && location.hash.startsWith('#deck=')) queueMicrotask(checkSharedLink);
  };
  const originalRenderDecks = renderDecks;
  renderDecks = function () { originalRenderDecks(); decorateSavedDecks(); };
  const originalRenderBuilder = renderBuilder;
  renderBuilder = function () {
    originalRenderBuilder();
    mount();
    filterPool();
    decorateEntries();
    renderInsights();
    if (!handleShareOnce && location.hash.startsWith('#deck=')) queueMicrotask(checkSharedLink);
  };
  mount();
  // Original init() has asynchronous IndexedDB and cards loading; defer incoming share until after a render.
  const originalNav = nav;
  nav = function (page) {
    originalNav(page);
    if ((page === 'home' || page === 'builder') && !handleShareOnce) checkSharedLink();
  };
  window.addEventListener('hashchange', () => { handleShareOnce = false; if (location.hash.startsWith('#deck=')) checkSharedLink(); });
  // Startup share is checked after app.init() has restored IndexedDB and called nav('home').
})();


/* Release label and history: update the existing UI without replacing history.js. */
(() => {
  'use strict';
  const update = () => {
    const history = window.GRAND_DECKS_RELEASES;
    if (Array.isArray(history) && !history.some(item => item.version === '14.0')) {
      history.unshift({version:'14.0',date:'2026-11-23',status:'正式功能升級',title:'Deck Builder 組牌工作室強化',changes:[
        '整合牌組費用曲線、Counter、類型與顏色分布統計',
        '新增卡片類型及費用篩選、手機卡池／牌組／統計切換',
        '支援單副牌組 JSON／文字匯入與匯出、可分享的牌組連結',
        '每副牌組獨立保存卡面版本；延續日文卡面優先',
        'Standard／Extended 僅為標記，當期禁限卡與輪替規則仍需依官方公告核對'
      ]});
    }
    const button = document.getElementById('versionHistoryBtn');
    if (button) {
      button.textContent = 'v14.0 · 更新紀錄';
      button.setAttribute('aria-label','目前 v14.0，查看版本更新紀錄');
    }
    const list = document.getElementById('versionList');
    if (list && !list.querySelector('[data-v14-release]')) {
      const article = document.createElement('article');
      article.className='releaseEntry';
      article.dataset.v14Release='true';
      article.innerHTML='<div class="releaseRow"><strong>v14.0 · 目前版本</strong><small>2026-11-23 · 正式功能升級</small></div>' +
        '<h3>Deck Builder 組牌工作室強化</h3>' +
        '<ul><li>即時費用曲線、Counter、類型及顏色統計</li><li>費用與類型篩選、手機三分頁</li><li>文字／JSON 匯入與匯出、牌組分享連結</li><li>牌組獨立卡面版本設定，日文卡面優先</li><li>賽制僅作標記；禁限卡合法性仍依官方公告</li></ul>';
      list.prepend(article);
      list.querySelectorAll('.releaseEntry .releaseRow strong').forEach((strong, index) => {
        if (index > 0) strong.textContent = strong.textContent.replace(' · 目前版本','');
      });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',update);
  else update();
})();
