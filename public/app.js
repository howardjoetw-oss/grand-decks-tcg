/* GRAND DECKS: Original, zero-dependency PWA front-end. No paid API keys. */
'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const COLORS = {Red:['紅','#db6b6b'],Green:['綠','#79b38e'],Blue:['藍','#74a8df'],Purple:['紫','#ad8bdc'],Black:['黑','#8a94a9'],Yellow:['黃','#e3c173']};
const COLOR_MAP = {red:'Red',green:'Green',blue:'Blue',purple:'Purple',black:'Black',yellow:'Yellow',紅:'Red',綠:'Green',蓝:'Blue',藍:'Blue',紫:'Purple',黑:'Black',黃:'Yellow',黄:'Yellow'};
const TYPE_MAP={leader:'Leader',character:'Character',event:'Event',stage:'Stage',don:'Don',領航員:'Leader',領袖:'Leader',角色:'Character',事件:'Event',場景:'Stage'};
const DATA_URL = 'https://raw.githubusercontent.com/Kuroro1990/OPTCG/main/chinese-taiwan';
const DEMO_PEOPLE=['航行者','劍士','航海士','狙擊手','醫者','船匠','考古學者','音樂家','舵手','守衛者','探險家','船長','夥伴','戰略家','航路師'];
const demoCards=(()=>{
  const a=[];
  for(let i=1;i<=6;i++){const cols=Object.keys(COLORS);a.push({id:`DEMO-L${String(i).padStart(2,'0')}`,name:`示範領航員 ${COLORS[cols[i-1]][0]}`,colors:[cols[i-1]],category:'Leader',cost:null,power:5000,rarity:'Leader',pack_id:'DEMO',effect:'此為虛構測試資料，請同步正式卡池。',image:'',demo:true});}
  for(let i=1;i<=90;i++){const cols=Object.keys(COLORS);const color=cols[(i-1)%6];const type=i%9===0?'Event':i%13===0?'Stage':'Character';a.push({id:`DEMO-${String(i).padStart(3,'0')}`,name:`示範${DEMO_PEOPLE[i%DEMO_PEOPLE.length]} ${String(i).padStart(2,'0')}`,colors:[color],category:type,cost:(i%9)+1,power:type==='Character'?1000+((i*3)%9)*1000:null,counter:type==='Character'&&i%3!==0?1000:0,rarity:i%7===0?'Rare':'Common',pack_id:'DEMO',effect:'此卡牌僅用於展示畫面及測試組牌；並非真實發行卡。',image:'',demo:true});}
  return a;
})();
let cards=demoCards, dataKind='demo', updatedAt='', decks=[], currentDeck={name:'',leaderId:'',items:{}}, shownCards=72, shownBuilder=50, currentPage='home', toastTimer, deferredInstall=null;
function safe(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function normalizeColors(value){const v=Array.isArray(value)?value:String(value||'').split(/[,/、， ]+/);return [...new Set(v.map(x=>COLOR_MAP[String(x).trim().toLowerCase()]||COLOR_MAP[String(x).trim()]||'').filter(Boolean))];}
function normCat(c){return TYPE_MAP[String(c||'').toLowerCase()]||TYPE_MAP[c]||'Character';}
function numberOrNull(x){if(x===null||x===undefined||x==='')return null;const n=Number(x);return Number.isFinite(n)?n:null;}
function normalizeCard(raw){
  if(!raw||typeof raw!=='object')return null;
  const id=String(raw.id||raw.card_id||raw.card_number||raw.code||'').trim();if(!id)return null;
  return {id,name:String(raw.name||raw.card_name||id),category:normCat(raw.category||raw.type||raw.card_type),colors:normalizeColors(raw.colors||raw.color),cost:numberOrNull(raw.cost),power:numberOrNull(raw.power),counter:numberOrNull(raw.counter),rarity:String(raw.rarity||''),pack_id:String(raw.pack_id||raw.set||id.split('-')[0]),effect:String(raw.effect||raw.text||''),trigger:String(raw.trigger||''),image:String(raw.img_full_url||raw.image_url||raw.image||'').trim(),demo:false};
}
function dbOpen(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('此瀏覽器不支援 IndexedDB'));const r=indexedDB.open('grand-decks-store',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function kv(action,key,value){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('kv',action==='get'?'readonly':'readwrite');const req=tx.objectStore('kv')[action](...(action==='get'?[key]:[value,key]));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onerror=()=>db.close();});}
const get=key=>kv('get',key);const put=(key,val)=>kv('put',key,val);
const count=()=>Object.values(currentDeck.items||{}).reduce((a,b)=>a+Number(b||0),0);
const byId=id=>cards.find(c=>c.id===id);
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}
function nav(page){if(!$('#page-'+page))return;currentPage=page;$$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));window.scrollTo({top:0,behavior:'instant'});if(page==='home')renderHome();if(page==='cards')renderCards();if(page==='builder')renderBuilder();if(page==='decks')renderDecks();if(page==='data')renderData();if(page==='results'||page==='meta')window.renderResults?.(page);}
function cardColor(card){const c=card.colors?.[0];return COLORS[c]?.[1]||'#b9a47b';}
function dots(card){return (card.colors||[]).map(c=>`<span class="dot" title="${COLORS[c]?.[0]||safe(c)}" style="background:${COLORS[c]?.[1]||'#9aa'}"></span>`).join('');}
function art(card){const name=safe(card.name);const img=card.image&&/^https:\/\//i.test(card.image)?`<img src="${safe(card.image)}" alt="${name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:'';return `<div class="cardart"><span class="artText">${safe(card.demo?'DEMO':card.id)}</span>${img}</div>`;}
function renderHome(){$('#metricCards').textContent=cards.length.toLocaleString('zh-TW');$('#metricDecks').textContent=decks.length;$('#metricStatus').textContent=dataKind==='demo'?'DEMO':dataKind==='sync'?'SYNC':'CUSTOM';$('#metricUpdate').textContent=dataKind==='demo'?'示範資料':updatedAt?`更新 ${updatedAt.slice(0,10)}`:'自訂資料';$('#dataBadge').textContent=dataKind==='demo'?'示範資料':dataKind==='sync'?'繁中卡池':'自訂卡池';}
function updateSetFilter(){const e=$('#setFilter'),prev=e.value;const all=[...new Set(cards.map(c=>c.pack_id).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));e.innerHTML='<option value="">全部系列</option>'+all.map(s=>`<option value="${safe(s)}">${safe(s)}</option>`).join('');if(all.includes(prev))e.value=prev;}
function cardMatches(c){const q=$('#cardSearch').value.trim().toLowerCase();const color=$('#colorFilter').value,type=$('#typeFilter').value,set=$('#setFilter').value;return(!q||[c.name,c.id,c.effect,c.pack_id].some(v=>String(v||'').toLowerCase().includes(q)))&&(!color||c.colors.includes(color))&&(!type||c.category===type)&&(!set||c.pack_id===set);}
function renderCards(){const matched=cards.filter(cardMatches);$('#cardCount').textContent=`${matched.length.toLocaleString('zh-TW')} 張卡牌`;
 $('#cardGrid').innerHTML=matched.slice(0,shownCards).map(c=>`<button class="cardtile" data-card="${safe(c.id)}"><div class="coloredge" style="--edge:${cardColor(c)}"></div>${art(c)}<div class="cardmeta"><strong title="${safe(c.name)}">${safe(c.name)}</strong><small>${safe(c.id)} · ${safe(c.cost??c.category)}</small></div></button>`).join('')||'<div class="note">找不到符合條件的卡牌。</div>';
 $('#moreCards').hidden=matched.length<=shownCards;
}
function openCard(id){const c=byId(id);if(!c)return;const isLeader=c.category==='Leader';const details=`<p><strong>卡號：</strong>${safe(c.id)}</p><p><strong>顏色：</strong>${c.colors.map(x=>COLORS[x]?.[0]||safe(x)).join('、')}</p><p><strong>種類：</strong>${safe(c.category)}</p><p><strong>系列：</strong>${safe(c.pack_id)}</p><p><strong>稀有度：</strong>${safe(c.rarity||'—')}</p><p><strong>費用：</strong>${safe(c.cost??'—')}　<strong>力量：</strong>${safe(c.power??'—')}</p><p><strong>反擊：</strong>${safe(c.counter??'—')}</p><p><strong>效果：</strong>${safe(c.effect||'—')}</p>${c.trigger?`<p><strong>觸發：</strong>${safe(c.trigger)}</p>`:''}`;
 $('#dialogBody').innerHTML=`<div class="dialogbody">${art(c)}<div><h2>${safe(c.name)}</h2><div class="colorDots">${dots(c)}</div><div class="details">${details}</div><button class="primary" data-cardact="${isLeader?'leader':'add'}" data-id="${safe(c.id)}">${isLeader?'設為領航員':'加入目前牌組'}</button></div></div>`;$('#cardDialog').showModal();}
function getLeader(){return byId(currentDeck.leaderId);}
function canInclude(c){const leader=getLeader();return !!leader&&c.category!=='Leader'&&c.category!=='Don'&&c.colors.some(x=>leader.colors.includes(x));}
function addCard(id,delta){const c=byId(id);if(!c)return;if(!canInclude(c)){toast('此卡與領航員顏色不符，或尚未選擇領航員');return;}const old=currentDeck.items[id]||0,next=old+delta;if(next<0||next>4||delta>0&&count()>=50)return; if(next===0)delete currentDeck.items[id];else currentDeck.items[id]=next;saveDraft();renderBuilder();}
function chooseLeader(id){const c=byId(id);if(!c||c.category!=='Leader')return;const before=Object.keys(currentDeck.items).length;currentDeck.leaderId=id;for(const x of Object.keys(currentDeck.items))if(!canInclude(byId(x)||{category:'?',colors:[]}))delete currentDeck.items[x];saveDraft();renderBuilder();if(before&&Object.keys(currentDeck.items).length<before)toast('已自動移除顏色不符的卡牌');}
function deckProblems(){const errors=[];const lead=getLeader();if(!lead)errors.push('尚未選擇領航員');if(count()!==50)errors.push(`主牌還需 ${50-count()} 張（標準為 50 張）`);const mismatched=Object.keys(currentDeck.items).filter(x=>!byId(x)||!canInclude(byId(x)));if(mismatched.length)errors.push(`${mismatched.length} 種卡牌不存在或顏色不符`);return errors;}
function renderBuilder(){const leader=getLeader();$('#leaderSelected').textContent=leader?leader.name:'尚未選擇';const leaders=cards.filter(c=>c.category==='Leader');$('#leaderPicks').innerHTML=leaders.slice(0,80).map(c=>`<button class="leaderpick ${c.id===currentDeck.leaderId?'selected':''}" data-leader="${safe(c.id)}"><span class="colorDots">${dots(c)}</span><strong>${safe(c.name)}</strong><small>${safe(c.id)}</small></button>`).join('')||'<p class="note">目前資料沒有領航員卡牌。</p>';
 if(document.activeElement!==$('#deckName'))$('#deckName').value=currentDeck.name||'';
 if(document.activeElement!==$('#buildSearch')){};const q=$('#buildSearch').value.toLowerCase().trim();let eligible=cards.filter(c=>canInclude(c)&&(!q||[c.name,c.id,c.effect].some(x=>String(x||'').toLowerCase().includes(q))));
 $('#buildAvailable').innerHTML=eligible.slice(0,shownBuilder).map(c=>{const n=currentDeck.items[c.id]||0;return `<div class="buildrow"><div><strong>${safe(c.name)}</strong><small>${safe(c.id)} · 費用 ${safe(c.cost??'—')} · ${safe(COLORS[c.colors[0]]?.[0]||'')}</small></div><button class="plus" data-add="${safe(c.id)}" ${n>=4||count()>=50?'disabled':''}>+ ${n?`${n}/4`:'加入'}</button></div>`;}).join('')||'<p class="note">請先選領航員，或調整搜尋條件。</p>';$('#buildMore').hidden=eligible.length<=shownBuilder;
 const total=count();$('#deckCount').textContent=`${total} / 50`;$('#deckProgress').style.width=`${Math.min(100,total*2)}%`;const errs=deckProblems(),w=$('#deckWarning');w.textContent=errs.length?errs.join(' · '):'基本構築規則已通過（未檢查禁限卡或特殊規則）';w.classList.toggle('good',errs.length===0);
 const ids=Object.keys(currentDeck.items).sort((a,b)=>{const x=byId(a),y=byId(b);return (x?.cost??0)-(y?.cost??0)||a.localeCompare(b);});const ent=$('#deckEntries');ent.classList.toggle('empty',ids.length===0);ent.innerHTML=ids.length?ids.map(id=>{const c=byId(id);return `<div class="deckentry"><span class="entrytext">${safe(id)} · ${safe(c?.name||'未知卡牌')}</span><button aria-label="移除一張" data-dec="${safe(id)}">−</button><b>${currentDeck.items[id]}</b><button aria-label="加入一張" data-add="${safe(id)}" ${currentDeck.items[id]>=4||total>=50?'disabled':''}>+</button></div>`;}).join(''):'尚未加入卡牌';
}
function saveDraft(){put('draft',currentDeck).catch(()=>{});}
function draftText(d=currentDeck){return `LEADER: ${d.leaderId||'(not set)'}\n`+Object.entries(d.items||{}).sort().map(([id,n])=>`${n}x ${id}`).join('\n');}
async function saveDeck(){if(!currentDeck.leaderId){toast('請先選領航員');return;}const clone=JSON.parse(JSON.stringify(currentDeck));clone.name=String(clone.name||`牌組 ${new Date().toLocaleDateString('zh-TW')}`).trim();const now=Date.now();clone.id='deck-'+now+'-'+Math.random().toString(36).slice(2,7);clone.savedAt=new Date().toISOString();decks.unshift(clone);try{await put('decks',decks);toast('牌組已儲存，可在「我的牌組」查看');renderHome();}catch(e){decks.shift();toast('儲存失敗：'+e.message);}}
function renderDecks(){const list=$('#myDecks');list.innerHTML=decks.length?decks.map(d=>`<div class="myDeck"><div><strong>${safe(d.name||'未命名牌組')}</strong><span>${safe(d.leaderId)} · ${Object.values(d.items||{}).reduce((a,b)=>a+Number(b||0),0)} 張 · ${safe((d.savedAt||'').slice(0,10))}</span></div><div class="myDeckButtons"><button data-edit="${safe(d.id)}">編輯副本</button><button data-copy="${safe(d.id)}">複製牌組</button><button class="delete" data-delete="${safe(d.id)}">刪除</button></div></div>`).join(''):'<p class="note">目前尚未儲存任何牌組。請到「組牌工作室」建立第一套牌組。</p>';}
async function persistCards(next,kind){if(next.length===0)throw Error('沒有可用卡牌');cards=next;dataKind=kind;updatedAt=new Date().toISOString();await put('catalogue',{cards,kind,updatedAt});shownCards=72;shownBuilder=50;updateSetFilter();renderHome();if(currentPage==='cards')renderCards();if(currentPage==='builder')renderBuilder();}
function renderData(){$('#syncStatus').textContent=dataKind==='demo'?'目前使用教學示範卡牌（非真實發行卡）。':`已載入 ${cards.length} 張卡牌；更新時間 ${updatedAt.slice(0,19).replace('T',' ')}。`;}
function download(filename,content,type='application/json'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已複製到剪貼簿');}catch{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();toast(ok?'已複製到剪貼簿':'無法複製，請改用備份檔');}}
function parseCardPayload(json){let raw=Array.isArray(json)?json:Array.isArray(json.cards)?json.cards:Array.isArray(json.data)?json.data:null;if(!raw&&json&&typeof json==='object')raw=Object.entries(json).map(([id,val])=>({...val,id:val.id||id}));if(!raw)throw Error('找不到卡牌陣列');const result=[...new Map(raw.map(normalizeCard).filter(Boolean).map(c=>[c.id,c])).values()];if(result.length===0)throw Error('檔案未包含有效卡牌');return result;}
async function fetchJson(url){const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error(`HTTP ${res.status}`);return res.json();}
async function syncCards(){const btn=$('#syncBtn'),status=$('#syncStatus');if(btn.disabled)return;btn.disabled=true;btn.textContent='同步中...';let good=[],fail=0;
 try{status.textContent='取得卡包清單...';const packs=await fetchJson(`${DATA_URL}/packs.json`);if(!Array.isArray(packs)||packs.length===0)throw Error('無法解讀資料集卡包清單');const items=packs.map(x=>typeof x==='string'?x:x?.id).filter(Boolean);if(items.length===0)throw Error('沒有可讀取的卡包 ID');let cursor=0,done=0;const workers=Array.from({length:Math.min(5,items.length)},async()=>{while(cursor<items.length){const id=items[cursor++];try{const data=await fetchJson(`${DATA_URL}/cards/${encodeURIComponent(id)}.json`);const arr=Array.isArray(data)?data:Array.isArray(data.cards)?data.cards:[];for(const c of arr){const n=normalizeCard(c);if(n)good.push(n);}}catch{fail++}done++;if(done%3===0||done===items.length)status.textContent=`同步中 ${done}/${items.length} 包 · ${good.length} 張紀錄 · ${fail} 包失敗`;}});await Promise.all(workers);
 const unique=[...new Map(good.map(c=>[c.id,c])).values()];if(unique.length<50)throw Error(`僅讀取 ${unique.length} 張卡，未覆蓋既有資料。來源可能暫時不可用。`);await persistCards(unique,'sync');status.textContent=`同步完成：${unique.length} 種卡號；${fail} 個卡包讀取失敗。卡圖連線狀況以官方來源為準。`;toast(`繁中卡池已同步 ${unique.length} 張`);
 }catch(e){status.textContent='同步未完成：'+e.message+'。你可用「匯入 JSON」方式補充資料。';toast('同步失敗，既有卡牌仍保留');}finally{btn.disabled=false;btn.textContent='同步卡牌資料';}}
async function cardImport(file){if(!file)return;try{const json=JSON.parse(await file.text());const next=parseCardPayload(json);await persistCards(next,'import');toast(`成功匯入 ${next.length} 張卡牌`);renderData();}catch(e){toast('匯入失敗：'+e.message);}$('#importCards').value='';}
function validDeck(d){return d&&typeof d==='object'&&typeof d.leaderId==='string'&&d.items&&typeof d.items==='object'&&!Array.isArray(d.items);}
async function restoreDecks(file){if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.decks)||!data.decks.every(validDeck))throw Error('不是本網站的合法牌組備份');if(!confirm(`將以備份中的 ${data.decks.length} 套牌組取代目前儲存的 ${decks.length} 套，確定嗎？`))return;decks=data.decks;await put('decks',decks);toast(`已還原 ${decks.length} 套牌組`);renderHome();}catch(e){toast('還原失敗：'+e.message);}finally{$('#importBackup').value='';}}
function bindEvents(){
 $$('[data-page]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.page)));$$('[data-go]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.go)));
 ['#cardSearch','#colorFilter','#typeFilter','#setFilter'].forEach(id=>$(id).addEventListener(id==='#cardSearch'?'input':'change',()=>{shownCards=72;renderCards();}));
 $('#moreCards').addEventListener('click',()=>{shownCards+=72;renderCards();});
 $('#cardGrid').addEventListener('click',e=>{const tile=e.target.closest('[data-card]');if(tile)openCard(tile.dataset.card);});
 $('#closeDialog').addEventListener('click',()=>$('#cardDialog').close());
 $('#dialogBody').addEventListener('click',e=>{const b=e.target.closest('[data-cardact]');if(!b)return;$('#cardDialog').close();if(b.dataset.cardact==='leader')chooseLeader(b.dataset.id);else addCard(b.dataset.id,1);nav('builder');});
 $('#leaderPicks').addEventListener('click',e=>{const b=e.target.closest('[data-leader]');if(b)chooseLeader(b.dataset.leader);});
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
 $('#syncBtn').addEventListener('click',syncCards);$('#importCards').addEventListener('change',e=>cardImport(e.target.files[0]));
 $('#exportBackup').addEventListener('click',()=>{download('grand-decks-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'grand-decks-v1',exportedAt:new Date().toISOString(),decks},null,2));toast('已匯出牌組備份');});
 $('#importBackup').addEventListener('change',e=>restoreDecks(e.target.files[0]));
 $('#demoReset').addEventListener('click',async()=>{if(!confirm('將目前使用的卡牌資料改回教學範例？私人牌組會保留。'))return;await persistCards(demoCards,'demo');renderData();toast('已切換為示範資料');});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#installBtn').hidden=false;});$('#installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#installBtn').hidden=true;});
}
async function init(){bindEvents();try{const saved=await get('catalogue');if(saved?.cards?.length){cards=saved.cards;dataKind=saved.kind||'import';updatedAt=saved.updatedAt||'';}decks=(await get('decks'))||[];const draft=await get('draft');if(validDeck(draft))currentDeck=draft;}catch(e){console.warn('IndexedDB unavailable:',e);toast('裝置儲存功能可能不可用，請勿依賴本機備份');}
 updateSetFilter();renderHome();renderData();nav('home');if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
init();
