/* GRAND DECKS: Original, zero-dependency PWA front-end. No paid API keys. */
'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const COLORS = {Red:['紅','#db6b6b'],Green:['綠','#79b38e'],Blue:['藍','#74a8df'],Purple:['紫','#ad8bdc'],Black:['黑','#8a94a9'],Yellow:['黃','#e3c173']};
const COLOR_MAP = {red:'Red',green:'Green',blue:'Blue',purple:'Purple',black:'Black',yellow:'Yellow',紅:'Red',綠:'Green',蓝:'Blue',藍:'Blue',紫:'Purple',黑:'Black',黃:'Yellow',黄:'Yellow'};
const TYPE_MAP={leader:'Leader',character:'Character',event:'Event',stage:'Stage',don:'Don',領航員:'Leader',領袖:'Leader',角色:'Character',事件:'Event',場景:'Stage'};
const CARD_SNAPSHOT_URL = './data/cards.json';
const SYNC_STATUS_URL = './data/sync-status.json';
const DEMO_PEOPLE=['航行者','劍士','航海士','狙擊手','醫者','船匠','考古學者','音樂家','舵手','守衛者','探險家','船長','夥伴','戰略家','航路師'];
const demoCards=(()=>{
  const a=[];
  for(let i=1;i<=6;i++){const cols=Object.keys(COLORS);a.push({id:`DEMO-L${String(i).padStart(2,'0')}`,name:`示範領航員 ${COLORS[cols[i-1]][0]}`,colors:[cols[i-1]],category:'Leader',cost:null,power:5000,rarity:'Leader',pack_id:'DEMO',effect:'此為虛構測試資料，請同步正式卡池。',image:'',demo:true});}
  for(let i=1;i<=90;i++){const cols=Object.keys(COLORS);const color=cols[(i-1)%6];const type=i%9===0?'Event':i%13===0?'Stage':'Character';a.push({id:`DEMO-${String(i).padStart(3,'0')}`,name:`示範${DEMO_PEOPLE[i%DEMO_PEOPLE.length]} ${String(i).padStart(2,'0')}`,colors:[color],category:type,cost:(i%9)+1,power:type==='Character'?1000+((i*3)%9)*1000:null,counter:type==='Character'&&i%3!==0?1000:0,rarity:i%7===0?'Rare':'Common',pack_id:'DEMO',effect:'此卡牌僅用於展示畫面及測試組牌；並非真實發行卡。',image:'',demo:true});}
  return a;
})();
let packNames={}, cards=demoCards, dataKind='demo', updatedAt='', decks=[], currentDeck={name:'',leaderId:'',items:{}}, shownCards=72, shownBuilder=50, shownLeaders=65, currentPage='home', toastTimer, deferredInstall=null, indexedCards=null, cardIndex=new Map(), rulebook=null;
function safe(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function normalizeColors(value){const v=Array.isArray(value)?value:String(value||'').split(/[,/、， ]+/);return [...new Set(v.map(x=>COLOR_MAP[String(x).trim().toLowerCase()]||COLOR_MAP[String(x).trim()]||'').filter(Boolean))];}
function normCat(c){return TYPE_MAP[String(c||'').toLowerCase()]||TYPE_MAP[c]||'Character';}
function numberOrNull(x){if(x===null||x===undefined||x==='')return null;const n=Number(x);return Number.isFinite(n)?n:null;}
function normalizeCard(raw){
  if(!raw||typeof raw!=='object')return null;
  const id=String(raw.id||raw.card_id||raw.card_number||raw.code||'').trim().replace(/_(?:r|p)\d+$/i,'');if(!id)return null;
  return {id,name:String(raw.name||raw.card_name||id),category:normCat(raw.category||raw.type||raw.card_type),colors:normalizeColors(raw.colors||raw.color),cost:numberOrNull(raw.cost),power:numberOrNull(raw.power),counter:numberOrNull(raw.counter),rarity:String(raw.rarity||''),pack_id:String(raw.pack_id||raw.set||id.split('-')[0]),effect:String(raw.effect||raw.text||''),trigger:String(raw.trigger||''),image:String(raw.img_full_url||raw.img_url||raw.image_url||raw.image||'').trim(),demo:false};
}
function dbOpen(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('此瀏覽器不支援 IndexedDB'));const r=indexedDB.open('grand-decks-store',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function kv(action,key,value){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('kv',action==='get'?'readonly':'readwrite');const req=tx.objectStore('kv')[action](...(action==='get'?[key]:[value,key]));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onerror=()=>db.close();});}
const get=key=>kv('get',key);const put=(key,val)=>kv('put',key,val);
const count=()=>Object.values(currentDeck.items||{}).reduce((a,b)=>a+Number(b||0),0);
const byId=id=>{if(indexedCards!==cards){cardIndex=new Map(cards.map(c=>[c.id,c]));indexedCards=cards;}return cardIndex.get(String(id||'').split('_')[0]);};
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}
function nav(page){if(!$('#page-'+page))return;currentPage=page;$$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));window.scrollTo({top:0,behavior:'instant'});if(page==='home')renderHome();if(page==='cards')renderCards();if(page==='builder')renderBuilder();if(page==='decks')renderDecks();if(page==='data')renderData();if(page==='results'||page==='meta')window.renderResults?.(page);}
function cardColor(card){const c=card.colors?.[0];return COLORS[c]?.[1]||'#b9a47b';}
function dots(card){return (card.colors||[]).map(c=>`<span class="dot" title="${COLORS[c]?.[0]||safe(c)}" style="background:${COLORS[c]?.[1]||'#9aa'}"></span>`).join('');}
function cardImageUrl(card){
  if(!card||card.demo)return '';
  if(/^https:\/\//i.test(card.image||''))return card.image;
  // Fallback for previously published metadata snapshots that have no image field.
  if(/^[A-Z0-9]{1,10}-\d{2,4}$/.test(card.id||''))
    return 'https://asia-tw.onepiece-cardgame.com/images/cardlist/card/'+card.id+'.png';
  return '';
}
function cardMini(card, cls='miniCard'){
  if(!card)return `<span class="${cls} noImage">?</span>`;
  const title=safe(card.name||card.id), id=safe(card.id);
  const url=safe(cardImageUrl(card));
  return `<span class="${cls} ${url?'':'noImage'}">${url?`<img src="${url}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<small>${id}</small></span>`;
}
window.grandCardInfo=id=>byId(id);
window.grandCardMini=id=>{const c=byId(id);return cardMini(c||(/^[A-Z0-9]{1,10}-\d{2,4}$/.test(String(id))?{id:String(id),name:String(id),image:'',demo:false}:null));};
function art(card){const name=safe(card.name);const imageUrl=cardImageUrl(card);const img=imageUrl?`<img src="${safe(imageUrl)}" alt="${name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:'';return `<div class="cardart"><span class="artText">${safe(card.demo?'DEMO':card.id)}</span>${img}</div>`;}
function renderHome(){$('#metricCards').textContent=cards.length.toLocaleString('zh-TW');$('#metricDecks').textContent=decks.length;$('#metricStatus').textContent=dataKind==='demo'?'DEMO':dataKind==='sync'?'SYNC':'CUSTOM';$('#metricUpdate').textContent=dataKind==='demo'?'示範資料':updatedAt?`更新 ${updatedAt.slice(0,10)}`:'自訂資料';$('#dataBadge').textContent=dataKind==='demo'?'示範資料':dataKind==='sync'?'繁中卡池':'自訂卡池';}
function updateSetFilter(){
 const e=$('#setFilter'), prev=e.value;
 const ids=[...new Set(cards.map(c=>c.pack_id).filter(Boolean))];
 ids.sort((a,b)=>(packNames[a]||a).localeCompare(packNames[b]||b,'zh-TW',{numeric:true}));
 e.innerHTML='<option value="">全部系列</option>'+ids.map(id=>`<option value="${safe(id)}">${safe(packNames[id]||'其他系列（'+id+'）')}</option>`).join('');
 if(ids.includes(prev))e.value=prev;
}
function cardMatches(c){const q=$('#cardSearch').value.trim().toLowerCase();const color=$('#colorFilter').value,type=$('#typeFilter').value,set=$('#setFilter').value;return(!q||[c.name,c.id,c.effect,c.pack_id].some(v=>String(v||'').toLowerCase().includes(q)))&&(!color||c.colors.includes(color))&&(!type||c.category===type)&&(!set||c.pack_id===set);}
function renderCards(){const matched=cards.filter(cardMatches);$('#cardCount').textContent=`${matched.length.toLocaleString('zh-TW')} 張卡牌`;
 $('#cardGrid').innerHTML=matched.slice(0,shownCards).map(c=>`<button class="cardtile" data-card="${safe(c.id)}"><div class="coloredge" style="--edge:${cardColor(c)}"></div>${art(c)}<div class="cardmeta"><strong title="${safe(c.name)}">${safe(c.name)}</strong><small>${safe(c.id)} · ${safe(c.cost??c.category)}</small></div></button>`).join('')||'<div class="note">找不到符合條件的卡牌。</div>';
 $('#moreCards').hidden=matched.length<=shownCards;
}
function openCard(id){const c=byId(id);if(!c)return;const isLeader=c.category==='Leader';const details=`<p><strong>卡號：</strong>${safe(c.id)}</p><p><strong>顏色：</strong>${c.colors.map(x=>COLORS[x]?.[0]||safe(x)).join('、')}</p><p><strong>種類：</strong>${safe(c.category)}</p><p><strong>系列：</strong>${safe(packNames[c.pack_id]||c.pack_id)}</p><p><strong>稀有度：</strong>${safe(c.rarity||'—')}</p><p><strong>費用：</strong>${safe(c.cost??'—')}　<strong>力量：</strong>${safe(c.power??'—')}</p><p><strong>反擊：</strong>${safe(c.counter??'—')}</p><p><strong>效果：</strong>${safe(c.effect||'—')}</p>${c.trigger?`<p><strong>觸發：</strong>${safe(c.trigger)}</p>`:''}`;
 $('#dialogBody').innerHTML=`<div class="dialogbody">${art(c)}<div><h2>${safe(c.name)}</h2><div class="colorDots">${dots(c)}</div><div class="details">${details}</div><button class="primary" data-cardact="${isLeader?'leader':'add'}" data-id="${safe(c.id)}">${isLeader?'設為領航員':'加入目前牌組'}</button></div></div>`;$('#cardDialog').showModal();}
function getLeader(){return byId(currentDeck.leaderId);}
function canInclude(c){const leader=getLeader();return !!leader&&c.category!=='Leader'&&c.category!=='Don'&&c.colors.some(x=>leader.colors.includes(x));}
function addCard(id,delta){const c=byId(id);if(!c)return;if(!canInclude(c)){toast('此卡與領航員顏色不符，或尚未選擇領航員');return;}const old=currentDeck.items[id]||0,next=old+delta;if(next<0||next>4||delta>0&&count()>=50)return; if(next===0)delete currentDeck.items[id];else currentDeck.items[id]=next;saveDraft();renderBuilder();}
function chooseLeader(id){const c=byId(id);if(!c||c.category!=='Leader')return;const before=Object.keys(currentDeck.items).length;currentDeck.leaderId=id;for(const x of Object.keys(currentDeck.items))if(!canInclude(byId(x)||{category:'?',colors:[]}))delete currentDeck.items[x];saveDraft();renderBuilder();if(before&&Object.keys(currentDeck.items).length<before)toast('已自動移除顏色不符的卡牌');}
function deckProblems(){const errors=[];const lead=getLeader();if(!lead)errors.push('尚未選擇領航員');if(count()!==50)errors.push(`主牌還需 ${50-count()} 張（標準為 50 張）`);const mismatched=Object.keys(currentDeck.items).filter(x=>!byId(x)||!canInclude(byId(x)));if(mismatched.length)errors.push(`${mismatched.length} 種卡牌不存在或顏色不符`);const rs=rulebook?.rulesets||[];const today=new Date().toISOString().slice(0,10);const matched=rs.find(r=>r.verified===true&&r.region===$('#ruleRegion').value&&r.effectiveFrom<=today&&(!r.effectiveTo||r.effectiveTo>=today));if(matched){for(const id of matched.banned||[])if(currentDeck.items[id])errors.push(`${id}：禁用卡`);for(const [id,max] of Object.entries(matched.restricted||{}))if((currentDeck.items[id]||0)>max)errors.push(`${id}：限制 ${max} 張`);}return errors;}
function renderBuilder(){const leader=getLeader();$('#leaderSelected').textContent=leader?leader.name:'尚未選擇';const lq=$('#leaderSearch').value.trim().toLowerCase();const leaders=cards.filter(c=>c.category==='Leader'&&(!lq||(c.name+' '+c.id).toLowerCase().includes(lq)));$('#leaderPicks').innerHTML=leaders.slice(0,shownLeaders).map(c=>`<button class="leaderpick ${c.id===currentDeck.leaderId?'selected':''}" data-leader="${safe(c.id)}">${cardMini(c,'leaderCardArt')}<span class="colorDots">${dots(c)}</span><strong>${safe(c.name)}</strong><small>${safe(c.id)}</small></button>`).join('')||'<p class="note">沒有符合條件的領航員卡牌。</p>';$('#moreLeaders').hidden=leaders.length<=shownLeaders;
 if(document.activeElement!==$('#deckName'))$('#deckName').value=currentDeck.name||'';
 if(document.activeElement!==$('#buildSearch')){};const q=$('#buildSearch').value.toLowerCase().trim();let eligible=cards.filter(c=>canInclude(c)&&(!q||[c.name,c.id,c.effect].some(x=>String(x||'').toLowerCase().includes(q))));
 $('#buildAvailable').innerHTML=eligible.slice(0,shownBuilder).map(c=>{const n=currentDeck.items[c.id]||0;return `<div class="buildrow">${cardMini(c)}<div><strong>${safe(c.name)}</strong><small>${safe(c.id)} · 費用 ${safe(c.cost??'—')} · ${safe(COLORS[c.colors[0]]?.[0]||'')}</small></div><button class="plus" data-add="${safe(c.id)}" ${n>=4||count()>=50?'disabled':''}>+ ${n?`${n}/4`:'加入'}</button></div>`;}).join('')||'<p class="note">請先選領航員，或調整搜尋條件。</p>';$('#buildMore').hidden=eligible.length<=shownBuilder;
 const total=count();$('#deckCount').textContent=`${total} / 50`;$('#deckProgress').style.width=`${Math.min(100,total*2)}%`;const errs=deckProblems(),w=$('#deckWarning');w.textContent=errs.length?errs.join(' · '):'基本構築規則已通過（未檢查禁限卡或特殊規則）';w.classList.toggle('good',errs.length===0);
 const ids=Object.keys(currentDeck.items).sort((a,b)=>{const x=byId(a),y=byId(b);return (x?.cost??0)-(y?.cost??0)||a.localeCompare(b);});const ent=$('#deckEntries');ent.classList.toggle('empty',ids.length===0);ent.innerHTML=ids.length?ids.map(id=>{const c=byId(id);return `<div class="deckentry">${cardMini(c)}<span class="entrytext">${safe(id)} · ${safe(c?.name||'未知卡牌')}</span><button aria-label="移除一張" data-dec="${safe(id)}">−</button><b>${currentDeck.items[id]}</b><button aria-label="加入一張" data-add="${safe(id)}" ${currentDeck.items[id]>=4||total>=50?'disabled':''}>+</button></div>`;}).join(''):'尚未加入卡牌';
}
function saveDraft(){put('draft',currentDeck).catch(()=>{});}
function draftText(d=currentDeck){return `LEADER: ${d.leaderId||'(not set)'}\n`+Object.entries(d.items||{}).sort().map(([id,n])=>`${n}x ${id}`).join('\n');}
async function saveDeck(){if(!currentDeck.leaderId){toast('請先選領航員');return;}const clone=JSON.parse(JSON.stringify(currentDeck));clone.name=String(clone.name||`牌組 ${new Date().toLocaleDateString('zh-TW')}`).trim();const now=Date.now();clone.id='deck-'+now+'-'+Math.random().toString(36).slice(2,7);clone.savedAt=new Date().toISOString();decks.unshift(clone);try{await put('decks',decks);toast('牌組已儲存，可在「我的牌組」查看');renderHome();}catch(e){decks.shift();toast('儲存失敗：'+e.message);}}
// Reuse a properly sourced, complete tournament deck in the editor; keep provenance locally.
window.importTournamentDeck = function(row){
  const list=row?.cards;
  if(!row?.leaderId||!list||typeof list!=='object')return false;
  const entries=Object.entries(list);
  if(entries.some(([id,n])=>!id||!Number.isInteger(n)||n<1||n>4))return false;
  if(entries.reduce((total,[,n])=>total+n,0)!==50)return false;
  currentDeck={name:`${row.leaderName||row.leaderId} · ${row.event||'賽事'}（研究副本）`.slice(0,60),
               leaderId:row.leaderId, items:Object.fromEntries(entries),
               derivedFrom:{source:row.source||'',url:row.sourceUrl||'',date:row.date||''}};
  saveDraft();nav('builder');
  const missing=entries.filter(([id])=>!byId(id)).length+(byId(row.leaderId)?0:1);
  toast(missing?`已匯入，${missing} 種卡號在目前卡圖鑑找不到；請更新卡表後檢查。`:'已匯入研究副本，請依當期禁限卡規則複核');
  return true;
};

function renderDecks(){const list=$('#myDecks');list.innerHTML=decks.length?decks.map(d=>`<div class="myDeck"><div class="myDeckHeader">${cardMini(byId(d.leaderId))}<div><strong>${safe(d.name||'未命名牌組')}</strong><span>${safe(d.leaderId)} · ${Object.values(d.items||{}).reduce((a,b)=>a+Number(b||0),0)} 張 · ${safe((d.savedAt||'').slice(0,10))}</span></div></div><div class="myDeckButtons"><button data-edit="${safe(d.id)}">編輯副本</button><button data-copy="${safe(d.id)}">複製牌組</button><button class="delete" data-delete="${safe(d.id)}">刪除</button></div></div>`).join(''):'<p class="note">目前尚未儲存任何牌組。請到「組牌工作室」建立第一套牌組。</p>';}
async function persistCards(next,kind){if(next.length===0)throw Error('沒有可用卡牌');cards=next;dataKind=kind;updatedAt=new Date().toISOString();await put('catalogue',{cards,kind,updatedAt});shownCards=72;shownBuilder=50;updateSetFilter();renderHome();if(currentPage==='cards')renderCards();if(currentPage==='builder')renderBuilder();}
function renderData(){$('#syncStatus').textContent=dataKind==='demo'?'目前使用教學示範卡牌（非真實發行卡）。':`已載入 ${cards.length} 張卡牌；更新時間 ${updatedAt.slice(0,19).replace('T',' ')}。`;}
function download(filename,content,type='application/json'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已複製到剪貼簿');}catch{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();toast(ok?'已複製到剪貼簿':'無法複製，請改用備份檔');}}
function parseCardPayload(json){let raw=Array.isArray(json)?json:Array.isArray(json.cards)?json.cards:Array.isArray(json.data)?json.data:null;if(!raw&&json&&typeof json==='object')raw=Object.entries(json).map(([id,val])=>({...val,id:val.id||id}));if(!raw)throw Error('找不到卡牌陣列');const result=[...new Map(raw.map(normalizeCard).filter(Boolean).map(c=>[c.id,c])).values()];if(result.length===0)throw Error('檔案未包含有效卡牌');return result;}
async function fetchJson(url){const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error(`HTTP ${res.status}`);return res.json();}
async function loadPublishedCards(force=false){
  const snapshot=await fetchJson(CARD_SNAPSHOT_URL+'?v='+Date.now());
  packNames=snapshot.sets&&typeof snapshot.sets==='object'&&!Array.isArray(snapshot.sets)?snapshot.sets:packNames;
  updateSetFilter();
  if(!Array.isArray(snapshot?.cards)||snapshot.cards.length<100)throw Error('公開卡表尚未完成首次同步，請先執行 GitHub Actions');
  // Custom/imported card collections remain under the user’s explicit control.
  if(!force&&dataKind==='import')return 'preserved-import';
  if(!force&&dataKind==='sync'&&updatedAt&&snapshot.updatedAt&&updatedAt>=snapshot.updatedAt&&cards.some(c=>c.image))return 'unchanged';
  await persistCards(snapshot.cards.map(normalizeCard).filter(Boolean),'sync');
  if(snapshot.updatedAt)updatedAt=snapshot.updatedAt;
  await put('catalogue',{cards,kind:'sync',updatedAt});
  return 'updated';
}
async function syncCards(){
  const btn=$('#syncBtn'),status=$('#syncStatus');if(btn.disabled)return;
  btn.disabled=true;btn.textContent='讀取中...';
  try{
    status.textContent='正在讀取網站最新發布的卡牌快照...';
    const outcome=await loadPublishedCards(true);
    status.textContent=outcome==='updated'?`已載入 ${cards.length} 張卡牌（不同卡號），快照版本 ${updatedAt.slice(0,10)}。`:'卡牌資料無變化';
    toast('已讀取網站最新卡牌資料');
  }catch(e){status.textContent='卡牌資料未更新：'+e.message+'。原有資料仍保留。';toast('同步失敗，既有卡牌仍保留');}
  finally{btn.disabled=false;btn.textContent='取得最新卡牌圖鑑';loadSyncStatus();}
}
async function loadSyncStatus(){
  const node=$('#automationStatus');if(!node)return;
  try{
    const status=await fetchJson(SYNC_STATUS_URL+'?v='+Date.now());
    const a=status.cardCatalogue||{};
    const label=({'updated':'內容有更新','unchanged':'已檢查、無新增','failed':'檢查失敗','never-run':'尚未首次同步'})[a.state]||'狀態未知';
    const t=status.topDecksSets||{};
    const tLabel=({'updated':'系列列表有更新','unchanged':'已檢查、無變更','failed':'檢查未成功','never-run':'尚未首次同步'})[t.state]||'尚未執行';
    node.textContent=`卡牌索引：${label} · ${a.cardCount||0} 種卡號 · 上次檢查 ${a.checkedAt?new Date(a.checkedAt).toLocaleString('zh-TW'):'尚無'}。TOP DECKS 系列監看：${tLabel} · ${t.seriesCount||0} 項。${a.message||t.message||''}`;
    const sources=status.pipeline?.sources||{};const panel=$('#pipelineHealth');if(panel){const parts=Object.entries(sources).map(([name,v])=>`${name}：${({success:'成功',failed:'失敗',skipped:'略過'})[v.status]||'未知'}`);panel.textContent=parts.length?`最後執行 ${status.pipeline.lastAttempt?.slice(0,19).replace('T',' ')||'未知'} UTC。${parts.join('；')}。`: 'GitHub 尚未執行整合排程。';}
    try{const integrity=await fetchJson('./data/integrity.json?v='+Date.now());$('#integrityStatus').textContent=`結果 ${integrity.publishedResults} 筆、沒有完整牌表 ${integrity.missingFullDecklists} 筆、唯一構築 ${integrity.uniqueDeckFingerprints} 組；資料完整性檢查 ${integrity.checkedAt?.slice(0,10)||'未檢查'}。`;}catch{$('#integrityStatus').textContent='尚無資料完整性驗證快照。';}
  }catch(e){node.textContent='尚無法讀取雲端同步狀態；這不會清除已儲存的卡牌或私人牌組。';}
}


async function cardImport(file){if(!file)return;try{const json=JSON.parse(await file.text());const next=parseCardPayload(json);await persistCards(next,'import');toast(`成功匯入 ${next.length} 張卡牌`);renderData();}catch(e){toast('匯入失敗：'+e.message);}$('#importCards').value='';}
function validDeck(d){return d&&typeof d==='object'&&typeof d.leaderId==='string'&&d.items&&typeof d.items==='object'&&!Array.isArray(d.items);}
async function restoreDecks(file){if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.decks)||!data.decks.every(validDeck))throw Error('不是本網站的合法牌組備份');if(!confirm(`將以備份中的 ${data.decks.length} 套牌組取代目前儲存的 ${decks.length} 套，確定嗎？`))return;decks=data.decks;await put('decks',decks);if(Array.isArray(data.community))localStorage.setItem('grand-community-notes',JSON.stringify(data.community.filter(x=>typeof x?.name==='string'&&/^https:\/\//.test(x.url||'')).slice(0,150)));if(Array.isArray(data.favorites))localStorage.setItem('grand-results-favorites',JSON.stringify(data.favorites.filter(x=>typeof x==='string').slice(0,300)));toast(`已還原 ${decks.length} 套牌組；收藏與社群候選需重新整理頁面顯示`);renderHome();}catch(e){toast('還原失敗：'+e.message);}finally{$('#importBackup').value='';}}
function bindEvents(){
 $$('[data-page]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.page)));$$('[data-go]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.go)));
 ['#cardSearch','#colorFilter','#typeFilter','#setFilter'].forEach(id=>$(id).addEventListener(id==='#cardSearch'?'input':'change',()=>{shownCards=72;renderCards();}));
 $('#moreCards').addEventListener('click',()=>{shownCards+=72;renderCards();});
 $('#cardGrid').addEventListener('click',e=>{const tile=e.target.closest('[data-card]');if(tile)openCard(tile.dataset.card);});
 $('#closeDialog').addEventListener('click',()=>$('#cardDialog').close());
 $('#dialogBody').addEventListener('click',e=>{const b=e.target.closest('[data-cardact]');if(!b)return;$('#cardDialog').close();if(b.dataset.cardact==='leader')chooseLeader(b.dataset.id);else addCard(b.dataset.id,1);nav('builder');});
 $('#leaderPicks').addEventListener('click',e=>{const b=e.target.closest('[data-leader]');if(b)chooseLeader(b.dataset.leader);});
 $('#ruleRegion').addEventListener('change',renderBuilder);
 $('#leaderSearch').addEventListener('input',()=>{shownLeaders=65;renderBuilder();});
 $('#moreLeaders').addEventListener('click',()=>{shownLeaders+=65;renderBuilder();});
 $('#buildSearch').addEventListener('input',()=>{shownBuilder=50;renderBuilder();});
 $('#buildMore').addEventListener('click',()=>{shownBuilder+=50;renderBuilder();});
 $('#buildAvailable').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b)addCard(b.dataset.add,1);});
 $('#deckEntries').addEventListener('click',e=>{const b=e.target.closest('[data-add],[data-dec]');if(!b)return;addCard(b.dataset.add||b.dataset.dec,b.hasAttribute('data-add')?1:-1);});
 $('#deckName').addEventListener('input',e=>{currentDeck.name=e.target.value;saveDraft();});
 $('#clearDeck').addEventListener('click',()=>{if(!confirm('清空目前組牌草稿？已儲存的牌組不受影響。'))return;currentDeck={name:'',leaderId:'',items:{}};$('#buildSearch').value='';saveDraft();renderBuilder();});
 $('#saveDeck').addEventListener('click',saveDeck);$('#copyDeck').addEventListener('click',()=>copy(draftText()));
 $('#myDecks').addEventListener('click',async e=>{const b=e.target.closest('[data-edit],[data-copy],[data-delete]');if(!b)return;const id=b.dataset.edit||b.dataset.copy||b.dataset.delete;const d=decks.find(x=>x.id===id);if(!d)return;
  if(b.dataset.edit){currentDeck={name:d.name+'（副本）',leaderId:d.leaderId,items:{...d.items}};saveDraft();nav('builder');}
  else if(b.dataset.copy)copy(draftText(d));
  else if(b.dataset.delete&&confirm(`確定刪除「${d.name}」？`)){decks=decks.filter(x=>x.id!==id);await put('decks',decks);renderDecks();renderHome();toast('已刪除牌組');}
 });
 $('#refreshHealth').addEventListener('click',loadSyncStatus);$('#syncBtn').addEventListener('click',syncCards);$('#importCards').addEventListener('change',e=>cardImport(e.target.files[0]));
 $('#exportBackup').addEventListener('click',()=>{let community=[],favorites=[];try{community=JSON.parse(localStorage.getItem('grand-community-notes')||'[]');favorites=JSON.parse(localStorage.getItem('grand-results-favorites')||'[]');}catch{} download('grand-decks-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'grand-decks-v2',exportedAt:new Date().toISOString(),decks,community,favorites},null,2));toast('已匯出牌組、收藏與社群候選備份');});
 $('#importBackup').addEventListener('change',e=>restoreDecks(e.target.files[0]));
 $('#demoReset').addEventListener('click',async()=>{if(!confirm('將目前使用的卡牌資料改回教學範例？私人牌組會保留。'))return;await persistCards(demoCards,'demo');renderData();toast('已切換為示範資料');});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#installBtn').hidden=false;});$('#installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#installBtn').hidden=true;});
}
async function init(){bindEvents();try{const saved=await get('catalogue');if(saved?.cards?.length){cards=saved.cards;dataKind=saved.kind||'import';updatedAt=saved.updatedAt||'';}decks=(await get('decks'))||[];const draft=await get('draft');if(validDeck(draft))currentDeck=draft;}catch(e){console.warn('IndexedDB unavailable:',e);toast('裝置儲存功能可能不可用，請勿依賴本機備份');}
 updateSetFilter();renderHome();renderData();nav('home');
 loadPublishedCards().then(outcome=>{if(outcome==='updated'){renderData();renderHome();if(currentPage==='cards')renderCards();if(currentPage==='results'||currentPage==='meta')window.renderResults?.(currentPage);}}).catch(e=>console.info('Using saved or demo catalogue:',e.message));
 loadSyncStatus();
 fetchJson('./data/rules.json?v='+Date.now()).then(r=>{if(r?.rulesets&&Array.isArray(r.rulesets)){rulebook=r;$('#ruleWarning').textContent=r.rulesets.some(x=>x.verified)?'存在已核對的規則版本，請仍依實際賽區與賽期複核。':'目前沒有已核實的禁限卡版本；只檢查標準 50 張、顏色和四張上限。';}}).catch(()=>{});
 if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
init();
