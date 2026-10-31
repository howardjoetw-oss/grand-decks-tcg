/* Read-only tournament results + local community leads. No direct paid API calls. */
(() => {
  const countryGroups={JP:'JP',TW:'TW',HK:'ASIA',CN:'ASIA',KR:'ASIA',SG:'ASIA',MY:'ASIA',TH:'ASIA',PH:'ASIA',ID:'ASIA',AU:'OTHER',NZ:'OTHER',US:'NA',CA:'NA',MX:'NA',GB:'EU',DE:'EU',FR:'EU',ES:'EU',IT:'EU',PL:'EU',NL:'EU',BE:'EU',BR:'OTHER'};
  const regionNames={JP:'日本',TW:'台灣',ASIA:'亞洲',EU:'歐洲',NA:'北美',OTHER:'其他'};
  let results=[], loadedAt=null, notes=[];
  const el=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validUrl=u=>{try{const x=new URL(String(u));return x.protocol==='https:'?x.href:''}catch{return ''}};
  const pct=(a,b)=>b?(100*a/b).toFixed(1)+'%':'—';
  const region=x=>countryGroups[String(x||'').toUpperCase()]||'OTHER';
  async function load(force=false){
    if(!force&&results.length)return;
    const status=el('resultsStatus');status.textContent='正在載入已發布的牌組快照…';
    try{
      const res=await fetch('./data/decks.json'+(force?'?refresh='+Date.now():''),{cache:'no-store'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const obj=await res.json();if(!Array.isArray(obj.decks))throw Error('資料格式錯誤');
      const seen=new Set();results=obj.decks.filter(x=>x&&typeof x==='object'&&x.id&&!seen.has(x.id)&&seen.add(x.id));
      loadedAt=obj.updatedAt;
      status.textContent=`已載入 ${results.length} 套牌組 · ${loadedAt?'最近資料更新 '+new Date(loadedAt).toLocaleString('zh-TW'):'內建來源核對樣本（非即時抓取）'} · 自動更新須啟用 GitHub Actions`;
    }catch(e){status.textContent='目前無法讀取同步資料：'+e.message+'。請檢查網站是否完整上傳 data/decks.json，或稍後再試。';}
    renderResults();renderMeta();
  }
  function filtered(){const q=el('resultsSearch').value.trim().toLowerCase(),place=el('resultsCountry').value,src=el('resultsSource').value,max=Number(el('resultsRank').value||999);
    return results.filter(x=>
      (!q||[x.leaderId,x.leaderName,x.player,x.event,x.country].some(v=>String(v||'').toLowerCase().includes(q)))&&
      (!place||(place===x.country||place===region(x.country)))&&
      (!src||x.source===src)&&(!x.placing||x.placing<=max)
    ).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(a.placing||999)-(b.placing||999));
  }
  function rowsToText(x){const rows=Object.entries(x.cards||{}).sort((a,b)=>a[0].localeCompare(b[0]));return ['LEADER: '+x.leaderId,...rows.map(([id,n])=>n+'x '+id)].join('\n');}
  function renderResults(){
    el('rCount').textContent=results.length.toLocaleString();el('rLeaders').textContent=new Set(results.map(x=>x.leaderId).filter(Boolean)).size;
    el('rSources').textContent=new Set(results.map(x=>x.source)).size;
    const selected=filtered();el('resultsCountText').textContent=selected.length+' 套結果';
    el('resultsGrid').innerHTML=selected.length?selected.slice(0,150).map((x,i)=>{
      const url=validUrl(x.sourceUrl),full=Object.values(x.cards||{}).reduce((a,v)=>a+Number(v||0),0)===50;
      const verified=x.sourceType==='platform_result';
      const wr=x.wins!==null&&x.wins!==undefined&&x.losses!==null&&x.losses!==undefined&&x.wins+x.losses>0?pct(x.wins,x.wins+x.losses):'未公開';
      const cards=Object.entries(x.cards||{}).sort((a,b)=>a[0].localeCompare(b[0]));
      return `<article class="resultCard"><div class="resultTop"><span class="resultRank">${x.placing?'TOP '+esc(x.placing):'待核對'}</span><span class="statusPill ${verified?'':'unverified'}">${verified?'賽事平台':'來源網站報告'}</span></div><h3>${esc(x.leaderName||x.leaderId)}</h3><div class="resultTags"><span class="resultTag">${esc(x.leaderId)}</span><span class="resultTag">${esc(x.country||'未知地區')}</span><span class="resultTag">${esc(x.date||'日期未公開')}</span></div><p><strong>${esc(x.player||'未公開玩家')}</strong> · ${esc(x.event)}</p><p>參賽 ${x.players==null?'未公開':esc(x.players)+' 人'}　｜　戰績 ${x.wins==null||x.losses==null?'未公開':esc(x.wins)+' 勝 '+esc(x.losses)+' 敗'}　｜　個人場次勝率 ${wr}</p><div class="resultActions">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">查看原始來源 ↗</a>`:''}<button data-copy-result="${esc(x.id)}" ${full?'':'disabled title="來源未提供完整50張清單"'}>複製 50 張牌組</button></div><details class="resultDetails"><summary>來源與牌組資料${full?' · 完整清單':' · 目前無完整清單'}</summary><p>${esc(x.evidence||'請點擊原始來源核對。')}</p>${cards.length?`<div class="cardsRows">${cards.map(([id,n])=>`<div>${esc(n)} × ${esc(id)}</div>`).join('')}</div>`:'<p>來源摘要沒有取得可安全匯入的完整牌組。請先查看原始來源，避免誤以為已解析完成。</p>'}</details></article>`;
    }).join(''):'<div class="panel"><p>查無符合條件的賽事牌組。可調整地區、日期或來源；若尚未啟用排程，請先查看內建來源樣本。</p></div>';
  }
  function renderMeta(){
    const valid=results.filter(x=>x.leaderId&&Number(x.placing)>=1&&Number(x.placing)<=8);
    const grouped=new Map();for(const x of valid){const v=grouped.get(x.leaderId)||{id:x.leaderId,name:x.leaderName||x.leaderId,n:0,first:0,recorded:0,wins:0,losses:0};v.n++;if(x.placing===1)v.first++;if(Number.isInteger(x.wins)&&Number.isInteger(x.losses)){v.recorded++;v.wins+=x.wins;v.losses+=x.losses}grouped.set(x.leaderId,v)}
    const list=[...grouped.values()].sort((a,b)=>b.n-a.n||b.first-a.first).slice(0,20);
    el('metaStatus').textContent=`目前統計 ${valid.length} 套已收錄前八名牌組、${grouped.size} 種領航員。排序依本站收錄數量，不是全體選手勝率排名。`;
    el('metaList').innerHTML=list.map((x,i)=>`<div class="metaRow"><strong>#${i+1}</strong><div><b>${esc(x.name)}</b> <span>${esc(x.id)} · ${x.first} 次第一名 · ${x.n} 次前八</span><div class="metaBar"><div style="width:${100*x.n/valid.length}%"></div></div><small class="note">有完整個人戰績的上位牌組 ${x.recorded}/${x.n} · 其選手合計 ${x.wins}-${x.losses}（非整體領航員勝率）</small></div><strong>${pct(x.n,valid.length)}</strong></div>`).join('')||'<p class="note">尚無賽事紀錄。</p>';
  }
  function loadNotes(){try{notes=JSON.parse(localStorage.getItem('grand-community-notes')||'[]');if(!Array.isArray(notes))notes=[];}catch{notes=[]}renderNotes()}
  function renderNotes(){el('communityNotes').innerHTML=notes.length?notes.map((n,i)=>`<div class="socialEntry"><span>${esc(n.name)}　<a href="${esc(validUrl(n.url))}" target="_blank" rel="noopener noreferrer">來源 ↗</a><br><small>待核實 · ${esc(n.date)}</small></span><button data-del-note="${i}" aria-label="移除候選">移除</button></div>`).join(''):'尚未新增社群候選牌組。';}
  function onAddNote(){const name=el('communityLeader').value.trim(),url=validUrl(el('communityLink').value.trim());if(!name||!url){toast('請輸入牌組名稱及有效 HTTPS 來源網址');return;}notes.unshift({name:name.slice(0,100),url,date:new Date().toISOString().slice(0,10)});notes=notes.slice(0,100);try{localStorage.setItem('grand-community-notes',JSON.stringify(notes))}catch{toast('本機儲存空間不足');return;}el('communityLeader').value='';el('communityLink').value='';renderNotes();toast('已存入本機待核實清單');}
  el('refreshResults').addEventListener('click',()=>load(true));
  ['resultsSearch','resultsCountry','resultsSource','resultsRank'].forEach(id=>el(id).addEventListener(id==='resultsSearch'?'input':'change',renderResults));
  el('resultsGrid').addEventListener('click',e=>{const b=e.target.closest('[data-copy-result]');if(!b)return;const row=results.find(x=>x.id===b.dataset.copyResult);if(row)copy(rowsToText(row));});
  el('saveCommunity').addEventListener('click',onAddNote);
  el('communityNotes').addEventListener('click',e=>{const b=e.target.closest('[data-del-note]');if(!b)return;notes.splice(Number(b.dataset.delNote),1);localStorage.setItem('grand-community-notes',JSON.stringify(notes));renderNotes();});
  window.renderResults=(page)=>{if(!results.length)load();else if(page==='meta')renderMeta();else renderResults();};
  loadNotes();load();
})();
