
(() => {
  'use strict';

  const STORAGE_KEY = 'vappie-data-v2';
  const AUDIT_KEY = 'vappie-audit-v6';
  const DAYS = ['Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
  const euro = n => new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n||0));
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const loadDB = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); } catch { return null; } };
  const loadAudit = () => { try { return JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]'); } catch { return []; } };
  const saveAudit = a => { try { localStorage.setItem(AUDIT_KEY, JSON.stringify(a.slice(0,20))); } catch {} };

  function durationHours(from,to){
    if(!from||!to) return 0;
    const [fh,fm]=String(from).split(':').map(Number), [th,tm]=String(to).split(':').map(Number);
    let a=fh*60+fm,b=th*60+tm;if(b<=a)b+=1440;return (b-a)/60;
  }

  function amount(shift, association, rate){
    return durationHours(shift.from,shift.to)*Number(shift.people||0)*Number(association?.rateOverride ?? rate ?? 0);
  }

  function addAudit(text, detail=''){
    const audit = loadAudit();
    audit.unshift({text,detail,at:Date.now()});
    saveAudit(audit);
  }

  function compareAndAudit(oldRaw,newRaw){
    try{
      const oldDb=JSON.parse(oldRaw||'null'), newDb=JSON.parse(newRaw||'null');
      if(!oldDb||!newDb) return;
      const year=newDb.activeYear, oldY=oldDb.years?.[year], newY=newDb.years?.[year];
      if(!oldY||!newY) return;

      const oldAssoc=new Map((oldY.associations||[]).map(a=>[a.id,a]));
      const newAssoc=new Map((newY.associations||[]).map(a=>[a.id,a]));
      for(const [id,a] of newAssoc){
        const prev=oldAssoc.get(id);
        if(!prev){ addAudit('Vereniging toegevoegd',a.name||''); break; }
        if(JSON.stringify(prev)!==JSON.stringify(a)){ addAudit('Vereniging gewijzigd',a.name||''); break; }
      }
      if((newY.associations||[]).length < (oldY.associations||[]).length) addAudit('Vereniging verwijderd','Administratie');

      const oldShifts=new Map((oldY.shifts||[]).map(s=>[s.id,s]));
      const newShifts=new Map((newY.shifts||[]).map(s=>[s.id,s]));
      for(const [id,s] of newShifts){
        const prev=oldShifts.get(id);
        if(!prev){ addAudit('Dienst toegevoegd',`${s.day||''} · ${s.bar||''}`); break; }
        if(JSON.stringify(prev)!==JSON.stringify(s)){ addAudit('Dienst gewijzigd',`${s.day||''} · ${s.bar||''}`); break; }
      }
      if((newY.shifts||[]).length < (oldY.shifts||[]).length) addAudit('Dienst verwijderd','Planning');
    }catch{}
  }

  // Leg wijzigingen vast die via de bestaande Vappie save()-functie naar localStorage gaan.
  try{
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key,value){
      if(this===localStorage && key===STORAGE_KEY){
        const oldRaw = originalSet.call ? localStorage.getItem(STORAGE_KEY) : null;
        originalSet.call(this,key,value);
        if(oldRaw && oldRaw !== value) compareAndAudit(oldRaw,value);
        return;
      }
      return originalSet.call(this,key,value);
    };
  }catch{}

  function currentData(){
    const db=loadDB();
    if(!db?.years) return null;
    const y=db.years[db.activeYear];
    if(!y) return null;
    return {db,y};
  }

  function missingInfo(a){
    const miss=[];
    if(!String(a.barchef||'').trim()) miss.push('barchef');
    if(!String(a.phone||'').trim()) miss.push('telefoon');
    if(!String(a.email||'').trim()) miss.push('e-mail');
    if(!String(a.certificates||'').trim() || /onbekend|nee|niet/i.test(String(a.certificates||''))) miss.push('certificaten');
    return miss;
  }

  function dashboardHTML(){
    const data=currentData();
    if(!data) return '';
    const {db,y}=data;
    const associations=y.associations||[], shifts=y.shifts||[];
    const assocMap=new Map(associations.map(a=>[a.id,a]));
    const people=shifts.reduce((n,s)=>n+Number(s.people||0),0);
    const total=shifts.reduce((n,s)=>n+amount(s,assocMap.get(s.associationId),y.rate),0);

    const attention=associations.map(a=>({a,miss:missingInfo(a)})).filter(x=>x.miss.length).slice(0,6);
    const dayData=DAYS.map(day=>{
      const list=shifts.filter(s=>s.day===day);
      return {day,services:list.length,people:list.reduce((n,s)=>n+Number(s.people||0),0),clubs:new Set(list.map(s=>s.associationId).filter(Boolean)).size};
    }).filter(x=>x.services);
    const first=dayData[0]||null;

    const audit=loadAudit().slice(0,5);
    const recentHtml=audit.length
      ? audit.map(x=>`<div class="v6-recent-item"><div class="v6-left"><div><b>${esc(x.text)}</b><small>${esc(x.detail||'Vappie')}</small></div></div><span class="v6-right">${new Date(x.at).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</span></div>`).join('')
      : '<div class="v6-empty">Nog geen wijzigingen op dit apparaat geregistreerd. Nieuwe aanpassingen verschijnen hier automatisch.</div>';

    const attentionHtml=attention.length
      ? attention.map(x=>`<div class="v6-attention-item"><div class="v6-left"><i class="v6-attention-dot"></i><div><b>${esc(x.a.name)}</b><small>Ontbreekt / controleren: ${esc(x.miss.join(', '))}</small></div></div><span class="v6-right">${x.miss.length} punt${x.miss.length===1?'':'en'}</span></div>`).join('')
      : '<div class="v6-empty">Mooi: geen opvallend ontbrekende basisgegevens gevonden.</div>';

    return `
      <section class="v6-dashboard-extra" aria-label="Dashboard overzicht">
        <div class="v6-kpi-grid">
          <article class="v6-kpi"><i class="v6-kpi-icon">♟</i><span>Verenigingen</span><strong>${associations.length}</strong><small>In ${esc(db.activeYear)}</small></article>
          <article class="v6-kpi"><i class="v6-kpi-icon">▣</i><span>Diensten</span><strong>${shifts.length}</strong><small>Gepland totaal</small></article>
          <article class="v6-kpi"><i class="v6-kpi-icon">●</i><span>Ingeplande personen</span><strong>${people.toLocaleString('nl-NL')}</strong><small>Over alle diensten</small></article>
          <article class="v6-kpi"><i class="v6-kpi-icon">€</i><span>Totale vergoeding</span><strong>${euro(total)}</strong><small>Berekend uit planning</small></article>
        </div>

        <div class="v6-dashboard-grid">
          <article class="v6-panel">
            <div class="v6-panel-head"><div><span>Controle</span><h3>Aandacht nodig</h3></div><b class="v6-badge">${attention.length}${attention.length===6?'+':''}</b></div>
            <div class="v6-attention-list">${attentionHtml}</div>
          </article>

          <article class="v6-panel">
            <div class="v6-panel-head"><div><span>Festival</span><h3>Planning in één oogopslag</h3></div></div>
            ${first ? `<div class="v6-festival"><div><small>Eerstvolgende festivaldag in de planning</small><strong>${esc(first.day)}</strong><small>${first.services} diensten · ${first.clubs} verenigingen</small></div><div class="v6-festival-number">${first.people}</div></div>` : '<div class="v6-empty">Nog geen diensten ingepland.</div>'}
            <div class="v6-day-stats">
              ${dayData.slice(0,3).map(d=>`<div class="v6-day-stat"><span>${esc(d.day)}</span><strong>${d.people}</strong><span>personen</span></div>`).join('')}
            </div>
          </article>
        </div>

        <div class="v6-bottom-grid">
          <article class="v6-panel">
            <div class="v6-panel-head"><div><span>Lokaal logboek</span><h3>Recente wijzigingen</h3></div><b class="v6-badge">dit apparaat</b></div>
            <div class="v6-recent-list">${recentHtml}</div>
          </article>
          <article class="v6-panel">
            <div class="v6-panel-head"><div><span>Snel naar</span><h3>Snelle acties</h3></div></div>
            <div class="v6-actions">
              <button class="v6-action" data-v6-action="admin"><i>＋</i> Vereniging</button>
              <button class="v6-action" data-v6-action="planning"><i>＋</i> Dienst</button>
              <button class="v6-action" data-v6-action="admin"><i>☷</i> Administratie</button>
              <button class="v6-action" data-v6-action="data"><i>⇧</i> Data / back-up</button>
            </div>
          </article>
        </div>
      </section>`;
  }

  function injectDashboard(){
    const main=document.querySelector('.workspace-main.home-main');
    if(!main) return;
    if(main.querySelector('.v6-dashboard-extra')) return;
    main.insertAdjacentHTML('beforeend',dashboardHTML());
    main.querySelectorAll('[data-v6-action]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const action=btn.dataset.v6Action;
        if(action==='data'){
          document.querySelector('[data-action="data"]')?.click();
          return;
        }
        document.querySelector(`.sidebar-nav [data-page="${action}"]`)?.click();
        setTimeout(()=>{
          if(action==='planning') document.querySelector('[data-action="add-shift"]')?.click();
          if(action==='admin') {
            // Alleen "Vereniging" knop opent direct toevoegen; gewone Administratie blijft op de pagina.
            if(btn.textContent.includes('Vereniging')) document.querySelector('[data-action="add-association"]')?.click();
          }
        },100);
      });
    });
  }

  let bar=null, targetScroll=null, syncing=false;
  function removeAdminBar(){
    bar?.remove();bar=null;targetScroll=null;
    document.body.classList.remove('v6-admin-active');
  }

  function setupAdminBar(){
    const main=document.querySelector('.workspace-main.main');
    const activeAdmin = !!document.querySelector('.sidebar-nav [data-page="admin"].active');
    if(!main || !activeAdmin){ removeAdminBar(); return; }
    const candidates=[...main.querySelectorAll('.table-scroll')].filter(el=>el.scrollWidth>el.clientWidth+5);
    const target=candidates.sort((a,b)=>b.scrollWidth-a.scrollWidth)[0];
    if(!target){ removeAdminBar(); return; }

    document.body.classList.add('v6-admin-active');
    if(!bar){
      bar=document.createElement('div');
      bar.className='v6-admin-scrollbar';
      bar.innerHTML='<div></div>';
      document.body.appendChild(bar);
      bar.addEventListener('scroll',()=>{
        if(syncing||!targetScroll)return;
        syncing=true;targetScroll.scrollLeft=bar.scrollLeft;requestAnimationFrame(()=>syncing=false);
      });
    }
    targetScroll=target;
    const workspace=document.querySelector('.workspace')||main;
    const rect=workspace.getBoundingClientRect();
    bar.style.left=Math.max(0,rect.left)+'px';
    bar.style.width=Math.min(window.innerWidth-rect.left,rect.width)+'px';
    bar.firstElementChild.style.width=target.scrollWidth+'px';
    bar.scrollLeft=target.scrollLeft;

    if(!target.dataset.v6SyncBound){
      target.dataset.v6SyncBound='1';
      target.addEventListener('scroll',()=>{
        if(syncing||target!==targetScroll||!bar)return;
        syncing=true;bar.scrollLeft=target.scrollLeft;requestAnimationFrame(()=>syncing=false);
      });
    }
  }

  function refresh(){
    injectDashboard();
    setupAdminBar();
  }

  const obs=new MutationObserver(()=>{ clearTimeout(window.__v6Refresh); window.__v6Refresh=setTimeout(refresh,30); });
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',refresh);
  window.addEventListener('load',refresh);
  setTimeout(refresh,250);
  setInterval(()=>{
    if(document.querySelector('.workspace-main.home-main')){
      document.querySelector('.v6-dashboard-extra')?.remove();
      injectDashboard();
    }
    setupAdminBar();
  },5000);
})();
