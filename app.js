// Bellagio Inventory App (white background, mobile-friendly)
// Core state
const state = {
  sessionId: "",
  slabs: [],
  masterCount: 0,
  statusMap: new Map(),
  rowIndex: [],
  deferredPrompt: null
};

function makeSessionId(){ const d=new Date(),p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-bellagio`; }
function splitCSVLine(l){ const o=[]; let c="",q=false; for(let i=0;i<l.length;i++){ const ch=l[i]; if(ch=='"'){ if(q&&l[i+1]=='"'){c+='"';i++;} else q=!q; } else if(ch==','&&!q){ o.push(c); c=""; } else c+=ch; } o.push(c); return o; }
function parseCSV(t){ const L=t.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").filter(Boolean); const H=splitCSVLine(L[0]); const R=[]; for(let i=1;i<L.length;i++){ const row=splitCSVLine(L[i]); const o={}; H.forEach((h,idx)=>o[h]=(row[idx]??"").trim()); o._rowid = `csv:${i}`; o.source = "master"; R.push(o);} return R; }
async function loadCSV(path){ const r=await fetch(path,{cache:'no-store'}); return parseCSV(await r.text()); }
function makeRowKey(slab){ return slab._rowid; }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1500); }

function buildIndex(slabs){
  const prev = new Map(state.statusMap);
  state.rowIndex = slabs.map((s)=>({ key: makeRowKey(s), combined_id: s.combined_id||"", material_name: s.material_name||"", size_mm: s.size_mm||"", thickness_mm: s.thickness_mm||"", source: s.source||"master", slab: s }));
  state.statusMap = new Map();
  for(const r of state.rowIndex){
    state.statusMap.set(r.key, prev.get(r.key) || (r.source==='master' ? 'Untouched' : 'Available'));
  }
  renderCounters();
  // ADD THIS:
  if (typeof rebuildListsFromStatus === 'function') rebuildListsFromStatus();
}

function renderCounters(){
  let available = 0;
  for(const v of state.statusMap.values()){ if(v==='Available') available++; }
  const used = Math.max(0, state.masterCount - countAvailableFromMaster());
  document.getElementById('count-total').textContent = `Total slabs: ${state.masterCount}`;
  document.getElementById('count-available').textContent = `Slabs available: ${available}`;
  document.getElementById('count-used').textContent = `Slabs used: ${used}`;
}
function countAvailableFromMaster(){ let a=0; for(const r of state.rowIndex){ if(r.source==='master' && state.statusMap.get(r.key)==='Available') a++; } return a; }

function searchRows(q){ const s=(q||"").trim().toLowerCase(); if(!s) return []; const isId=/[0-9]+(\/?[0-9]+)?$/.test(s); return state.rowIndex.filter(r=> isId ? r.combined_id.toLowerCase().includes(s) : r.material_name.toLowerCase().includes(s)).slice(0,100); }
function resultRow(row){ const d=document.createElement('div'); d.className='result'; const i=document.createElement('div'); i.className='info'; const n=document.createElement('div'); n.className='name'; n.textContent=row.material_name||'—'; const m=document.createElement('div'); m.className='meta'; m.textContent=`${row.combined_id||'—'} • ${row.size_mm||'?'} • ${row.thickness_mm||'?'}mm${row.source==='manual'?' • manual':''}`; i.appendChild(n); i.appendChild(m); const b=document.createElement('button'); b.textContent='Mark Available'; const status = state.statusMap.get(row.key); if(status==='Available'){ d.classList.add('available'); b.disabled=true; b.textContent='✓ Available'; } b.addEventListener('click',()=>markAvailable(row.key)); d.appendChild(i); d.appendChild(b); return d; }
function renderSearchResults(rows){ const c=document.getElementById('results'); c.innerHTML=''; rows.forEach(r=> c.appendChild(resultRow(r))); }

function addToList(listId,key,type){ const r=state.rowIndex.find(x=>x.key===key); const ul=document.getElementById(listId); if(ul.querySelector(`[data-key="${CSS.escape(key)}"]`)) return; const li=document.createElement('li'); li.dataset.key=key; li.innerHTML=`<span><strong>${r.material_name||'—'}</strong> <span class="badge ${type}">${r.combined_id}</span> <span class="badge">${r.size_mm||'?'} • ${r.thickness_mm||'?'}mm</span> ${r.source==='manual'?'<span class="badge">manual</span>':''}</span><span>${type==='available'?'<button class="ghost" data-action="used">Mark Used</button>':'<button class="ghost" data-action="available">Mark Available</button>'} <button class="ghost" data-action="remove">Un-tick</button></span>`; ul.appendChild(li); li.querySelectorAll('button').forEach(b=> b.addEventListener('click',()=>{ const a=b.dataset.action; if(a==='remove'){ li.remove(); state.statusMap.set(key,'Untouched'); renderCounters(); refreshReview(); return; } if(a==='used'){ markUsed(key); refreshReview(); } if(a==='available'){ markAvailable(key); refreshReview(); } })); }
function removeFromList(listId,key){ const ul=document.getElementById(listId); const el=ul.querySelector(`[data-key="${CSS.escape(key)}"]`); if(el) el.remove(); }
// ---- MODEL 2 helper: full list in “Used” and live updates ----
function rebuildListsFromStatus(){
  const la = document.getElementById('list-available');
  const lu = document.getElementById('list-used');
  if (la) la.innerHTML = '';
  if (lu) lu.innerHTML = '';

  // Show EVERY master row under “Used” unless it's Available
  for (const r of state.rowIndex){
    const st = state.statusMap.get(r.key);
    if (st === 'Available') {
      addToList('list-available', r.key, 'available');
    } else {
      // Untouched + Used are both “not found yet” => stay in Used
      addToList('list-used', r.key, 'used');
    }
  }
}
// ---- end helper ----
function markAvailable(key){ state.statusMap.set(key,'Available'); addToList('list-available',key,'available'); removeFromList('list-used',key); renderCounters(); const s=document.getElementById('search'); s.focus(); s.select(); refreshResultsIfVisible(); }
function markUsed(key){ state.statusMap.set(key,'Used'); addToList('list-used',key,'used'); removeFromList('list-available',key); renderCounters(); refreshResultsIfVisible(); }

function openReview(){ refreshReview(); updateReviewSummary(); document.getElementById('reviewModal').showModal(); document.getElementById('reviewSearch').focus(); }
function refreshReview(){ const q=(document.getElementById('reviewSearch')?.value||'').toLowerCase().trim(); const c=document.getElementById('reviewList'); if(!c) return; c.innerHTML=''; const rows=state.rowIndex.filter(r=> state.statusMap.get(r.key)==='Available'); rows.forEach(r=>{ if(q){ const id=r.combined_id.toLowerCase(), name=r.material_name.toLowerCase(); if(!(id.includes(q)||name.includes(q))) return; } const div=document.createElement('div'); div.className='review-item'; div.innerHTML=`<span><strong>${r.material_name||'—'}</strong> <span class="badge available">${r.combined_id}</span> <span class="badge">${r.size_mm||'?'} • ${r.thickness_mm||'?'}mm</span> ${r.source==='manual'?'<span class="badge">manual</span>':''}</span><span><button class="ghost" data-action="used" data-key="${r.key}">Mark Used</button><button class="ghost" data-action="untick" data-key="${r.key}">Un-tick</button></span>`; c.appendChild(div); }); c.querySelectorAll('button').forEach(b=>{ const key=b.dataset.key, act=b.dataset.action; b.addEventListener('click', ()=>{ if(act==='used'){ markUsed(key); refreshReview(); } if(act==='untick'){ state.statusMap.set(key,'Untouched'); removeFromList('list-available',key); renderCounters(); refreshReview(); } }); }); updateReviewSummary(); }
function updateReviewSummary(){ const el=document.getElementById('reviewSummary'); if(!el) return; let a=0; for(const v of state.statusMap.values()){ if(v==='Available') a++; } const total=state.masterCount; el.textContent=`Inventoried: ${a} of ${total}`; }
function refreshResultsIfVisible(){ const s=document.getElementById('search').value; if(s) renderSearchResults(searchRows(s)); }

function openAddModal(){ document.getElementById('addSlabModal').showModal(); document.querySelector('#addSlabForm input[name=slab_number]').focus(); }
function addManualSlab(ev){ ev?.preventDefault();if(ev&&ev.submitter&&ev.submitter.value==="cancel"){document.getElementById("addSlabModal").close();return;}const f=document.getElementById('addSlabForm'); const d=new FormData(f); const slab_number=(d.get('slab_number')||'').trim(); const batch_number=(d.get('batch_number')||'').trim(); const combined_id = batch_number ? `${slab_number}/${batch_number}` : slab_number; const material_name=(d.get('material_name')||'').trim(); const size_mm=(d.get('size_mm')||'').trim(); const thickness_mm=(d.get('thickness_mm')||'').trim(); const notes=(d.get('notes')||'').trim(); if(!slab_number || !material_name){ toast('Slab number and Material are required'); return; } const existing = state.rowIndex.find(r=> r.combined_id === combined_id); if(existing){ if(state.statusMap.get(existing.key)==='Available'){ toast('Already inventoried'); } markAvailable(existing.key); document.getElementById('addSlabModal').close(); f.reset(); return; } const slab={ _rowid:`m:${Date.now()}:${Math.random().toString(36).slice(2,6)}`, combined_id, material_name, size_mm, thickness_mm, notes, source:'manual' }; state.slabs.push(slab); const row={ key: makeRowKey(slab), combined_id, material_name, size_mm, thickness_mm, source:'manual', slab }; state.rowIndex.push(row); state.statusMap.set(row.key,'Available'); renderCounters(); markAvailable(row.key); document.getElementById('addSlabModal').close(); f.reset(); }

function exportCSV(rows, headers, name){ const esc=v=>{ const s=(v==null?"":String(v)); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }; const data=[headers.join(',')].concat(rows.map(r=> headers.map(h=>esc(r[h])).join(','))).join('\n'); const blob=new Blob([data],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${name}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function finishSession(){ const available=[], used=[]; for(const r of state.rowIndex){ const status = state.statusMap.get(r.key); if(r.source==='master' && (status==='Used' || status==='Untouched')){ used.push({combined_id:r.combined_id, material_name:r.material_name, size_mm:r.size_mm, thickness_mm:r.thickness_mm, status:'Used', source:r.source}); } if(status==='Available'){ available.push({combined_id:r.combined_id, material_name:r.material_name, size_mm:r.size_mm, thickness_mm:r.thickness_mm, status:'Available', source:r.source}); } } const headers=['combined_id','material_name','size_mm','thickness_mm','status','source']; exportCSV(available, headers, `${state.sessionId}-available`); exportCSV(used, headers, `${state.sessionId}-used`); toast('CSV files created'); }

function saveSession(){ const dump={ sessionId: state.sessionId, status: Array.from(state.statusMap.entries()), manual: state.rowIndex.filter(r=> r.source==='manual').map(r=> r.slab), timestamp: new Date().toISOString() }; localStorage.setItem('bellagio_session', JSON.stringify(dump)); toast('Session saved'); }
function resumeSession(){ const raw = localStorage.getItem('bellagio_session'); if(!raw){ toast('No saved session'); return; } const dump = JSON.parse(raw); const manuals = dump.manual || []; for(const m of manuals){ if(!state.slabs.find(s=>s._rowid===m._rowid)){ state.slabs.push(m); } } buildIndex(state.slabs); state.statusMap = new Map(dump.status); renderCounters(); toast('Session resumed'); }
function newSession(){
  // New ID & show it
  state.sessionId = makeSessionId();
  document.getElementById('session-id').textContent = state.sessionId;

  // Clear saved session
  localStorage.removeItem('bellagio_session');

  // Keep ONLY master rows (drop manual additions)
  state.slabs = state.slabs.filter(s => s.source === 'master');

  // Hard reset UI and statuses
  state.statusMap = new Map();
  const a = document.getElementById('list-available');
  const u = document.getElementById('list-used');
  const r = document.getElementById('results');
  const s = document.getElementById('search');
  if (a) a.innerHTML = '';
  if (u) u.innerHTML = '';
  if (r) r.innerHTML = '';
  if (s) s.value = '';

  // Rebuild clean (all master rows = Untouched)
  buildIndex(state.slabs);
  renderCounters();
  toast('New session started');
}

function wireInstall(){ window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); state.deferredPrompt=e; const btn=document.getElementById('installBtn'); btn.hidden=false; btn.addEventListener('click', async()=>{ btn.hidden=true; state.deferredPrompt?.prompt(); await state.deferredPrompt?.userChoice; state.deferredPrompt=null; }, {once:true}); }); }

async function init(){
  try{
    state.sessionId = makeSessionId();
    document.getElementById('session-id').textContent = state.sessionId;
    const master = await loadCSV('./data/slabs.csv');
    state.masterCount = master.length;
    state.slabs = master.slice();
    buildIndex(state.slabs);
    rebuildListsFromStatus();
  }catch(err){
    console.error(err);
    alert('Failed to load data/slabs.csv. Please ensure the file exists.');
  }

  const search = document.getElementById('search');
  search.addEventListener('input', ()=> renderSearchResults(searchRows(search.value)));
  search.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'){
      const list = searchRows(search.value);
      if(list[0]) markAvailable(list[0].key);
      e.preventDefault();
    }
  });

  document.getElementById('finishBtn').addEventListener('click', finishSession);
  document.getElementById('addSlabBtn').addEventListener('click', openAddModal);
  document.getElementById('addSlabForm').addEventListener('submit', addManualSlab); (function(){const c=document.querySelector('#addSlabModal button[value="cancel"]');if(c){c.type='button';c.addEventListener('click',()=>{const f=document.getElementById('addSlabForm');try{f.reset();}catch(e){}const d=document.getElementById('addSlabModal');try{d.close();}catch(e){}});}})(); (function(){const rm=()=>document.querySelectorAll('#list-used button[data-action="remove"],#list-available button[data-action="remove"]').forEach(b=>b.remove());rm();const U=document.getElementById('list-used'),A=document.getElementById('list-available');if(U)new MutationObserver(()=>rm()).observe(U,{childList:true,subtree:true});if(A)new MutationObserver(()=>rm()).observe(A,{childList:true,subtree:true});})();  // ---- Cancel button fix ----
  const dlg = document.getElementById('addSlabModal');
  const frm = document.getElementById('addSlabForm');
  const cancelBtn = dlg?.querySelector('button[value="cancel"]');
  if(cancelBtn){
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', ()=>{
      frm.reset();
      dlg.close();
    });
  }
  if(dlg){
    dlg.addEventListener('mousedown', e=>{
      if(e.target===dlg){
        frm.reset();
        dlg.close();
      }
    });
  }
  // ---- end fix ----

  document.getElementById('reviewBtn').addEventListener('click', openReview);
  document.getElementById('closeReview').addEventListener('click', ()=> document.getElementById('reviewModal').close());
  document.getElementById('reviewSearch').addEventListener('input', refreshReview);
  document.getElementById('saveBtn').addEventListener('click', saveSession);
  document.getElementById('resumeBtn').addEventListener('click', resumeSession);
  document.getElementById('newBtn').addEventListener('click', newSession);

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  }
  wireInstall();
}
init();
