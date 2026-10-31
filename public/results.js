/* GRAND DECKS v9: audited tournament intelligence; offline personal community leads. */
(() => {
  'use strict';
  const $ = id=>document.getElementById(id);
  const enc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const countryGroups={JP:'JP',TW:'TW',HK:'ASIA',CN:'ASIA',KR:'ASIA',SG:'ASIA',MY:'ASIA',TH:'ASIA',PH:'ASIA',ID:'ASIA',US:'NA',CA:'NA',MX:'NA',GB:'EU',DE:'EU',FR:'EU',ES:'EU',IT:'EU',NL:'EU',PL:'EU',BE:'EU'};
  const region=c=>countryGroups[String(c||'').toUpperCase()]||'OTHER';
  const safeUrl=value=>{try{const u=new URL(String(value));return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const countCards=cards=>Object.values(cards||{}).reduce((s,n)=>s+Number(n||0),0);
  const mini=id=>typeof window.grandCardMini==='function'?window.grandCardMini(id):`<span class="miniCard noImage"><small>${enc(id)}</small></span>`;
  const cardName=id=>{const c=window.grandCardInfo?.(id);return c?.name||id;};
  const percentage=(n,d)=>d?(n/d*100).toFixed(1)+'%':'—';
  const localKey='grand-community-notes', favKey='grand-results-favorites';
  let results=[], meta=null, loadedAt='', candidates=[], favorites=[], compareIds=[];
  const nowDate=()=>new Date().toISOString().slice(0,10);
  function fromStorage(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
  function store(key,v){try{localStorage.setItem(key,JSON.stringify(v));return true;}catch{toast('無法儲存至瀏覽器，請確認儲存空間');return false;}}
  function daysSince(day){const t=new Date(day+'T00:00:00Z');return Number.isFinite(+t)?Math.floor((Date.now()-t.getTime())/86400000):Infinity;}
  function isComplete(x){return countCards(x.cards)===50&&Object.values(x.cards||{}).every(n=>Number.isInteger(n)&&n>=1&&n<=4);}
  function filtered(){
    const q=$('resultsSearch').value.trim().toLowerCase(),place=$('resultsCountry').value,src=$('resultsSource').value;
    const max=Number($('resultsRank').value||999),windowDays=Number($('resultsWindow').value||0);
    return results.filter(x=>(!q||[x.leaderId,x.leaderName,x.player,x.event,x.country,x.source].some(v=>String(v||'').toLowerCase().includes(q)))&&
      (!place||place===x.country||place===region(x.country))&&(!src||src===x.source)&&(!x.placing||x.placing<=max)&&
      (!windowDays||(daysSince(x.date)>=0&&daysSince(x.date)<windowDays)))
      .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||(a.placing||999)-(b.placing||999));
  }
  function sourcePill(x){return x.sourceType==='platform_result'?'公開賽事平台':x.sourceType==='community_claim'?'社群自述・未查證':'第三方來源報告';}
  function rowsToText(x){return ['LEADER: '+x.leaderId,...Object.entries(x.cards||{}).sort((a,b)=>a[0].localeCompare(b[0])).map(([id,n])=>n+'x '+id)].join('\n');}
  async function load(force=false){
    if(results.length&&!force)return;
    $('resultsStatus').textContent='讀取賽事與 Meta 快照中…';
    try{
      const suffix=force?'?refresh='+Date.now():'';
      const res=await fetch('./data/decks.json'+suffix,{cache:'no-store'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const doc=await res.json();if(!Array.isArray(doc.decks))throw Error('decks.json 格式不正確');
      const idset=new Set();results=doc.decks.filter(x=>x&&typeof x.id==='string'&&!idset.has(x.id)&&idset.add(x.id));loadedAt=doc.updatedAt||'';
      try{const r=await fetch('./data/meta.json'+suffix,{cache:'no-store'});meta=r.ok?await r.json():null;}catch{meta=null;}
      $('resultsStatus').textContent=`共 ${results.length} 筆可追溯來源紀錄。${loadedAt?'快照更新 '+new Date(loadedAt).toLocaleString('zh-TW'):'尚未完成線上首次同步；目前是預附來源樣本'}。資料量不是全球賽事母體。`;
    }catch(e){$('resultsStatus').textContent='賽事資料載入失敗，已保留目前資料：'+e.message;}
    renderResults();renderMeta();
  }
  function renderResults(){
    $('rCount').textContent=results.length.toLocaleString();
    $('rLeaders').textContent=new Set(results.map(x=>x.leaderId).filter(Boolean)).size;
    $('rSources').textContent=new Set(results.map(x=>x.source).filter(Boolean)).size;
    const data=filtered();$('resultsCountText').textContent=`${data.length} 套結果（最多顯示前 150 筆）`;
    $('resultsGrid').innerHTML=data.length?data.slice(0,150).map(x=>{
      const url=safeUrl(x.sourceUrl),full=isComplete(x),selected=compareIds.includes(x.id),isFav=favorites.includes(x.id);
      const wr=Number.isInteger(x.wins)&&Number.isInteger(x.losses)&&x.wins+x.losses>0?percentage(x.wins,x.wins+x.losses):'未公開';
      const entries=Object.entries(x.cards||{}).sort((a,b)=>a[0].localeCompare(b[0]));
      return `<article class="resultCard"><div class="resultTop"><span class="resultRank">${x.placing?'TOP '+enc(x.placing):'名次未公開'}</span><span class="statusPill ${x.sourceType==='platform_result'?'':'unverified'}">${enc(sourcePill(x))}</span></div>
        <div class="resultLeader">${mini(x.leaderId)}<div><h3>${enc(x.leaderName||x.leaderId)}</h3><div class="resultTags"><span class="resultTag">${enc(x.leaderId)}</span><span class="resultTag">${enc(x.country||'地區未明')}</span><span class="resultTag">${enc(x.date||'日期未明')}</span></div></div></div>
        <p><strong>${enc(x.player||'未公開')}</strong> · ${enc(x.event||'未知賽事')}</p>
        <p>人數 ${x.players==null?'未公開':enc(x.players)} ｜ 個人戰績 ${x.wins==null||x.losses==null?'未公開':enc(x.wins)+' 勝 '+enc(x.losses)+' 敗'}（${wr}）</p>
        <div class="resultActions">${url?`<a href="${enc(url)}" target="_blank" rel="noopener noreferrer">原始來源 ↗</a>`:''}
        <button data-favorite="${enc(x.id)}" aria-pressed="${isFav}">${isFav?'★ 已收藏':'☆ 收藏'}</button>
        <button data-compare="${enc(x.id)}" aria-pressed="${selected}" ${full?'':'disabled title="未取得完整 50 張牌組"'}>${selected?'✓ 已加入比較':'加入比較'}</button>
        <button data-copy-result="${enc(x.id)}" ${full?'':'disabled'}>複製清單</button><button data-edit-result="${enc(x.id)}" ${full?'':'disabled'}>帶入組牌</button></div>
        <details class="resultDetails"><summary>卡圖對照・資料證據與${full?'完整 50 張牌組':'不完整牌組（不可匯入）'}</summary><p>${enc(x.evidence||'請查看原始來源。')}</p>${entries.length?`<div class="cardsRows">${entries.map(([id,n])=>`<div class="deckCardVisual">${mini(id)}<span><strong>${enc(cardName(id))}</strong><small>${enc(id)} · ${enc(n)} 張</small></span><b>×${enc(n)}</b></div>`).join('')}</div>`:'<p>沒有公開完整卡號；不會產生虛構卡表。</p>'}</details></article>`;
    }).join(''):'<div class="panel">目前沒有符合搜尋或日期的來源紀錄。更換條件，或等待下一次合法資料同步。</div>';
    const box=$('compareHint');if(box)box.innerHTML=`已選 <strong>${compareIds.length}/2</strong> 套完整牌組。${compareIds.length===2?'<button class="primary small" id="showComparison">立即比較差異</button>':'請從賽事卡片點選「加入比較」。'}`;
    $('showComparison')?.addEventListener('click',showComparison);
  }
  function showComparison(){
    if(compareIds.length!==2)return;
    const [a,b]=compareIds.map(id=>results.find(r=>r.id===id));if(!a||!b)return;
    const keys=[...new Set([...Object.keys(a.cards),...Object.keys(b.cards)])].sort();
    const added=keys.filter(id=>(b.cards[id]||0)>(a.cards[id]||0));
    const removed=keys.filter(id=>(b.cards[id]||0)<(a.cards[id]||0));
    const unchanged=keys.filter(id=>a.cards[id]===b.cards[id]).length;
    const table=keys.filter(id=>(a.cards[id]||0)!==(b.cards[id]||0))
      .map(id=>`<div class="compareRow">${mini(id)}<span>${enc(cardName(id))}<small>${enc(id)}</small></span><span class="${(b.cards[id]||0)>(a.cards[id]||0)?'compareDiffMore':'compareDiffLess'}">${a.cards[id]||0} → ${b.cards[id]||0} 張</span></div>`).join('');
    $('compareBody').innerHTML=`<p>比較卡號與張數，不評斷哪套勝率較高。</p><div class="compareCols"><div class="compareCol"><h3>牌組 A</h3><strong>${enc(a.leaderName||a.leaderId)}</strong><p>${enc(a.date)} · ${enc(a.player||'')}</p></div><div class="compareCol"><h3>牌組 B</h3><strong>${enc(b.leaderName||b.leaderId)}</strong><p>${enc(b.date)} · ${enc(b.player||'')}</p></div></div>
      <p class="warningMeta">${a.leaderId===b.leaderId?'相同領航員，可比較構築差異。':'領航員不同，請留意牌組可能屬不同規則或環境。'} 相同張數卡號：${unchanged} 種；B 張數增加：${added.length} 種；B 張數減少：${removed.length} 種。</p><h3>張數差異</h3>${table||'<p>兩套牌組卡號與張數相同。</p>'}`;
    $('compareDialog').showModal();
  }
  function fallbackMeta(windowDays,reg){
    const filtered=results.filter(x=>x.leaderId&&x.placing>=1&&x.placing<=8&&x.sourceType!=='community_claim'&&
      (reg==='ALL'||region(x.country)===reg)&&(!windowDays||daysSince(x.date)>=0&&daysSince(x.date)<windowDays));
    const grouped=new Map();for(const x of filtered){const v=grouped.get(x.leaderId)||{leaderId:x.leaderId,topCutCount:0,championCount:0};v.topCutCount++;if(x.placing===1)v.championCount++;grouped.set(x.leaderId,v);}
    const leaders=[...grouped.values()].sort((a,b)=>b.topCutCount-a.topCutCount);
    return {sampleCount:filtered.length,uniqueLeaders:leaders.length,leaders:leaders.map(x=>({...x,numerator:x.topCutCount,denominator:filtered.length,topCutShare:filtered.length?x.topCutCount/filtered.length*100:0})),sampleWarning:filtered.length<20};
  }
  function renderMeta(){
    const days=Number($('metaWindow').value),reg=$('metaRegion').value;
    const m=meta?.windows?.[days+':'+reg]||fallbackMeta(days,reg);
    const n=m.sampleCount||0;
    $('metaStatus').textContent=`${days?'近 '+days+' 天':'全部歷史'} · ${reg==='ALL'?'所有地區':reg} · 收錄前八牌組 ${n} 筆、領航員 ${m.uniqueLeaders||0} 種。這是「本站前八樣本佔比」，不是全球勝率或所有參賽者使用率。`;
    $('metaList').innerHTML=(m.leaders||[]).slice(0,30).map((v,i)=>{
      const row=results.find(r=>r.leaderId===v.leaderId);
      const pct=Math.min(100,Math.max(0,v.topCutShare||0));
      return `<div class="metaRow"><strong>#${i+1}</strong><div><b>${enc(row?.leaderName||v.leaderId)}</b><span>${enc(v.leaderId)} · 冠軍 ${v.championCount||0} 次 · 前八 ${v.topCutCount} 次</span><div class="metaBar"><div style="width:${pct}%"></div></div><small class="note">分子 ${v.numerator} / 分母 ${v.denominator}（已收錄前八）</small></div><strong>${pct.toFixed(1)}%</strong></div>`;
    }).join('')||'<div class="panel">這個期間／地區尚無已收錄的前八結果。</div>';
    if(m.sampleWarning)$('metaStatus').textContent+=' 樣本不足 20 筆，排名僅供參考。';
    if(m.formatWarning)$('metaStatus').textContent+=' 部分來源未提供賽制／禁限卡版本，不能據此比較不同環境的強度。';
  }
  async function loadPublishedCommunity(){
    try{const res=await fetch('./data/community.json',{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);
      const data=await res.json();const list=Array.isArray(data.candidates)?data.candidates:[];
      $('publishedCommunity').innerHTML=list.length?list.slice(0,30).map(x=>{
        const url=safeUrl(x.sourceUrl);return `<div class="socialEntry"><span><strong>${enc(x.title)}</strong> · ${enc(x.sourceName)}<br><small>待查證 · ${enc(x.date||'日期未公開')}</small></span>${url?`<a href="${enc(url)}" target="_blank" rel="noopener noreferrer">查看來源 ↗</a>`:''}</div>`;
      }).join(''):'目前沒有已設定或可合法取得的社群 RSS／Atom 情報；你仍可在下方加入本機候選。';
    }catch{$('publishedCommunity').textContent='社群同步資料尚未就緒，個人候選仍可使用。';}
  }
  function renderNotes(){
    $('communityNotes').innerHTML=candidates.length?candidates.map((n,i)=>`<div class="socialEntry"><span>${enc(n.name)}　<a href="${enc(safeUrl(n.url))}" target="_blank" rel="noopener noreferrer">來源 ↗</a><br><small>本機待核實 · ${enc(n.date)}</small></span><button data-del-note="${i}" aria-label="刪除候選">移除</button></div>`).join(''):'目前沒有個人社群候選。公開 X / Reddit / YouTube 連結須由使用者主動提交，未啟用付費 API。';
  }
  function addNote(){const name=$('communityLeader').value.trim(),url=safeUrl($('communityLink').value.trim());
    if(!name||!url){toast('請填牌組名稱及 HTTPS 來源');return;}
    if(candidates.some(n=>n.url===url)){toast('同一來源網址已存在，避免重複蒐集');return;}
    candidates=[{name:name.slice(0,100),url,date:nowDate()},...candidates].slice(0,150);
    if(!store(localKey,candidates))return;
    $('communityLeader').value='';$('communityLink').value='';renderNotes();toast('已加入本機待核實來源，不會計入勝率');
  }
  $('refreshResults').addEventListener('click',()=>load(true));
  ['resultsSearch','resultsCountry','resultsSource','resultsRank','resultsWindow'].forEach(id=>$(id).addEventListener(id==='resultsSearch'?'input':'change',renderResults));
  ['metaWindow','metaRegion'].forEach(id=>$(id).addEventListener('change',renderMeta));
  $('resultsGrid').addEventListener('click',e=>{
    const b=e.target.closest('[data-favorite],[data-compare],[data-copy-result],[data-edit-result]');if(!b)return;
    const id=b.dataset.favorite||b.dataset.compare||b.dataset.copyResult||b.dataset.editResult;
    const row=results.find(x=>x.id===id);if(!row)return;
    if(b.hasAttribute('data-favorite')){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];store(favKey,favorites);renderResults();}
    if(b.hasAttribute('data-compare')){if(!isComplete(row))return;compareIds=compareIds.includes(id)?compareIds.filter(x=>x!==id):[...compareIds.slice(-1),id];renderResults();if(compareIds.length===2)showComparison();}
    if(b.hasAttribute('data-copy-result')&&isComplete(row))copy(rowsToText(row));
    if(b.hasAttribute('data-edit-result')&&isComplete(row))window.importTournamentDeck?.(row);
  });
  $('closeCompare').addEventListener('click',()=>$('compareDialog').close());
  $('saveCommunity').addEventListener('click',addNote);
  $('communityNotes').addEventListener('click',e=>{const b=e.target.closest('[data-del-note]');if(!b)return;candidates.splice(Number(b.dataset.delNote),1);store(localKey,candidates);renderNotes();});
  window.renderResults=page=>{if(!results.length)load();else if(page==='meta')renderMeta();else renderResults();};
  candidates=fromStorage(localKey);favorites=fromStorage(favKey);renderNotes();load();loadPublishedCommunity();
})();
