
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
    v18ColorDayparts();
    v25EnsurePhotoAlbumNav();
    v25OrderPhotoNav();
    v31EnsureNav();
    v26RefreshHomePhotos();
    v31RenderHomeLatest();
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
    const items=[...nav.querySelectorAll(':scope > [data-page]')];

    // Alleen herschikken wanneer de volgorde echt afwijkt.
    // Dit voorkomt een MutationObserver-lus die de navigatie kon blokkeren.
    const current=items.map(el=>el.dataset.page).join('|');
    const desired=order.filter(page=>items.some(el=>el.dataset.page===page)).join('|');
    if(current===desired)return;

    const frag=document.createDocumentFragment();
    order.forEach(page=>{
      const item=items.find(el=>el.dataset.page===page);
      if(item)frag.appendChild(item);
    });
    nav.appendChild(frag);
  }


  // v17: extra veiligheid - navigatieknoppen krijgen geen eigen click-handler hier.
  // De originele app.js onclick-handlers blijven volledig leidend.

  // ===== v18: verschillende kleuren voor dagdelen =====
  function v18ColorDayparts(){
    document.querySelectorAll('.workspace-main td, .workspace-main .badge, .workspace-main .pill, .workspace-main span').forEach(el=>{
      const text=String(el.textContent||'').trim().toLocaleLowerCase('nl-NL');
      if(text==='avond'){
        el.classList.add('v18-daypart','v18-evening');
        el.classList.remove('v18-afternoon');
      }else if(text==='middag'){
        el.classList.add('v18-daypart','v18-afternoon');
        el.classList.remove('v18-evening');
      }
    });
  }


  // ===== v25: Fotoalbum vanuit fotobibliotheek =====
  const V25_PHOTO_BUCKET='vappie-photoalbum';
  const V25_SB_URL='https://ngijjzcizhwoeieaelgz.supabase.co';
  const V25_SB_KEY='sb_publishable_fQFpxmC6XeNeJ0yOv52S7g_VIbs2jLg';
  let v25PhotoClient=null;

  function v25EnsurePhotoAlbumNav(){
    const nav=document.querySelector('.sidebar-nav');
    if(!nav)return;
    let btn=nav.querySelector('[data-v25-page="photoalbum"]');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.dataset.v25Page='photoalbum';
      btn.innerHTML='<b>▧</b><span>Fotoalbum</span>';
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.sidebar-nav button').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('nav')?.classList.remove('open');
        v25RenderPhotoAlbum();
      });
      nav.appendChild(btn);
    }
  }

  function v25OrderPhotoNav(){
    const nav=document.querySelector('.sidebar-nav');
    if(!nav)return;
    const photo=nav.querySelector('[data-v25-page="photoalbum"]');
    const occupancy=nav.querySelector('[data-page="occupancy"]');
    if(photo&&occupancy&&occupancy.nextElementSibling!==photo){
      occupancy.insertAdjacentElement('afterend',photo);
    }
  }

  async function v25Client(){
    if(v25PhotoClient)return v25PhotoClient;
    if(!window.supabase?.createClient){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.async=true;
        s.onload=resolve;
        s.onerror=()=>reject(new Error('Supabase-module kon niet worden geladen.'));
        document.head.appendChild(s);
      });
    }
    v25PhotoClient=window.supabase.createClient(V25_SB_URL,V25_SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return v25PhotoClient;
  }

  function v25AlbumHtml(){
    return `<section class="v25-album-page">
      <div class="v25-album-head">
        <div><span class="eyebrow">TEAM VERENIGINGEN</span><h1>Fotoalbum</h1><p>Foto's van Team Verenigingen op één plek.</p></div>
        <button class="primary v25-upload-btn" id="v25UploadBtn">＋ Foto's toevoegen</button>
      </div>
      <input id="v25PhotoInput" type="file" accept="image/*" multiple hidden>
      <div class="v25-album-toolbar"><strong>Galerij</strong><button type="button" class="secondary" id="v25RefreshPhotos">↻ Vernieuwen</button></div>
      <div id="v25AlbumStatus" class="v25-album-status">Fotoalbum laden…</div>
      <div id="v25PhotoGrid" class="v25-photo-grid"></div>
    </section>`;
  }

  async function v25RenderPhotoAlbum(){
    const main=document.querySelector('.workspace-main');
    if(!main)return;
    main.className='workspace-main main';
    main.innerHTML=v25AlbumHtml();
    document.getElementById('v25UploadBtn')?.addEventListener('click',()=>document.getElementById('v25PhotoInput')?.click());
    document.getElementById('v25PhotoInput')?.addEventListener('change',v25UploadSelected);
    document.getElementById('v25RefreshPhotos')?.addEventListener('click',v25LoadGallery);
    await v25LoadGallery();
  }

  async function v25ResizePhoto(file){
    const bitmap=await createImageBitmap(file);
    const max=1600;
    const factor=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*factor));
    const h=Math.max(1,Math.round(bitmap.height*factor));
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.drawImage(bitmap,0,0,w,h);
    bitmap.close?.();
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Foto kon niet worden verwerkt.')),'image/jpeg',0.80));
  }

  async function v25UploadSelected(e){
    const files=[...(e.target.files||[])];
    if(!files.length)return;
    const status=document.getElementById('v25AlbumStatus');
    try{
      const client=await v25Client();
      const {data:{session}}=await client.auth.getSession();
      if(!session)throw new Error('Je bent niet aangemeld bij Supabase.');
      let done=0;
      for(const file of files){
        if(!String(file.type||'').startsWith('image/'))continue;
        if(status)status.textContent=`Foto ${done+1} van ${files.length} voorbereiden…`;
        const blob=await v25ResizePhoto(file);
        const stamp=new Date().toISOString().replace(/[:.]/g,'-');
        const user=(session.user?.email||'gebruiker').split('@')[0].replace(/[^a-z0-9_-]/gi,'-').toLowerCase();
        const filename=`${stamp}_${user}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const {error}=await client.storage.from(V25_PHOTO_BUCKET).upload(filename,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});
        if(error)throw error;
        done+=1;
      }
      e.target.value='';
      if(status)status.textContent=done===1?'1 foto toegevoegd ✓':`${done} foto's toegevoegd ✓`;
      await v25LoadGallery();
      v26RefreshHomePhotos(true);
    }catch(err){
      console.error('Foto-upload fout:',err);
      if(status)status.innerHTML=`<div class="v25-album-error"><strong>Uploaden lukt niet.</strong><span>${esc(err?.message||err)}</span></div>`;
    }
  }


  async function v26DeletePhoto(name){
    if(!name)return;
    if(!confirm("Deze foto definitief uit het fotoalbum verwijderen?"))return;
    try{
      const client=await v25Client();
      const {data:{session}}=await client.auth.getSession();
      if(!session)throw new Error("Je bent niet aangemeld bij Supabase.");
      const {error}=await client.storage.from(V25_PHOTO_BUCKET).remove([name]);
      if(error)throw error;
      await v25LoadGallery();
      v26RefreshHomePhotos(true);
    }catch(err){
      console.error("Foto verwijderen fout:",err);
      alert(`Foto verwijderen mislukt: ${err?.message||err}`);
    }
  }

  async function v25LoadGallery(){
    const status=document.getElementById('v25AlbumStatus');
    const grid=document.getElementById('v25PhotoGrid');
    if(!status||!grid)return;
    status.textContent='Galerij laden…';
    grid.innerHTML='';
    try{
      const client=await v25Client();
      const {data:{session}}=await client.auth.getSession();
      if(!session)throw new Error('Je bent niet aangemeld bij Supabase.');
      const {data,error}=await client.storage.from(V25_PHOTO_BUCKET).list('',{limit:200,sortBy:{column:'created_at',order:'desc'}});
      if(error)throw error;
      const photos=(data||[]).filter(f=>f?.name&&!f.name.startsWith('.'));
      if(!photos.length){
        status.innerHTML=`<div class="v25-album-empty"><b>▧</b><strong>Nog geen foto's</strong><span>Voeg foto's toe vanuit de fotobibliotheek.</span></div>`;
        return;
      }
      status.textContent=photos.length===1?'1 foto':`${photos.length} foto's`;
      for(const photo of photos){
        const {data:signed,error:signedError}=await client.storage.from(V25_PHOTO_BUCKET).createSignedUrl(photo.name,3600);
        if(signedError||!signed?.signedUrl)continue;
        const date=photo.created_at?new Date(photo.created_at):null;
        const card=document.createElement('article');
        card.className='v25-photo-card';
        card.innerHTML=`<button type="button" class="v25-photo-button"><img loading="lazy" src="${signed.signedUrl}" alt="Foto uit Vappie fotoalbum"><small>${date?date.toLocaleString('nl-NL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''}</small></button><button type="button" class="v26-photo-delete" title="Foto verwijderen" aria-label="Foto verwijderen">⌫</button>`;
        card.querySelector('.v25-photo-button').addEventListener('click',()=>v25OpenLarge(signed.signedUrl,date));
        card.querySelector('.v26-photo-delete').addEventListener('click',e=>{e.stopPropagation();v26DeletePhoto(photo.name)});
        grid.appendChild(card);
      }
    }catch(err){
      console.error('Fotoalbum fout:',err);
      status.innerHTML=`<div class="v25-album-error"><strong>Fotoalbum niet beschikbaar.</strong><span>${esc(err?.message||err)}</span></div>`;
    }
  }

  function v25OpenLarge(url,date){
    const box=document.createElement('div');
    box.className='v25-lightbox';
    box.innerHTML=`<button class="v25-lightbox-close" aria-label="Sluiten">×</button><img src="${url}" alt="Vergrote foto"><small>${date?date.toLocaleString('nl-NL',{dateStyle:'long',timeStyle:'short'}):''}</small>`;
    box.addEventListener('click',e=>{if(e.target===box||e.target.closest('.v25-lightbox-close'))box.remove()});
    document.body.appendChild(box);
  }

  document.addEventListener('click',e=>{
    const normal=e.target.closest?.('.sidebar-nav [data-page]');
    if(normal)document.querySelector('[data-v25-page="photoalbum"]')?.classList.remove('active');
  },true);


  let v26HomeLoading=false;

  function v26EnsureHomePhotos(){
    if(window.matchMedia('(max-width: 899px)').matches)return null;
    const main=document.querySelector('.workspace-main');
    const dashboard=main?.querySelector('.v6-dashboard-extra');
    const home=!!document.querySelector('.sidebar-nav [data-page="home"].active');
    if(!dashboard||!home)return null;

    let block=dashboard.querySelector('.v26-home-photos');
    if(!block){
      block=document.createElement('section');
      block.className='v26-home-photos';
      block.innerHTML=`<div class="v26-home-photos-head"><div><span>FOTOALBUM</span><h3>Laatste foto's</h3></div><button type="button" class="secondary" data-v26-open-album>Bekijk album →</button></div><div class="v26-home-photo-grid" data-v26-home-grid><div class="v26-home-photo-empty">Laatste foto's laden…</div></div>`;
      dashboard.appendChild(block);
      block.querySelector('[data-v26-open-album]')?.addEventListener('click',()=>document.querySelector('[data-v25-page="photoalbum"]')?.click());
    }
    return block;
  }


  let v30LastHomePhotoSignature='';

  async function v30CheckForNewHomePhotos(){
    if(window.matchMedia('(max-width: 899px)').matches)return;
    const home=!!document.querySelector('.sidebar-nav [data-page="home"].active');
    const block=document.querySelector('.v26-home-photos');
    if(!home||!block)return;

    try{
      const client=await v25Client();
      const {data:{session}}=await client.auth.getSession();
      if(!session)return;

      const {data,error}=await client.storage.from(V25_PHOTO_BUCKET).list('',{
        limit:2,
        sortBy:{column:'created_at',order:'desc'}
      });
      if(error)return;

      const photos=(data||[]).filter(f=>f?.name&&!f.name.startsWith('.')).slice(0,2);
      const signature=photos.map(f=>f.name).join('|');

      // Eerste controle onthoudt alleen de huidige situatie.
      if(!v30LastHomePhotoSignature){
        v30LastHomePhotoSignature=signature;
        return;
      }

      // Alleen bij een echte wijziging de afbeeldingen opnieuw laden.
      if(signature!==v30LastHomePhotoSignature){
        v30LastHomePhotoSignature=signature;
        const grid=block.querySelector('[data-v26-home-grid]');
        if(grid)grid.dataset.loaded='0';
        await v26RefreshHomePhotos(true);
      }
    }catch(err){
      console.warn('Controle op nieuwe foto overgeslagen:',err);
    }
  }

  async function v26RefreshHomePhotos(force=false){
    const block=v26EnsureHomePhotos();
    if(!block||v26HomeLoading)return;
    const grid=block.querySelector('[data-v26-home-grid]');
    if(!grid)return;
    if(!force&&grid.dataset.loaded==='1')return;

    grid.dataset.loaded='1';
    v26HomeLoading=true;
    try{
      const client=await v25Client();
      const {data:{session}}=await client.auth.getSession();
      if(!session)throw new Error("Niet aangemeld");

      const {data,error}=await client.storage.from(V25_PHOTO_BUCKET).list('',{limit:2,sortBy:{column:'created_at',order:'desc'}});
      if(error)throw error;
      const photos=(data||[]).filter(f=>f?.name&&!f.name.startsWith('.')).slice(0,2);
      v30LastHomePhotoSignature=photos.map(f=>f.name).join('|');

      if(!photos.length){
        grid.innerHTML=`<div class="v26-home-photo-empty">Nog geen foto's in het album.</div>`;
        grid.dataset.loaded='1';
        return;
      }

      grid.innerHTML='';
      for(const photo of photos){
        const {data:signed,error:signedError}=await client.storage.from(V25_PHOTO_BUCKET).createSignedUrl(photo.name,3600);
        if(signedError||!signed?.signedUrl)continue;
        const date=photo.created_at?new Date(photo.created_at):null;
        const item=document.createElement('button');
        item.type='button';
        item.className='v26-home-photo';
        item.innerHTML=`<img src="${signed.signedUrl}" alt="Recente foto"><span>${date?date.toLocaleString('nl-NL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''}</span>`;
        item.addEventListener('click',()=>v25OpenLarge(signed.signedUrl,date));
        grid.appendChild(item);
      }
      grid.dataset.loaded='1';
    }catch(err){
      console.warn("Laatste foto's op Home niet geladen:",err);
      grid.innerHTML=`<div class="v26-home-photo-empty">Fotoalbum tijdelijk niet beschikbaar.</div>`;
    }finally{
      v26HomeLoading=false;
    }
  }


  // ===== v31 Meldingen =====
  const V31_NOTICE_TABLE='vappie_meldingen';
  const V31_READ_TABLE='vappie_melding_reads';
  let v31ClientRef=null;

  async function v31Client(){
    if(v31ClientRef)return v31ClientRef;
    if(!window.supabase?.createClient){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onload=resolve;s.onerror=()=>reject(new Error('Supabase-module kon niet worden geladen.'));
        document.head.appendChild(s);
      });
    }
    v31ClientRef=window.supabase.createClient(V25_SB_URL,V25_SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return v31ClientRef;
  }

  async function v31Session(){
    const client=await v31Client();
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw new Error('Je bent niet aangemeld bij Supabase.');
    return {client,session};
  }

  function v31EnsureNav(){
    const nav=document.querySelector('.sidebar-nav'); if(!nav)return;
    let btn=nav.querySelector('[data-v31-page="meldingen"]');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';btn.dataset.v31Page='meldingen';
      btn.innerHTML='<b>!</b><span>Meldingen</span><em class="v31-nav-badge" hidden>0</em>';
      btn.onclick=()=>{document.querySelectorAll('.sidebar-nav button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById('nav')?.classList.remove('open');v31RenderPage()};
      nav.appendChild(btn);
    }
    const photo=nav.querySelector('[data-v25-page="photoalbum"]');
    if(photo && photo.previousElementSibling!==btn)photo.insertAdjacentElement('beforebegin',btn);
  }

  function v31PageHtml(){
    const now=new Date(), d=now.toISOString().slice(0,10), t=now.toTimeString().slice(0,5);
    return `<section class="v31-page">
      <div class="v31-head"><div><span class="eyebrow">TEAM VERENIGINGEN</span><h1>Meldingen</h1><p>Leg calamiteiten en bijzonderheden direct vast.</p></div><button class="primary" id="v31New">＋ Nieuwe melding</button></div>
      <div class="v31-form" id="v31Form" hidden>
        <div class="v31-form-head"><h3>Nieuwe melding</h3><button id="v31Close">×</button></div>
        <div class="v31-grid">
          <label><span>Naam</span><input id="v31Name" placeholder="Naam melder"></label>
          <label><span>Datum</span><input id="v31Date" type="date" value="${d}"></label>
          <label><span>Tijd</span><input id="v31Time" type="time" value="${t}"></label>
          <label><span>Betreft</span><input id="v31Subject" placeholder="Waar gaat de melding over?"></label>
          <label class="full"><span>Melding</span><textarea id="v31Message" rows="5" placeholder="Omschrijf de calamiteit..."></textarea></label>
        </div>
        <div class="v31-actions"><button class="secondary" id="v31Cancel">Annuleren</button><button class="primary" id="v31Save">✓ Opslaan</button></div>
      </div>
      <div class="v31-list-head"><div><span>MELDINGENLOGBOEK</span><h3>Alle meldingen</h3></div><button class="secondary" id="v31Refresh">↻ Vernieuwen</button></div>
      <div id="v31Status" class="v31-status">Laden…</div><div id="v31List" class="v31-list"></div>
    </section>`;
  }

  async function v31RenderPage(){
    const main=document.querySelector('.workspace-main'); if(!main)return;
    main.className='workspace-main main';main.innerHTML=v31PageHtml();
    const show=()=>document.getElementById('v31Form').hidden=false, hide=()=>document.getElementById('v31Form').hidden=true;
    document.getElementById('v31New').onclick=show;document.getElementById('v31Close').onclick=hide;document.getElementById('v31Cancel').onclick=hide;
    document.getElementById('v31Save').onclick=v31Save;document.getElementById('v31Refresh').onclick=()=>v31Load(true);
    await v31Load(true);
  }

  async function v31Save(){
    const row={
      name:document.getElementById('v31Name').value.trim(),
      notice_date:document.getElementById('v31Date').value,
      notice_time:document.getElementById('v31Time').value,
      subject:document.getElementById('v31Subject').value.trim(),
      message:document.getElementById('v31Message').value.trim()
    };
    if(Object.values(row).some(v=>!v))return alert('Vul alle velden volledig in.');
    try{
      const {client,session}=await v31Session();row.created_by=session.user.id;
      const {data,error}=await client.from(V31_NOTICE_TABLE).insert(row).select().single();if(error)throw error;
      await v31MarkRead([data.id]);
      document.getElementById('v31Form').hidden=true;
      await v31Load(true);await v31RefreshState(true);
    }catch(err){alert(`Melding opslaan mislukt: ${err?.message||err}`)}
  }

  async function v31Fetch(limit=100){
    const {client}=await v31Session();
    const {data,error}=await client.from(V31_NOTICE_TABLE).select('*').order('created_at',{ascending:false}).limit(limit);
    if(error)throw error;return data||[];
  }

  async function v31ReadIds(){
    const {client,session}=await v31Session();
    const {data,error}=await client.from(V31_READ_TABLE).select('melding_id').eq('user_id',session.user.id);
    if(error)throw error;return new Set((data||[]).map(x=>String(x.melding_id)));
  }

  async function v31MarkRead(ids){
    const {client,session}=await v31Session();
    const rows=[...new Set(ids.map(String))].map(id=>({user_id:session.user.id,melding_id:id,read_at:new Date().toISOString()}));
    if(!rows.length)return;
    const {error}=await client.from(V31_READ_TABLE).upsert(rows,{onConflict:'user_id,melding_id'});if(error)throw error;
  }

  async function v31Load(markRead=false){
    const status=document.getElementById('v31Status'), list=document.getElementById('v31List');if(!status||!list)return;
    try{
      const notices=await v31Fetch(), read=await v31ReadIds();
      status.textContent=`${notices.length} melding${notices.length===1?'':'en'}`;list.innerHTML='';
      for(const n of notices){
        const unread=!read.has(String(n.id)), el=document.createElement('article');
        el.className=`v31-item${unread?' unread':''}`;
        el.innerHTML=`<div><strong>${esc(n.subject)}</strong>${unread?'<span class="v31-new">Nieuw</span>':''}<small>${esc(n.notice_date)} · ${esc(String(n.notice_time).slice(0,5))} · ${esc(n.name)}</small></div><p>${esc(n.message)}</p>`;
        list.appendChild(el);
      }
      if(markRead){
        const ids=notices.filter(n=>!read.has(String(n.id))).map(n=>n.id);
        if(ids.length)await v31MarkRead(ids);
        await v31RefreshState(true);
      }
    }catch(err){status.textContent=`Meldingen niet beschikbaar: ${err?.message||err}`}
  }

  function v31HomeBlock(){
    const main=document.querySelector('.workspace-main'), search=main?.querySelector('.search-hero');
    const home=!!document.querySelector('.sidebar-nav [data-page="home"].active');
    if(!main||!search||!home)return null;
    let block=main.querySelector('.v31-home-latest');
    if(!block){block=document.createElement('section');block.className='v31-home-latest';search.insertAdjacentElement('afterend',block)}
    return block;
  }

  async function v31RenderHomeLatest(notices){
    const block=v31HomeBlock();if(!block)return;
    const n=(notices||await v31Fetch(1))[0];
    if(!n){block.hidden=true;block.innerHTML='';return}
    block.hidden=false;
    block.innerHTML=`<button class="v31-home-card"><span>!</span><div><small>LAATSTE MELDING</small><strong>${esc(n.subject)}</strong><em>${esc(n.notice_date)} · ${esc(String(n.notice_time).slice(0,5))} · ${esc(n.name)}</em><p>${esc(n.message)}</p></div><b>Bekijk →</b></button>`;
    block.querySelector('button').onclick=()=>document.querySelector('[data-v31-page="meldingen"]')?.click();
  }

  async function v31Badge(count){
    const n=Math.max(0,Number(count)||0), badge=document.querySelector('.v31-nav-badge');
    if(badge){badge.hidden=n===0;badge.textContent=String(n)}
    try{
      if(n&&navigator.setAppBadge)await navigator.setAppBadge(n);
      else if(!n&&navigator.clearAppBadge)await navigator.clearAppBadge();
    }catch{}
  }

  async function v31RefreshState(forceHome=false){
    try{
      const notices=await v31Fetch(), read=await v31ReadIds();
      const unread=notices.filter(n=>!read.has(String(n.id))).length;
      await v31Badge(unread);
      if(forceHome||document.querySelector('.sidebar-nav [data-page="home"].active'))await v31RenderHomeLatest(notices.slice(0,1));
    }catch(err){console.warn('Meldingenstatus:',err)}
  }

  setInterval(v31RefreshState,60000);
  setTimeout(v31RefreshState,700);

  const obs=new MutationObserver(mutations=>{
    const onlyPhotoChanges=mutations.every(m=>{
      const target=m.target?.nodeType===1 ? m.target : m.target?.parentElement;
      return !!target?.closest?.('.v26-home-photos, .v25-album-page, .v25-lightbox');
    });
    if(onlyPhotoChanges)return;
    clearTimeout(window.__v6Refresh);
    window.__v6Refresh=setTimeout(refresh,30);
  });
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',refresh);
  window.addEventListener('load',refresh);
  setTimeout(refresh,250);
  setInterval(()=>{
    // v29: dashboard niet meer periodiek verwijderen/opnieuw opbouwen.
    // Hierdoor blijven de twee Home-foto's rustig staan.
    injectDashboard();
    setupAdminBar();
    v10InjectAdminMailButton();
    v11Polish();
    v16OrderNavigation();
    v18ColorDayparts();
    v25EnsurePhotoAlbumNav();
    v25OrderPhotoNav();
    v31EnsureNav();
  },5000);

  // v30: stille controle iedere 90 seconden.
  // Alleen wanneer de twee nieuwste bestanden veranderen wordt Home opnieuw bijgewerkt.
  setInterval(v30CheckForNewHomePhotos,90000);

})();
