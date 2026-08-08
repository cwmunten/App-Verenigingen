
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
      ? attention.map(x=>`<button type="button" class="v6-attention-item v7-attention-action" data-v7-assoc-id="${esc(x.a.id||'')}" data-v7-assoc-name="${esc(x.a.name||'')}" title="Open ${esc(x.a.name||'vereniging')} direct in Administratie"><div class="v6-left"><i class="v6-attention-dot"></i><div><b>${esc(x.a.name)}</b><small>Ontbreekt / controleren: ${esc(x.miss.join(', '))}</small></div></div><span class="v6-right">Open →</span></button>`).join('')
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


  function findAdminSearch(){
    return document.querySelector(
      '#adminSearch, input[data-admin-search], .admin-search input, ' +
      '.workspace-main input[placeholder*="vereniging" i], .workspace-main input[placeholder*="administratie" i]'
    );
  }

  function openAssociationFromAttention(id, name){
    // 1. Open Administratie.
    document.querySelector('.sidebar-nav [data-page="admin"]')?.click();

    // 2. Zoek direct op de vereniging zodat alleen de juiste rij zichtbaar blijft.
    setTimeout(()=>{
      const input=findAdminSearch();
      if(input){
        input.focus();
        input.value=name || '';
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }

      // 3. Probeer de bestaande bewerkactie van Vappie direct te openen.
      setTimeout(()=>{
        const explicitSelectors = [
          `[data-edit-association="${CSS.escape(id||'')}"]`,
          `[data-edit-assoc="${CSS.escape(id||'')}"]`,
          `[data-association-id="${CSS.escape(id||'')}"][data-action*="edit"]`,
          `[data-edit="${CSS.escape(id||'')}"]`
        ];
        let editBtn = null;
        for(const selector of explicitSelectors){
          try { editBtn=document.querySelector(selector); } catch {}
          if(editBtn) break;
        }

        // Fallback: vind de zichtbare rij met de verenigingsnaam en pak daar potlood/bewerkknop.
        if(!editBtn && name){
          const rows=[...document.querySelectorAll('.workspace-main table tbody tr, .workspace-main .admin-row, .workspace-main [class*="association"]')];
          const row=rows.find(r=>String(r.textContent||'').toLocaleLowerCase('nl-NL').includes(String(name).toLocaleLowerCase('nl-NL')));
          if(row){
            editBtn =
              row.querySelector('[data-edit-association],[data-edit-assoc],[data-action*="edit"],button[title*="bewerk" i],button[aria-label*="bewerk" i]') ||
              [...row.querySelectorAll('button')].find(b=>/✎|✏|bewerk|wijzig/i.test(b.textContent+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||'')));
          }
        }

        if(editBtn){
          editBtn.click();
        }else{
          // De vereniging staat in elk geval direct gefilterd en gemarkeerd.
          const input2=findAdminSearch();
          input2?.scrollIntoView({behavior:'smooth',block:'start'});
        }
      },120);
    },100);
  }

  function bindAttentionActions(root){
    root.querySelectorAll('.v7-attention-action').forEach(btn=>{
      if(btn.dataset.v7Bound==='1') return;
      btn.dataset.v7Bound='1';
      btn.addEventListener('click',()=>{
        openAssociationFromAttention(btn.dataset.v7AssocId||'', btn.dataset.v7AssocName||'');
      });
    });
  }

  function injectDashboard(){
    const main=document.querySelector('.workspace-main.home-main');
    if(!main) return;
    if(main.querySelector('.v6-dashboard-extra')) return;
    main.insertAdjacentHTML('beforeend',dashboardHTML());
    bindAttentionActions(main);
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
    v10InjectAdminMailButton();
    v11Polish();
    v16OrderNavigation();
  }


  let v9BypassAddShift=false;
  let v9PendingNewAssociation=false;
  let v9AssociationIdsBefore=new Set();

  function v9Data(){
    try{
      const db=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      return {db,y:db?.years?.[db.activeYear]};
    }catch{return {db:null,y:null}}
  }
  function v9CloseFlowModal(){ document.getElementById('v9FlowModal')?.remove(); }

  function v9OpenShiftChoice(){
    v9CloseFlowModal();
    const wrap=document.createElement('div');
    wrap.id='v9FlowModal';
    wrap.className='v9-flow-backdrop';
    wrap.innerHTML=`
      <section class="v9-flow-modal">
        <div class="v9-flow-head">
          <div><span>DIENST TOEVOEGEN</span><h2>Welke vereniging wil je inplannen?</h2></div>
          <button type="button" data-v9-flow="close">×</button>
        </div>
        <p class="v9-flow-intro">Kies of de vereniging al in Vappie staat of eerst nieuw moet worden aangemaakt.</p>
        <div class="v9-flow-options">
          <button type="button" class="v9-flow-option" data-v9-flow="existing">
            <i>✓</i><div><strong>Bestaande vereniging</strong><small>Ga direct door naar de planning en kies de vereniging.</small></div><b>→</b>
          </button>
          <button type="button" class="v9-flow-option" data-v9-flow="new">
            <i>＋</i><div><strong>Nieuwe vereniging</strong><small>Vul eerst de administratie in. Daarna opent automatisch de nieuwe dienst.</small></div><b>→</b>
          </button>
        </div>
        <button type="button" class="v9-flow-cancel" data-v9-flow="close">Annuleren</button>
      </section>`;
    document.body.appendChild(wrap);

    wrap.querySelectorAll('[data-v9-flow="close"]').forEach(b=>b.onclick=v9CloseFlowModal);
    wrap.addEventListener('click',e=>{if(e.target===wrap)v9CloseFlowModal()});

    wrap.querySelector('[data-v9-flow="existing"]').onclick=()=>{
      v9CloseFlowModal();
      const add=document.querySelector('[data-action="add-shift"]');
      if(add){v9BypassAddShift=true;add.click();setTimeout(()=>v9BypassAddShift=false,0)}
    };

    wrap.querySelector('[data-v9-flow="new"]').onclick=()=>{
      v9CloseFlowModal();
      const {y}=v9Data();
      v9AssociationIdsBefore=new Set((y?.associations||[]).map(a=>String(a.id)));
      v9PendingNewAssociation=true;
      document.querySelector('.sidebar-nav [data-page="admin"]')?.click();
      setTimeout(()=>document.querySelector('[data-action="add-assoc"]')?.click(),120);
    };
  }

  function v9ContinueAfterNewAssociation(){
    if(!v9PendingNewAssociation)return;
    const {y}=v9Data();
    const created=[...(y?.associations||[])].reverse().find(a=>!v9AssociationIdsBefore.has(String(a.id)));
    if(!created)return;
    v9PendingNewAssociation=false;
    document.querySelector('.sidebar-nav [data-page="planning"]')?.click();
    setTimeout(()=>{
      const add=document.querySelector('[data-action="add-shift"]');
      if(!add)return;
      v9BypassAddShift=true;add.click();
      setTimeout(()=>{
        v9BypassAddShift=false;
        const select=document.getElementById('fAssoc');
        if(select){select.value=created.id;select.dispatchEvent(new Event('change',{bubbles:true}))}
      },50);
    },120);
  }

  document.addEventListener('click',e=>{
    const home=e.target.closest?.('.sidebar-nav [data-page="home"]');
    if(home){
      e.preventDefault();e.stopImmediatePropagation();location.reload();return;
    }
    const addShift=e.target.closest?.('[data-action="add-shift"]');
    if(addShift&&!v9BypassAddShift){
      e.preventDefault();e.stopImmediatePropagation();v9OpenShiftChoice();return;
    }
    if(v9PendingNewAssociation&&e.target.closest?.('#modalSave')){
      setTimeout(v9ContinueAfterNewAssociation,180);return;
    }
    if(v9PendingNewAssociation&&e.target.closest?.('#modalCancel,#modalClose')){
      v9PendingNewAssociation=false;
    }
  },true);


  // ===== v10: mail alle verenigingen via BCC =====
  const V10_MAILBOX='verenigingen@zomerparkfeest.nl';

  function v10ValidEmail(value){
    const s=String(value||'').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
  }

  function v10AssociationEmails(){
    try{
      const db=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      const y=db?.years?.[db.activeYear];
      const emails=(y?.associations||[])
        .map(a=>v10ValidEmail(a.email))
        .filter(Boolean)
        .filter(e=>e!==V10_MAILBOX);
      return [...new Set(emails)].sort();
    }catch{return []}
  }

  function v10MailAllAssociations(){
    const emails=v10AssociationEmails();
    if(!emails.length){
      alert('Er zijn geen geldige e-mailadressen van verenigingen gevonden in Administratie.');
      return;
    }

    const bcc=encodeURIComponent(emails.join(','));
    const to=encodeURIComponent(V10_MAILBOX);
    const url=`mailto:${to}?bcc=${bcc}`;

    // Het standaard mailprogramma bepaalt de afzender.
    // Wanneer verenigingen@zomerparkfeest.nl als verzendaccount is ingesteld,
    // kan de gebruiker dit adres als afzender gebruiken.
    window.location.href=url;
  }

  function v10InjectAdminMailButton(){
    const adminActive=!!document.querySelector('.sidebar-nav [data-page="admin"].active');
    if(!adminActive)return;

    const actions=document.querySelector('.workspace-main .header-actions');
    if(!actions || actions.querySelector('[data-v10-mail-all]'))return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='secondary v10-mail-all';
    btn.dataset.v10MailAll='1';
    btn.innerHTML='✉ Mail alle verenigingen';
    btn.title=`Nieuwe e-mail aan ${V10_MAILBOX} met alle verenigingen in BCC`;
    btn.addEventListener('click',v10MailAllAssociations);

    // Plaats vóór export/import zodat de mailactie goed zichtbaar is.
    actions.prepend(btn);
  }


  // ===== v11: rustigere, consistente pagina-opbouw =====
  function v11AdminMeta(){
    // v15: bewust geen aantal verenigingen / festivaljaar onder de titel.
    document.querySelectorAll('.v11-admin-meta').forEach(el=>el.remove());
  }

  function v11GroupAdminActions(){
    const active=!!document.querySelector('.sidebar-nav [data-page="admin"].active');
    if(!active)return;
    const actions=document.querySelector('.workspace-main .header-actions');
    if(!actions||actions.querySelector('.v12-more-wrap'))return;

    const mailBtn=actions.querySelector('[data-v10-mail-all]');
    const importBtn=actions.querySelector('[data-action="import-excel"]');
    const exportBtn=actions.querySelector('[data-action="export-report"]');
    if(!mailBtn&&!importBtn&&!exportBtn)return;

    const wrap=document.createElement('div');
    wrap.className='v11-more-wrap v12-more-wrap';
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='secondary v11-more-button';
    toggle.textContent='Meer ▾';
    const menu=document.createElement('div');
    menu.className='v11-more-menu';

    [mailBtn,importBtn,exportBtn].filter(Boolean).forEach(original=>{
      const clone=original.cloneNode(true);
      clone.classList.remove('v11-secondary-hidden');
      clone.removeAttribute('data-v11-bound');
      clone.addEventListener('click',()=>{
        original.click();
        wrap.classList.remove('open');
      });
      if(clone.hasAttribute('data-v10-mail-all')){
        clone.querySelector('span')?.remove();
        clone.innerHTML='✉ Mail alle verenigingen';
      }
      menu.appendChild(clone);
      original.classList.add('v11-secondary-hidden','v12-desktop-source-action');
    });

    wrap.append(toggle,menu);
    actions.appendChild(wrap);
    toggle.onclick=e=>{e.stopPropagation();wrap.classList.toggle('open')};
  }

  document.addEventListener('click',e=>{
    if(!e.target.closest?.('.v11-more-wrap'))document.querySelectorAll('.v11-more-wrap.open').forEach(x=>x.classList.remove('open'));
  });

  function v11Polish(){
    v11AdminMeta();
    v11GroupAdminActions();
  }

  // ===== v16: vaste menuvolgorde =====
  function v16OrderNavigation(){
    const nav=document.querySelector('.sidebar-nav');
    if(!nav)return;
    const order=['home','planning','admin','financial','occupancy'];
    const items=[...nav.querySelectorAll('[data-page]')];
    order.forEach(page=>{
      const item=items.find(el=>el.dataset.page===page);
      if(item)nav.appendChild(item);
    });
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
    v10InjectAdminMailButton();
    v11Polish();
    v16OrderNavigation();
  },5000);
})();
