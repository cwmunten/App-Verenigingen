(() => {
  'use strict';
  const STORAGE_KEY = 'vappie-data-v2';
  const SUPABASE_CONFIG_KEY = 'vappie-supabase-config-v1';
  const SUPABASE_LINKED_KEY = 'vappie-supabase-linked-v1';
  const SUPABASE_DIRTY_KEY = 'vappie-supabase-dirty-v1';
  const SUPABASE_ROW_ID = 'main';
  const DEFAULT_SUPABASE_CONFIG = Object.freeze({
    url: 'https://ngijjzcizhwoeieaelgz.supabase.co',
    key: 'sb_publishable_fQFpxmC6XeNeJ0yOv52S7g_VIbs2jLg'
  });
  const DAYS = ['Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
  const PARTS = ['Middag','Avond'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const uid = p => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const money = n => new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(n||0));
  const norm = s => String(s||'').toLocaleLowerCase('nl-NL').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const attr = esc;

  function durationHours(from,to){
    if(!from||!to) return 0;
    const [fh,fm]=from.split(':').map(Number), [th,tm]=to.split(':').map(Number);
    let a=fh*60+fm,b=th*60+tm; if(b<=a)b+=1440; return (b-a)/60;
  }
  function amount(shift,a,rate){ return durationHours(shift.from,shift.to)*Number(shift.people||0)*Number(a?.rateOverride ?? rate ?? 0); }
  function load(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||clone(window.VAPPIE_SEED)}catch{return clone(window.VAPPIE_SEED)} }
  let db=load(), page='home', searchQuery='', filters={day:'',daypart:'',bar:'',associationId:''}, adminQuery='';
  const app=document.getElementById('app');

  let supabaseClient=null, supabaseUser=null, supabaseStatus='local', supabasePushTimer=null;
  const getSupabaseConfig=()=>{try{return JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY))||DEFAULT_SUPABASE_CONFIG}catch{return DEFAULT_SUPABASE_CONFIG}};
  const isSupabaseLinked=()=>localStorage.getItem(SUPABASE_LINKED_KEY)==='1';
  const isSupabaseDirty=()=>localStorage.getItem(SUPABASE_DIRTY_KEY)==='1';
  const setSupabaseDirty=v=>v?localStorage.setItem(SUPABASE_DIRTY_KEY,'1'):localStorage.removeItem(SUPABASE_DIRTY_KEY);
  const validRemoteData=x=>x&&typeof x==='object'&&x.years&&typeof x.years==='object';
  let lastSyncAt=null;
  function syncLabel(){
    if(!supabaseUser)return 'Niet aangemeld';
    if(!isSupabaseLinked())return 'Aangemeld';
    if(supabaseStatus==='syncing'||isSupabaseDirty())return 'Synchroniseren…';
    if(supabaseStatus==='error')return 'Offline · lokaal';
    return 'Gesynchroniseerd';
  }
  function syncClass(){return !supabaseUser?'neutral':supabaseStatus==='error'?'bad':(supabaseStatus==='syncing'||isSupabaseDirty())?'busy':'ok'}
  function updateSyncChip(){
    const chip=document.getElementById('syncChip');
    if(!chip)return;
    chip.className=`sync-chip ${syncClass()}`;
    chip.innerHTML=`<span></span><b>${esc(syncLabel())}</b>`;
    chip.title=lastSyncAt?`Laatste synchronisatie: ${lastSyncAt.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Supabase synchronisatiestatus';
  }

  function save({sync=true}={}){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
    if(sync&&isSupabaseLinked()){
      setSupabaseDirty(true);
      supabaseStatus='syncing';
      updateSyncChip();
      queueRemotePush();
    }
  }
  function queueRemotePush(){
    if(!supabaseClient||!supabaseUser||!isSupabaseLinked())return;
    clearTimeout(supabasePushTimer);
    supabasePushTimer=setTimeout(()=>pushRemote().catch(err=>console.warn('Supabase opslaan uitgesteld:',err)),450);
  }
  async function pushRemote(){
    if(!supabaseClient||!supabaseUser)throw new Error('Niet aangemeld bij Supabase.');
    supabaseStatus='syncing'; updateSyncChip();
    const payload=clone(db);
    const {error}=await supabaseClient.from('vappie_state').upsert({id:SUPABASE_ROW_ID,data:payload,updated_by:supabaseUser.id,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error){supabaseStatus='error';updateSyncChip();throw error;}
    setSupabaseDirty(false); supabaseStatus='connected'; lastSyncAt=new Date(); updateSyncChip();
    return true;
  }
  async function pullRemote({renderAfter=false,force=false}={}){
    if(!supabaseClient||!supabaseUser)throw new Error('Niet aangemeld bij Supabase.');
    if(isSupabaseDirty()&&!force){
      try{await pushRemote()}catch(err){console.warn('Lokale wijzigingen konden nog niet naar Supabase; ophalen overgeslagen.',err);return false;}
    }
    supabaseStatus='syncing'; updateSyncChip();
    const {data,error}=await supabaseClient.from('vappie_state').select('data,updated_at').eq('id',SUPABASE_ROW_ID).maybeSingle();
    if(error){supabaseStatus='error';updateSyncChip();throw error;}
    if(!data||!validRemoteData(data.data)){supabaseStatus='connected';lastSyncAt=new Date();updateSyncChip();return false;}
    const localYear=db.activeYear;
    db=clone(data.data);
    if(localYear&&db.years[localYear])db.activeYear=localYear;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
    setSupabaseDirty(false); supabaseStatus='connected'; lastSyncAt=new Date(); updateSyncChip();
    if(renderAfter)render();
    return true;
  }
  function loadSupabaseLibrary(){
    if(window.supabase?.createClient)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-vappie-supabase]');
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('Supabase-module kon niet worden geladen.')),{once:true});return;}
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.async=true;script.dataset.vappieSupabase='1';
      const timer=setTimeout(()=>reject(new Error('Supabase-module laden duurde te lang.')),10000);
      script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);reject(new Error('Supabase-module kon niet worden geladen.'))};document.head.appendChild(script);
    });
  }
  async function initSupabase(){
    const cfg=getSupabaseConfig();
    if(!cfg?.url||!cfg?.key){supabaseStatus='local';return false;}
    try{
      await loadSupabaseLibrary();
      supabaseClient=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const {data:{session}}=await supabaseClient.auth.getSession();
      supabaseUser=session?.user||null;
      supabaseStatus=supabaseUser?'connected':'configured';
      supabaseClient.auth.onAuthStateChange((event,sessionNow)=>{
        supabaseUser=sessionNow?.user||null;
        supabaseStatus=supabaseUser?'connected':'configured';
        if(event==='SIGNED_OUT') showLoginGate();
        else updateSyncChip();
      });
      return true;
    }catch(err){
      console.warn('Supabase initialisatie mislukt; lokale Vappie blijft beschikbaar.',err);
      supabaseStatus='error';
      return false;
    }
  }

  function showLoginGate(message=''){
    app.innerHTML=`<main class="login-screen"><section class="login-shell">
      <aside class="login-visual">
        <div class="login-visual-brand"><span class="brand-mark">Z</span><div><strong>Vappie</strong><small>TEAM VERENIGINGEN</small></div></div>
        <div class="login-visual-copy">
          <span class="login-label">ZOMERPARKFEEST · TEAM VERENIGINGEN</span>
          <h2>Alles voor de verenigingen.<br>Op één plek.</h2>
          <p>Planning, bezetting, administratie en financiën centraal en altijd gesynchroniseerd.</p>
          <div class="login-feature"><i>✓</i><span>Veilig gekoppeld met Supabase</span></div>
          <div class="login-feature"><i>✓</i><span>Lokale back-up blijft beschikbaar</span></div>
          <div class="login-feature"><i>✓</i><span>Automatische synchronisatie</span></div>
        </div>
        <div class="login-visual-footer"><span class="brand-mark mini">Z</span><span>Samen maken<br>we het feest!</span></div>
      </aside>
      <section class="login-card login-panel">
        <div class="login-brand mobile-login-brand"><span class="brand-mark">Z</span><div><strong>Vappie</strong><small>TEAM VERENIGINGEN</small></div></div>
        <div class="login-panel-inner">
          <div class="hero-kicker">VEILIG AANMELDEN</div>
          <h1>Welkom terug</h1>
          <p>Meld je aan om Vappie te openen. Je Supabase-sessie wordt op dit apparaat onthouden.</p>
          ${message?`<div class="login-message">${esc(message)}</div>`:''}
          <form id="startupLoginForm" class="login-form">
            <label class="field"><span>E-mailadres</span><input id="startupEmail" type="email" autocomplete="username" required placeholder="naam@voorbeeld.nl"></label>
            <label class="field"><span>Wachtwoord</span><input id="startupPassword" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
            <button class="primary login-submit" type="submit">Inloggen bij Vappie <span>→</span></button>
          </form>
          <button class="text-btn offline-open" id="offlineOpen">Offline lokaal openen</button>
          <small class="login-foot">Geen verbinding? Je kunt Vappie lokaal blijven gebruiken. Synchronisatie hervat na opnieuw aanmelden.</small>
        </div>
      </section>
    </section></main>`;
    document.getElementById('startupLoginForm').onsubmit=startupLogin;
    document.getElementById('offlineOpen').onclick=()=>{supabaseStatus='error';render();};
  }

  async function startupLogin(e){
    e.preventDefault();
    const btn=e.currentTarget.querySelector('button[type="submit"]');
    const email=document.getElementById('startupEmail').value.trim();
    const password=document.getElementById('startupPassword').value;
    btn.disabled=true;btn.textContent='Aanmelden…';
    try{
      if(!supabaseClient){const ok=await initSupabase();if(!ok||!supabaseClient)throw new Error('Supabase kon niet worden bereikt.');}
      const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
      if(error)throw error;
      supabaseUser=data.user; supabaseStatus='connected';
      await testSupabaseAccess();
      if(isSupabaseLinked()){
        try{await pullRemote();}catch(err){console.warn('Startsync mislukt; lokale gegevens blijven beschikbaar.',err);}
      }
      render();
    }catch(err){showLoginGate(`Inloggen mislukt: ${err?.message||err}`);}
  }

  async function boot(){
    const available=await initSupabase();
    if(!available){showLoginGate('Supabase is momenteel niet bereikbaar. Je kunt eventueel offline lokaal verder werken.');return;}
    if(!supabaseUser){showLoginGate();return;}
    if(isSupabaseLinked()){
      try{await pullRemote();}catch(err){console.warn('Supabase start-sync mislukt; lokale Vappie blijft actief.',err);supabaseStatus='error';}
    }
    render();
  }
  const yd=()=>db.years[db.activeYear];
  const assoc=id=>yd().associations.find(a=>a.id===id);
  const sortedYears=()=>Object.keys(db.years).sort((a,b)=>Number(b)-Number(a));

  function render(){
    const userEmail=supabaseUser?.email||'Vappie gebruiker';
    app.innerHTML=`
      <div class="dashboard-shell">
        <aside class="sidebar" id="nav">
          <div class="sidebar-brand" data-page="home"><span class="brand-mark">Z</span><span><strong>Vappie</strong><small>TEAM VERENIGINGEN</small></span></div>
          <button class="nav-close" data-action="mobile-menu" aria-label="Menu sluiten">×</button>
          <nav class="sidebar-nav">
            ${navBtn('home','⌂','Home')}${navBtn('planning','▣','Planning')}${navBtn('occupancy','◉','Bezettingsoverzicht')}${navBtn('admin','☷','Administratie')}${navBtn('financial','€','Financieel')}<button class="install-app-btn" data-action="install-app"><b>⇩</b><span>Installeer Vappie</span></button>
            <button data-action="data"><b>⇧</b><span>Data / back-up</span></button>
          </nav>
          <div class="sidebar-foot">
            <div><strong>Vappie</strong> · ${esc(db.activeYear)}</div>
            <small>© Zomerparkfeest Venlo</small>
            <div class="sidebar-tagline"><span class="brand-mark mini">Z</span><b>Samen maken<br>we het feest!</b></div>
          </div>
        </aside>
        <section class="workspace">
          <header class="workspace-topbar">
            <button class="mobile-menu" data-action="mobile-menu" aria-label="Menu openen">☰</button>
            <button class="sync-chip ${syncClass()}" id="syncChip" data-action="data" title="Supabase synchronisatiestatus"><span></span><b>${esc(syncLabel())}</b></button>
            <div class="topbar-spacer"></div>
            <div class="year-select compact">▦ <select id="yearSelect">${sortedYears().map(y=>`<option ${y===db.activeYear?'selected':''}>${esc(y)}</option>`).join('')}</select></div>
            <button class="icon-btn" data-action="new-year" title="Nieuw jaar">＋</button>
            <button class="user-chip" data-action="data" title="Account en synchronisatie"><span class="user-avatar">●</span><span>${esc(userEmail)}</span></button>
          </header>
          <main class="workspace-main ${page==='home'?'home-main':'main'}">${renderPage()}</main>
        </section>
      </div>
      <div id="modalRoot"></div>`;
    bindGlobal();
    if(page==='home') bindHome();
    if(page==='planning') bindPlanning();
    if(page==='financial') bindFinancial();
    if(page==='admin') bindAdmin();
  }
  function navBtn(id,icon,label){return `<button data-page="${id}" class="${page===id?'active':''}"><b>${icon}</b><span>${label}</span></button>`}
  function renderPage(){ return page==='home'?homeHtml():page==='planning'?planningHtml():page==='financial'?financialHtml():page==='occupancy'?occupancyHtml():adminHtml(); }

  function homeHtml(){
    const q=norm(searchQuery), matches=q.length>=2?yd().associations.filter(a=>norm(a.name).includes(q)||norm(a.barchef).includes(q)||norm(a.planningName).includes(q)).slice(0,12):[];
    return `<section class="search-hero">
      <div class="hero-kicker">ZOMERPARKFEEST · ${esc(db.activeYear)}</div><h1>Wie zoek je?</h1><p>Zoek op vereniging of naam van de barchef.</p>
      <div class="hero-search"><span class="search-icon">⌕</span><input id="mainSearch" autocomplete="off" value="${attr(searchQuery)}" placeholder="Bijv. Scouting, Civitas of Ron Janssen..."></div>
      ${searchQuery.length===1?'<div class="search-hint">Typ minimaal 2 tekens.</div>':''}
      ${q.length>=2&&matches.length===0?'<div class="empty-card"><b>⌕</b><strong>Niets gevonden</strong><span>Zoek op een deel van de naam.</span></div>':''}
      <div class="search-results">${matches.map(resultHtml).join('')}</div>
    </section>`;
  }
  function resultHtml(a){
    const shifts=yd().shifts.filter(s=>s.associationId===a.id).sort(shiftSort);
    const total=shifts.reduce((n,s)=>n+amount(s,a,yd().rate),0);
    const personHours=shifts.reduce((n,s)=>n+durationHours(s.from,s.to)*Number(s.people||0),0);
    const people=shifts.reduce((n,s)=>n+Number(s.people||0),0);
    const rate=Number(a.rateOverride ?? yd().rate ?? 0);
    const adminItems=[
      ['Naam vereniging',a.name],['Naam Barchef',a.barchef||'—'],['Telefoon Barchef',a.phone||'—'],['E-mail Barchef',a.email||'—'],
      ['Naam in planning',a.planningName||'—'],['Barchefmeeting 1',a.meeting1||'Onbekend'],['Barchefmeeting 2',a.meeting2||'Onbekend'],
      ['Certificaten aanwezig',a.certificates||'Onbekend'],['Polsbandjes ontvangen',a.wristbands||'Onbekend'],['Maten kleding ingeleverd',a.shirts||'Onbekend'],
      ['Eetbonnen nodig',a.mealVouchers||'—'],['Extra info / opmerkingen',a.notes||'—']
    ];
    return `<article class="result-card"><div class="result-head"><div><span class="eyebrow">VERENIGING</span><h2>${esc(a.name)}</h2>${a.planningName!==a.name?`<small>Planningnaam: ${esc(a.planningName)}</small>`:''}</div><div class="earnings"><span>Totale inkomsten</span><strong>${money(total)}</strong></div></div>
      <div class="contact-strip"><span>● ${esc(a.barchef||'Geen barchef')}</span><a ${a.phone?`href="tel:${attr(a.phone)}"`:''}>☎ ${esc(a.phone||'Geen telefoon')}</a><a ${a.email?`href="mailto:${attr(a.email)}"`:''}>✉ ${esc(a.email||'Geen e-mail')}</a></div>
      <div class="home-detail-section"><div class="home-section-title">Administratie</div><div class="home-admin-grid">${adminItems.map(([label,value])=>`<div class="home-admin-item"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div></div>
      <div class="home-detail-section finance-section"><div class="home-section-title">Financieel</div><div class="home-finance-grid">
        <div><span>Totale inkomsten</span><strong>${money(total)}</strong></div><div><span>Tarief p.p. / uur</span><strong>${money(rate)}</strong></div><div><span>Aantal diensten</span><strong>${shifts.length}</strong></div><div><span>Persoonsuren</span><strong>${personHours.toFixed(1)}</strong></div><div><span>Ingeplande personen</span><strong>${people}</strong></div>
      </div></div>
      <div class="home-detail-section"><div class="home-section-title">Diensten</div><div class="shift-list"><div class="shift-header"><span>Dag</span><span>Bar</span><span>Tijd</span><span>Personen</span><span>Bedrag</span></div>
      ${shifts.length?shifts.map(s=>`<div class="shift-row"><span><strong>${esc(s.day)}</strong><small>${esc(s.daypart)}</small></span><span>⌖ ${esc(s.bar)}</span><span>◷ ${esc(s.from)}–${esc(s.to)}</span><span>${s.people}</span><span>${money(amount(s,a,yd().rate))}</span></div>`).join(''):'<div class="no-shifts">Geen diensten gepland voor dit jaar.</div>'}</div></div></article>`;
  }

  function pageHeader(kicker,title,subtitle,action=''){return `<div class="page-header"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`}
  function planningHtml(){
    const bars=[...new Set([...Object.keys(yd().barCaps||{}),...yd().shifts.map(s=>s.bar)])].filter(Boolean).sort();
    const associations=yd().associations.slice().sort((a,b)=>a.name.localeCompare(b.name,'nl'));
    const list=yd().shifts.filter(s=>(!filters.day||s.day===filters.day)&&(!filters.daypart||s.daypart===filters.daypart)&&(!filters.bar||s.bar===filters.bar)&&(!filters.associationId||s.associationId===filters.associationId)).sort(shiftSort);
    const assocFilter=`<label class="filter-select"><span>Vereniging</span><select data-filter="associationId"><option value="">Alles</option>${associations.map(a=>`<option value="${attr(a.id)}" ${filters.associationId===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>`;
    return `${pageHeader('PLANNING','Wie staat waar?','Filter, wijzig of voeg diensten toe.','<button class="primary" data-action="add-shift">＋ Dienst toevoegen</button>')}
      <div class="filterbar">${selectFilter('day','Dag',DAYS)}${selectFilter('daypart','Dagdeel',PARTS)}${selectFilter('bar','Bar',bars)}${assocFilter}<button class="text-btn" data-action="clear-filters">Filters wissen</button><span class="count">${list.length} diensten</span></div>
      <div class="table-card"><div class="table-scroll"><table><thead><tr><th>Dag</th><th>Dagdeel</th><th>Bar</th><th>Vereniging</th><th>Tijd</th><th class="num">Personen</th><th></th></tr></thead><tbody>
      ${list.map(s=>{const a=assoc(s.associationId);return `<tr><td><strong>${esc(s.day)}</strong></td><td><span class="pill">${esc(s.daypart)}</span></td><td>${esc(s.bar)}</td><td><button class="association-link" data-view-assoc="${attr(a?.id||'')}" title="Bekijk volledige gegevens van ${attr(a?.name||'deze vereniging')}"><strong>${esc(a?.planningName||a?.name||'Onbekend')}</strong><small>${esc(a?.barchef||'')}</small><em>Bekijk gegevens →</em></button></td><td>${esc(s.from)} – ${esc(s.to)}</td><td class="num">${s.people}</td><td class="actions"><button data-edit-shift="${attr(s.id)}">✎</button><button data-delete-shift="${attr(s.id)}">⌫</button></td></tr>`}).join('')}</tbody></table></div></div>`;
  }
  function selectFilter(key,label,opts){return `<label class="filter-select"><span>${label}</span><select data-filter="${key}"><option value="">Alles</option>${opts.map(o=>`<option ${filters[key]===o?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`}
  function shiftSort(a,b){return DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||PARTS.indexOf(a.daypart)-PARTS.indexOf(b.daypart)||String(a.bar).localeCompare(String(b.bar),'nl')}

  function financialHtml(){
    const am=Object.fromEntries(yd().associations.map(a=>[a.id,a]));
    const rows=yd().associations.map(a=>{const ss=yd().shifts.filter(s=>s.associationId===a.id);return {a,services:ss.length,hours:ss.reduce((n,s)=>n+durationHours(s.from,s.to)*s.people,0),amount:ss.reduce((n,s)=>n+amount(s,a,yd().rate),0)}}).filter(r=>r.services).sort((a,b)=>b.amount-a.amount);
    const total=rows.reduce((n,r)=>n+r.amount,0), hours=rows.reduce((n,r)=>n+r.hours,0), persons=yd().shifts.reduce((n,s)=>n+s.people,0);
    const byDay=DAYS.map(day=>({day,amount:yd().shifts.filter(s=>s.day===day).reduce((n,s)=>n+amount(s,am[s.associationId],yd().rate),0)})).filter(x=>x.amount>0); const max=Math.max(1,...byDay.map(x=>x.amount));
    return `${pageHeader('FINANCIEEL','Verdiensten in beeld',`Berekend met standaardtarief ${money(yd().rate)} per persoon per uur; uitzonderingen zijn per vereniging mogelijk.`)}
      <div class="kpis">${kpi('Totale vergoeding',money(total))}${kpi('Persoonsuren',Math.round(hours).toLocaleString('nl-NL'))}${kpi('Ingeplande personen',persons.toLocaleString('nl-NL'))}${kpi('Verenigingen met diensten',rows.length)}</div>
      <div class="two-col"><div class="table-card"><div class="card-title">Per vereniging</div><div class="table-scroll"><table><thead><tr><th>Vereniging</th><th class="num">Diensten</th><th class="num">Persoonsuren</th><th class="num">Bedrag</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.a.name)}</strong>${r.a.rateOverride===0?'<small>€ 0,00 tarief</small>':''}</td><td class="num">${r.services}</td><td class="num">${r.hours.toFixed(1)}</td><td class="num"><strong>${money(r.amount)}</strong></td></tr>`).join('')}</tbody></table></div></div>
      <div class="side-card"><div class="card-title">Kosten per dag</div>${byDay.map(x=>`<div class="bar-stat"><div><strong>${x.day}</strong><span>${money(x.amount)}</span></div><div class="bar-track"><i style="width:${(x.amount/max)*100}%"></i></div></div>`).join('')}</div></div>`;
  }
  function kpi(label,value,sub=''){return `<div class="kpi"><span>${label}</span><strong>${value}</strong>${sub?`<small>${sub}</small>`:''}</div>`}

  function occupancyHtml(){
    const byDay=DAYS.map(day=>{const ss=yd().shifts.filter(s=>s.day===day);return {day,services:ss.length,people:ss.reduce((n,s)=>n+s.people,0)}}).filter(x=>x.services);
    const bars=[...new Set(yd().shifts.map(s=>s.bar))].map(bar=>{const ss=yd().shifts.filter(s=>s.bar===bar), people=ss.reduce((n,s)=>n+s.people,0);return {bar,services:ss.length,people,avg:ss.length?people/ss.length:0,cap:yd().barCaps?.[bar]||0}}).sort((a,b)=>b.people-a.people);
    const top=[...byDay].sort((a,b)=>b.people-a.people)[0];
    return `${pageHeader('BEZETTING','Bezettingsoverzicht','Snel zien hoeveel mensen per dag en per bar zijn ingepland.')}
      <div class="kpis">${kpi('Totaal diensten',yd().shifts.length)}${kpi('Totaal ingepland',yd().shifts.reduce((n,s)=>n+s.people,0).toLocaleString('nl-NL'))}${kpi('Drukste dag',top?.day||'—',top?`${top.people} personen`:'')}${kpi('Aantal bars',bars.length)}</div>
      <div class="two-col"><div class="table-card"><div class="card-title">Per bar</div><div class="table-scroll"><table><thead><tr><th>Bar</th><th class="num">Diensten</th><th class="num">Personen</th><th class="num">Gem./dienst</th><th class="num">Richtcapaciteit</th></tr></thead><tbody>${bars.map(r=>`<tr><td><strong>${esc(r.bar)}</strong></td><td class="num">${r.services}</td><td class="num">${r.people}</td><td class="num">${r.avg.toFixed(1)}</td><td class="num">${r.cap||'—'}</td></tr>`).join('')}</tbody></table></div></div><div class="side-card"><div class="card-title">Per dag</div>${byDay.map(x=>`<div class="day-stat"><span>${x.day}<small>${x.services} diensten</small></span><strong>${x.people}</strong></div>`).join('')}</div></div>`;
  }

  function adminHtml(){
    const q=norm(adminQuery), list=yd().associations.filter(a=>!q||[a.name,a.barchef,a.email,a.phone,a.planningName,a.notes].some(v=>norm(v||'').includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'nl'));
    return `${pageHeader('ADMINISTRATIE','Volledig administratief overzicht','Alle gegevens uit het Excel-tabblad “Verenigingen & Administratie”. Wijzigen kan via het potloodje.',`<div class="header-actions"><button class="secondary" data-action="import-excel">⇧ Excel importeren</button><button class="secondary" data-action="export-report">⇩ Rapport exporteren</button><button class="primary" data-action="add-assoc">＋ Vereniging toevoegen</button></div>`)}
      <div class="admin-tools"><div class="mini-search">⌕ <input id="adminSearch" value="${attr(adminQuery)}" placeholder="Zoek vereniging, barchef, e-mail, telefoon of opmerking..."></div><span class="count">${list.length} verenigingen</span></div>
      <div class="table-card admin-full-table"><div class="table-scroll"><table><thead><tr>
        <th>Naam vereniging</th><th>Naam Barchef 1</th><th>E-mail adres Barchef 1</th><th>Telefoonnummer Barchef 1</th><th>Naam in planning</th>
        <th>Aanwezig Barchefmeeting 1</th><th>Aanwezig Barchefmeeting 2</th><th>Certificaten aanwezig</th><th>Polsbandjes ontvangen</th>
        <th>Maten kleding ingeleverd</th><th>Eetbonnen nodig</th><th>Opmerkingen</th><th></th>
      </tr></thead><tbody>${list.map(a=>`<tr>
        <td><strong>${esc(a.name)}</strong></td><td>${esc(a.barchef||'—')}</td><td>${esc(a.email||'—')}</td><td>${esc(a.phone||'—')}</td><td>${esc(a.planningName||'—')}</td>
        <td>${status(a.meeting1)}</td><td>${status(a.meeting2)}</td><td>${status(a.certificates)}</td><td>${status(a.wristbands)}</td><td>${status(a.shirts)}</td>
        <td>${esc(a.mealVouchers||'—')}</td><td class="admin-notes">${esc(a.notes||'—')}</td><td class="actions sticky-actions"><button title="Wijzigen" data-edit-assoc="${attr(a.id)}">✎</button><button title="Verwijderen" data-delete-assoc="${attr(a.id)}">⌫</button></td>
      </tr>`).join('')}</tbody></table></div></div>`;
  }
  function status(v){return `<span class="status ${String(v).toLowerCase()==='ja'?'good':'neutral'}">${esc(v||'Onbekend')}</span>`}

  let deferredInstallPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;document.querySelectorAll('.install-app-btn').forEach(b=>b.hidden=false)});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;document.querySelectorAll('.install-app-btn').forEach(b=>b.hidden=true)});
  function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
  function installApp(){
    if(isStandalone())return alert('Vappie is al als app geïnstalleerd op dit apparaat.');
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(()=>{deferredInstallPrompt=null});
      return;
    }
    const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    const text=isiOS
      ? '<div class="install-help"><div class="install-icon-preview"><span class="brand-mark">Z</span></div><h3>Vappie op je beginscherm</h3><p>Open Vappie in <b>Safari</b>, tik onderin op <b>Delen</b> (vierkant met pijltje omhoog) en kies <b>Zet op beginscherm</b>. Daarna opent Vappie als zelfstandige app met het gele Z-icoon.</p></div>'
      : '<div class="install-help"><div class="install-icon-preview"><span class="brand-mark">Z</span></div><h3>Vappie installeren</h3><p>Open het browsermenu en kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b>. Vappie gebruikt daarna het gele Z-icoon.</p></div>';
    showModal('Vappie installeren',text,null,false);
  }

  function bindGlobal(){
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page; render()});
    document.getElementById('yearSelect').onchange=e=>{db.activeYear=e.target.value;save({sync:false});render()};
    document.querySelectorAll('[data-action="mobile-menu"]').forEach(b=>b.onclick=()=>document.getElementById('nav')?.classList.toggle('open'));
    document.querySelector('[data-action="new-year"]').onclick=newYear;
    document.querySelectorAll('[data-action="data"]').forEach(b=>b.onclick=dataModal);
    document.querySelectorAll('[data-action="install-app"]').forEach(b=>{b.onclick=installApp;b.hidden=isStandalone()});
  }
  function bindHome(){
    const input=document.getElementById('mainSearch'); input.oninput=e=>{searchQuery=e.target.value; const pos=e.target.selectionStart; render(); const n=document.getElementById('mainSearch'); n.focus(); n.setSelectionRange(pos,pos)}; input.focus();
  }
  function bindPlanning(){
    document.querySelectorAll('[data-filter]').forEach(s=>s.onchange=e=>{filters[e.target.dataset.filter]=e.target.value;render()});
    document.querySelector('[data-action="clear-filters"]').onclick=()=>{filters={day:'',daypart:'',bar:'',associationId:''};render()};
    document.querySelector('[data-action="add-shift"]').onclick=()=>shiftModal();
    document.querySelectorAll('[data-edit-shift]').forEach(b=>b.onclick=()=>shiftModal(yd().shifts.find(s=>s.id===b.dataset.editShift)));
    document.querySelectorAll('[data-delete-shift]').forEach(b=>b.onclick=()=>{if(confirm('Deze dienst verwijderen?')){yd().shifts=yd().shifts.filter(s=>s.id!==b.dataset.deleteShift);save();render()}});
    document.querySelectorAll('[data-view-assoc]').forEach(b=>b.onclick=()=>associationDetailModal(b.dataset.viewAssoc));
  }
  function bindFinancial(){}

  function reportRows(associationId='all'){
    return yd().associations
      .filter(a=>associationId==='all'||a.id===associationId)
      .map(a=>{
        const shifts=yd().shifts.filter(s=>s.associationId===a.id).sort(shiftSort);
        const income=shifts.reduce((n,s)=>n+amount(s,a,yd().rate),0);
        const byDay=Object.fromEntries(DAYS.map(day=>[day,shifts.filter(s=>s.day===day)]));
        return {a,shifts,income,byDay};
      })
      .filter(r=>r.shifts.length>0)
      .sort((x,y)=>x.a.name.localeCompare(y.a.name,'nl'));
  }

  function reportDayText(shifts){
    return (shifts||[]).map(s=>`${s.daypart} · ${s.bar} · ${s.people} pers. · ${s.from}–${s.to}`).join(' | ');
  }

  function reportModal(){
    const assocs=yd().associations.slice().sort((a,b)=>a.name.localeCompare(b.name,'nl'));
    const body=`<div class="data-panel">
      <div class="notice"><b>i</b><div><strong>Rapport ${esc(db.activeYear)}</strong><p>De gewerkte diensten worden per dag in een aparte kolom weergegeven. Exporteer één vereniging of alle verenigingen met diensten.</p></div></div>
      ${field('Vereniging',`<select id="reportAssoc"><option value="all">Alle verenigingen met diensten</option>${assocs.map(a=>`<option value="${attr(a.id)}">${esc(a.name)}</option>`).join('')}</select>`)}
      <div class="data-actions report-actions"><button class="primary" id="reportPrint">▣ Afdrukken / PDF</button><button class="secondary" id="reportCsv">⇩ CSV voor Excel</button></div>
    </div>`;
    showModal('Rapport exporteren',body,null,false);
    document.getElementById('reportPrint').onclick=()=>printReport(val('reportAssoc'));
    document.getElementById('reportCsv').onclick=()=>downloadReportCsv(val('reportAssoc'));
  }

  function csvCell(v){
    const x=String(v??'').replace(/"/g,'""');
    return `"${x}"`;
  }

  function downloadReportCsv(associationId){
    const rows=reportRows(associationId);
    if(!rows.length) return alert('Voor deze selectie zijn geen diensten gevonden.');
    const header=['Naam vereniging','Naam Barchef','Telefoon Barchef','Email Barchef',...DAYS,'Inkomsten','Extra info'];
    const lines=[header.map(csvCell).join(';')];
    rows.forEach(r=>lines.push([
      r.a.name,r.a.barchef||'',r.a.phone||'',r.a.email||'',
      ...DAYS.map(day=>reportDayText(r.byDay[day])),
      Number(r.income).toFixed(2).replace('.',','),r.a.notes||''
    ].map(csvCell).join(';')));
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    const suffix=associationId==='all'?'alle-verenigingen':(assoc(associationId)?.name||'vereniging').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
    a.href=url;a.download=`vappie-rapport-${db.activeYear}-${suffix}.csv`;a.click();URL.revokeObjectURL(url);
  }

  function printReport(associationId){
    const rows=reportRows(associationId);
    if(!rows.length) return alert('Voor deze selectie zijn geen diensten gevonden.');
    const total=rows.reduce((n,r)=>n+r.income,0);
    const generated=new Intl.DateTimeFormat('nl-NL',{dateStyle:'long',timeStyle:'short'}).format(new Date());
    const bodyRows=rows.map(r=>`<tr>
      <td><strong>${esc(r.a.name)}</strong></td><td>${esc(r.a.barchef||'—')}</td><td>${esc(r.a.phone||'—')}</td><td>${esc(r.a.email||'—')}</td>
      ${DAYS.map(day=>`<td class="day-cell">${r.byDay[day].length?r.byDay[day].map(s=>`<div class="service"><b>${esc(s.daypart)}</b><br>${esc(s.bar)}<br>${s.people} pers. · ${esc(s.from)}–${esc(s.to)}</div>`).join(''):'—'}</td>`).join('')}
      <td class="income">${money(r.income)}</td><td>${esc(r.a.notes||'—').replace(/\n/g,'<br>')}</td>
    </tr>`).join('');
    const w=window.open('','_blank');
    if(!w) return alert('Het printvenster is geblokkeerd door de browser. Sta pop-ups voor Vappie toe en probeer opnieuw.');
    w.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Vappie rapport ${esc(db.activeYear)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;margin:0;background:#fff}main{padding:18px}.report-top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:5px solid #171717;padding-bottom:10px;margin-bottom:14px}.logo{font:900 30px Arial Black,Arial,sans-serif;text-transform:uppercase}.logo i{font-style:normal;background:#ff3f93;padding:3px 8px;margin-right:8px}.meta{text-align:right;color:#666;font-size:10px}.summary{display:flex;justify-content:space-between;background:#f3e800;padding:9px 12px;margin-bottom:14px;font-weight:700;font-size:11px}.report-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8px}.report-table th{background:#171717;color:#fff;text-align:left;padding:6px 5px;font-size:7px;text-transform:uppercase;letter-spacing:.3px}.report-table td{padding:6px 5px;border:1px solid #ddd;vertical-align:top;word-break:break-word}.report-table th:nth-child(1){width:11%}.report-table th:nth-child(2){width:8%}.report-table th:nth-child(3){width:7%}.report-table th:nth-child(4){width:10%}.report-table th:nth-child(n+5):nth-child(-n+9){width:9%}.report-table th:nth-child(10){width:7%}.report-table th:nth-child(11){width:11%}.service{padding:0 0 5px;margin-bottom:5px;border-bottom:1px dotted #bbb;line-height:1.25}.service:last-child{border-bottom:0;margin-bottom:0}.income{font-weight:800;white-space:nowrap}.day-cell{background:#fcfbf7}@media print{main{padding:0}.report-top{margin-top:0}.report-table tr{break-inside:avoid}@page{size:A3 landscape;margin:7mm}}
    </style></head><body><main><header class="report-top"><div class="logo"><i>Z</i>Vappie</div><div class="meta">Zomerparkfeest · ${esc(db.activeYear)}<br>Gegenereerd: ${esc(generated)}</div></header><div class="summary"><span>${rows.length} vereniging${rows.length===1?'':'en'}</span><span>Totaal inkomsten: ${money(total)}</span></div><table class="report-table"><thead><tr><th>Naam vereniging</th><th>Barchef</th><th>Telefoon</th><th>E-mail</th>${DAYS.map(d=>`<th>${d}</th>`).join('')}<th>Inkomsten</th><th>Extra info</th></tr></thead><tbody>${bodyRows}</tbody></table></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));<\/script></body></html>`);
    w.document.close();
  }

  function importExcelModal(){
    const body=`<div class="data-panel">
      <div class="notice"><b>i</b><div><strong>Excel import voor ${esc(db.activeYear)}</strong><p>Vappie leest het tabblad <b>Verenigingen & Administratie</b> en voor de planning bij voorkeur <b>Werkschema</b>. De gekozen onderdelen vervangen de huidige gegevens van dit festivaljaar.</p></div></div>
      <div class="import-options">
        <label><input type="checkbox" id="importAdmin" checked> Administratie importeren</label>
        <label><input type="checkbox" id="importPlanning" checked> Planning importeren</label>
      </div>
      <div class="import-warning">Maak bij voorkeur eerst een Vappie-back-up. De import gebeurt volledig lokaal in je browser; het Excelbestand wordt niet geüpload.</div>
      <div class="data-actions"><button class="primary" id="chooseExcel">⇧ Excelbestand kiezen</button><input hidden id="excelFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></div>
    </div>`;
    showModal('Excel importeren',body,null,false);
    document.getElementById('chooseExcel').onclick=()=>document.getElementById('excelFile').click();
    document.getElementById('excelFile').onchange=importExcelFile;
  }

  function excelText(v){ return v==null?'':String(v).trim(); }
  function excelTime(v){
    if(v==null||v==='') return '';
    if(typeof v==='number'){
      const mins=((Math.round((v-Math.floor(v))*1440)%1440)+1440)%1440;
      return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
    }
    const s=String(v).trim();
    const m=s.match(/(\d{1,2})[:.]([0-5]\d)/);
    return m?`${String(Number(m[1])%24).padStart(2,'0')}:${m[2]}`:s;
  }
  function parseDayPart(v){
    const s=excelText(v), n=norm(s);
    const day=DAYS.find(d=>n.includes(norm(d)));
    const daypart=n.includes('middag')?'Middag':n.includes('avond')?'Avond':day==='Woensdag'?'Avond':'';
    return day&&daypart?{day,daypart}:null;
  }
  function headerIndex(headers, wanted){
    const want=norm(wanted);
    return headers.findIndex(h=>norm(h)===want);
  }
  function parseAdminWorkbook(book){
    const sheet=book.Sheets['Verenigingen & Administratie'];
    if(!sheet) throw new Error('Tabblad “Verenigingen & Administratie” niet gevonden.');
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
    const hi=rows.findIndex(r=>norm(r?.[0])==='naam vereniging');
    if(hi<0) throw new Error('Kolom “Naam vereniging” niet gevonden in Administratie.');
    const h=rows[hi].map(excelText);
    const idx={name:headerIndex(h,'Naam vereniging'),barchef:headerIndex(h,'Naam Barchef 1'),email:headerIndex(h,'e-mail adres Barchef 1'),phone:headerIndex(h,'Telefoonnummer Barchef 1'),planningName:headerIndex(h,'Naam in planning'),meeting1:headerIndex(h,'Aanwezig Barchefmeeting 1'),meeting2:headerIndex(h,'Aanwezig Barchefmeeting 2'),certificates:headerIndex(h,'Certificaten aanwezig'),wristbands:headerIndex(h,'Polsbandjes ontvangen'),shirts:headerIndex(h,'Maten kleding ingeleverd'),mealVouchers:headerIndex(h,'Eetbonnen nodig'),notes:headerIndex(h,'Opmerkingen')};
    const old=yd().associations;
    const dataRows=rows.slice(hi+1); const summaryAt=dataRows.findIndex(r=>norm(r?.[0]).includes('samenvatting'));
    return (summaryAt>=0?dataRows.slice(0,summaryAt):dataRows).map(r=>{
      const name=excelText(r[idx.name]); if(!name)return null;
      const planningName=excelText(r[idx.planningName])||name, barchef=excelText(r[idx.barchef]), email=excelText(r[idx.email]);
      const prior=old.find(a=>norm(a.name)===norm(name)||norm(a.planningName)===norm(planningName)||(email&&norm(a.email)===norm(email))||(barchef&&norm(a.barchef)===norm(barchef)));
      return {id:prior?.id||uid('assoc'),name,barchef,email,phone:excelText(r[idx.phone]),planningName,
        meeting1:excelText(r[idx.meeting1])||'Onbekend',meeting2:excelText(r[idx.meeting2])||'Onbekend',certificates:excelText(r[idx.certificates])||'Onbekend',wristbands:excelText(r[idx.wristbands])||'Onbekend',shirts:excelText(r[idx.shirts])||'Onbekend',mealVouchers:excelText(r[idx.mealVouchers])||'Geen',notes:excelText(r[idx.notes]),rateOverride:prior?.rateOverride??null};
    }).filter(Boolean);
  }
  function assocForPlanning(name, associations){
    const n=norm(name), compact=n.replace(/[^a-z0-9]/g,'');
    return associations.find(a=>norm(a.planningName)===n||norm(a.name)===n)||associations.find(a=>norm(a.planningName).replace(/[^a-z0-9]/g,'')===compact||norm(a.name).replace(/[^a-z0-9]/g,'')===compact);
  }
  function ensureImportedAssoc(name, associations, barchef='', email=''){
    let a=assocForPlanning(name,associations);
    if(!a&&email)a=associations.find(x=>norm(x.email)===norm(email));
    if(!a&&barchef)a=associations.find(x=>norm(x.barchef)===norm(barchef));
    if(a)return a;
    a={id:uid('assoc'),name:excelText(name),planningName:excelText(name),barchef:excelText(barchef),phone:'',email:excelText(email),meeting1:'Onbekend',meeting2:'Onbekend',certificates:'Onbekend',wristbands:'Onbekend',shirts:'Onbekend',mealVouchers:'Geen',notes:'Automatisch aangemaakt bij Excel-import van de planning.',rateOverride:null};
    associations.push(a); return a;
  }
  function parseWorkSchedule(book, associations){
    const sheet=book.Sheets['Werkschema'];
    if(!sheet) throw new Error('Tabblad “Werkschema” niet gevonden. Dit tabblad bevat de diensten uit Planning in importeerbare vorm.');
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});
    const shifts=[];
    function addRow(r){
      const dp=parseDayPart(r[0]); if(!dp)return;
      const from=excelTime(r[1]),to=excelTime(r[2]),bar=excelText(r[3]),name=excelText(r[4]),people=Number(r[5]),barchef=excelText(r[6]),email=excelText(r[7]);
      if(!from||!to||!bar||!name||name==='#REF!'||!Number.isFinite(people)||people<=0)return;
      const a=ensureImportedAssoc(name,associations,barchef,email);
      shifts.push({id:uid('shift'),associationId:a.id,day:dp.day,daypart:dp.daypart,from,to,bar,people});
    }
    rows.slice(1).forEach(addRow);
    const seen=new Set();
    return shifts.filter(s=>{const k=[s.associationId,s.day,s.daypart,s.from,s.to,s.bar,s.people].join('|');if(seen.has(k))return false;seen.add(k);return true;});
  }
  async function importExcelFile(e){
    const file=e.target.files?.[0]; if(!file)return;
    if(typeof XLSX==='undefined') return alert('De Excel-module kon niet worden geladen. Controleer je internetverbinding en vernieuw Vappie.');
    const doAdmin=document.getElementById('importAdmin')?.checked, doPlanning=document.getElementById('importPlanning')?.checked;
    if(!doAdmin&&!doPlanning)return alert('Kies minimaal Administratie of Planning.');
    try{
      const book=XLSX.read(await file.arrayBuffer(),{cellDates:false});
      let associations=doAdmin?parseAdminWorkbook(book):clone(yd().associations);
      let shifts=doPlanning?parseWorkSchedule(book,associations):yd().shifts;
      if(doPlanning&&!shifts.length)throw new Error('Er zijn geen geldige diensten gevonden in “Werkschema”.');
      const summary=`Gevonden:\n${doAdmin?`• ${associations.length} verenigingen\n`:''}${doPlanning?`• ${shifts.length} diensten\n`:''}\nDe gekozen onderdelen voor ${db.activeYear} worden vervangen. Doorgaan?`;
      if(!confirm(summary))return;
      if(doAdmin||doPlanning)yd().associations=associations;
      if(doPlanning)yd().shifts=shifts;
      save();
      document.getElementById('modalRoot').innerHTML='';
      render();
      alert(`Excel-import voltooid. ${doAdmin?`${associations.length} verenigingen`:'Administratie behouden'}${doPlanning?` en ${shifts.length} diensten`:''}.`);
    }catch(err){console.error(err);alert(`Excel-import mislukt: ${err?.message||'onbekende fout'}`);}
  }

  function bindAdmin(){
    const input=document.getElementById('adminSearch'); input.oninput=e=>{adminQuery=e.target.value; const pos=e.target.selectionStart; render(); const n=document.getElementById('adminSearch'); n.focus(); n.setSelectionRange(pos,pos)};
    document.querySelector('[data-action="add-assoc"]').onclick=()=>assocModal();
    document.querySelector('[data-action="export-report"]').onclick=reportModal;
    document.querySelector('[data-action="import-excel"]').onclick=importExcelModal;
    document.querySelectorAll('[data-edit-assoc]').forEach(b=>b.onclick=()=>assocModal(yd().associations.find(a=>a.id===b.dataset.editAssoc)));
    document.querySelectorAll('[data-delete-assoc]').forEach(b=>b.onclick=()=>{const a=yd().associations.find(x=>x.id===b.dataset.deleteAssoc),n=yd().shifts.filter(s=>s.associationId===a.id).length;if(n)return alert(`Deze vereniging heeft nog ${n} diensten. Verwijder of wijzig die eerst in Planning.`);if(confirm(`${a.name} verwijderen?`)){yd().associations=yd().associations.filter(x=>x.id!==a.id);save();render()}});
  }

  function associationDetailModal(id){
    const a=yd().associations.find(x=>x.id===id);
    if(!a)return alert('Vereniging niet gevonden.');
    const root=document.getElementById('modalRoot');
    root.innerHTML=`<div class="modal-backdrop"><div class="modal wide association-detail-modal"><div class="modal-head"><div><span class="eyebrow">VOLLEDIG VERENIGINGSOVERZICHT</span><h2>${esc(a.name)}</h2></div><button id="assocDetailClose" aria-label="Sluiten">×</button></div><div class="modal-body association-detail-body">${resultHtml(a)}<div class="modal-actions"><button class="secondary" id="assocDetailCloseBottom">Sluiten</button><button class="primary" id="assocDetailEdit">✎ Administratie wijzigen</button></div></div></div></div>`;
    const close=()=>root.innerHTML='';
    document.getElementById('assocDetailClose').onclick=close;
    document.getElementById('assocDetailCloseBottom').onclick=close;
    document.getElementById('assocDetailEdit').onclick=()=>{close();assocModal(a)};
  }

  function showModal(title,body,onSave,wide=true){
    const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modal-backdrop"><div class="modal ${wide?'wide':''}"><div class="modal-head"><h2>${esc(title)}</h2><button id="modalClose">×</button></div><div class="modal-body">${body}<div class="modal-actions"><button class="secondary" id="modalCancel">Annuleren</button>${onSave?'<button class="primary" id="modalSave">✓ Opslaan</button>':''}</div></div></div></div>`;
    const close=()=>root.innerHTML=''; document.getElementById('modalClose').onclick=close;document.getElementById('modalCancel').onclick=close; if(onSave)document.getElementById('modalSave').onclick=()=>onSave(close);
  }
  function field(label,input,full=false){return `<label class="field ${full?'full':''}"><span>${label}</span>${input}</label>`}
  function opts(values,val){return values.map(v=>`<option ${String(v)===String(val)?'selected':''}>${esc(v)}</option>`).join('')}

  function shiftModal(shift){
    const f=shift?clone(shift):{associationId:yd().associations[0]?.id||'',day:'Vrijdag',daypart:'Middag',from:'13:00',to:'18:00',bar:Object.keys(yd().barCaps||{})[0]||'',people:1};
    const bars=[...new Set([...Object.keys(yd().barCaps||{}),...yd().shifts.map(s=>s.bar)])].filter(Boolean).sort();
    const body=`<div class="form-grid">
      ${field('Vereniging',`<select id="fAssoc">${yd().associations.slice().sort((a,b)=>a.name.localeCompare(b.name,'nl')).map(a=>`<option value="${attr(a.id)}" ${a.id===f.associationId?'selected':''}>${esc(a.name)}</option>`).join('')}</select>`)}
      ${field('Bar',`<input id="fBar" list="barlist" value="${attr(f.bar)}"><datalist id="barlist">${bars.map(b=>`<option value="${attr(b)}">`).join('')}</datalist>`)}
      ${field('Dag',`<select id="fDay">${opts(DAYS,f.day)}</select>`)}${field('Dagdeel',`<select id="fPart">${opts(PARTS,f.daypart)}</select>`)}
      ${field('Van',`<input id="fFrom" type="time" value="${attr(f.from)}">`)}${field('Tot',`<input id="fTo" type="time" value="${attr(f.to)}">`)}
      ${field('Aantal personen',`<input id="fPeople" type="number" min="1" value="${f.people}">`)}</div>`;
    showModal(shift?'Dienst wijzigen':'Dienst toevoegen',body,close=>{
      const n={id:shift?.id||uid('shift'),associationId:val('fAssoc'),bar:val('fBar').trim(),day:val('fDay'),daypart:val('fPart'),from:val('fFrom'),to:val('fTo'),people:Number(val('fPeople'))};
      if(!n.associationId||!n.bar||!n.from||!n.to||n.people<1)return alert('Vul alle velden geldig in.');
      yd().shifts=shift?yd().shifts.map(s=>s.id===shift.id?n:s):[...yd().shifts,n];save();close();render();
    });
  }

  function assocModal(a){
    const f=a?clone(a):{name:'',planningName:'',barchef:'',phone:'',email:'',meeting1:'Onbekend',meeting2:'Onbekend',certificates:'Nee',wristbands:'Nee',shirts:'Nee',mealVouchers:'Geen',notes:'',rateOverride:null};
    const tri=['Ja','Nee','Onbekend'];
    const body=`<div class="form-grid">
      ${field('Naam vereniging',`<input id="aName" value="${attr(f.name)}">`)}${field('Naam in planning',`<input id="aPlanning" value="${attr(f.planningName)}">`)}
      ${field('Naam barchef',`<input id="aBarchef" value="${attr(f.barchef)}">`)}${field('Telefoon',`<input id="aPhone" value="${attr(f.phone)}">`)}
      ${field('E-mail',`<input id="aEmail" type="email" value="${attr(f.email)}">`)}${field('Tarief uitzondering',`<select id="aRate"><option value="default" ${f.rateOverride==null?'selected':''}>Standaardtarief</option><option value="0" ${f.rateOverride===0?'selected':''}>€ 0,00</option></select>`)}
      ${field('Barchefmeeting 1',`<select id="aM1">${opts(tri,f.meeting1)}</select>`)}${field('Barchefmeeting 2',`<select id="aM2">${opts(tri,f.meeting2)}</select>`)}
      ${field('Certificaten',`<select id="aCert">${opts(tri,f.certificates)}</select>`)}${field('Polsbandjes ontvangen',`<select id="aWrist">${opts(tri,f.wristbands)}</select>`)}
      ${field('Maten kleding ingeleverd',`<select id="aShirts">${opts(tri,f.shirts)}</select>`)}${field('Eetbonnen',`<input id="aMeal" value="${attr(f.mealVouchers)}">`)}
      ${field('Opmerkingen',`<textarea id="aNotes" rows="3">${esc(f.notes)}</textarea>`,true)}</div>`;
    showModal(a?'Vereniging wijzigen':'Vereniging toevoegen',body,close=>{
      const n={id:a?.id||uid('assoc'),name:val('aName').trim(),planningName:val('aPlanning').trim()||val('aName').trim(),barchef:val('aBarchef').trim(),phone:val('aPhone').trim(),email:val('aEmail').trim(),meeting1:val('aM1'),meeting2:val('aM2'),certificates:val('aCert'),wristbands:val('aWrist'),shirts:val('aShirts'),mealVouchers:val('aMeal').trim(),notes:val('aNotes').trim(),rateOverride:val('aRate')==='default'?null:Number(val('aRate'))};
      if(!n.name)return alert('Vul een naam van de vereniging in.'); yd().associations=a?yd().associations.map(x=>x.id===a.id?n:x):[...yd().associations,n];save();close();render();
    });
  }
  function val(id){return document.getElementById(id).value}

  function supabaseStatusHtml(){
    const cfg=getSupabaseConfig(), linked=isSupabaseLinked();
    const label=!cfg?'Niet ingesteld':supabaseUser&&linked?'Synchronisatie actief':supabaseUser?'Aangemeld · nog niet gekoppeld':supabaseStatus==='error'?'Verbindingsfout':'Geconfigureerd · niet aangemeld';
    const cls=supabaseUser&&linked?'ok':supabaseStatus==='error'?'bad':'neutral';
    return `<div class="sync-status ${cls}"><span class="sync-dot"></span><div><strong>Supabase: ${esc(label)}</strong><small>${supabaseUser?esc(supabaseUser.email||'Aangemelde gebruiker'):'Lokale opslag blijft altijd actief.'}</small></div></div>`;
  }
  function dataModal(){
    const cfg=getSupabaseConfig();
    const remoteBlock=!cfg?`<div class="supabase-box"><h3>Supabase koppelen</h3><p>Optioneel. Vappie blijft eerst volledig lokaal werken. Gebruik alleen je <b>Project URL</b> en <b>Publishable key</b> (of legacy anon public key). Gebruik nooit een Secret/service_role key.</p>
      ${field('Supabase Project URL',`<input id="sbUrl" placeholder="https://xxxx.supabase.co">`,true)}
      ${field('Supabase Publishable / anon public key',`<input id="sbKey" type="password" placeholder="sb_publishable_... of anon public key">`,true)}
      <button class="secondary" id="sbSaveConfig">Koppeling opslaan & testen</button></div>`:
      !supabaseUser?`<div class="supabase-box"><h3>Supabase aanmelden</h3><p>Jouw Vappie is al gekoppeld aan het Supabase-project <b>ngijjzcizhwoeieaelgz</b>. Meld je aan met een gebruiker uit Supabase Auth. Vappie controleert daarna automatisch of database en beveiligingsregels correct werken.</p>
      ${field('E-mail',`<input id="sbEmail" type="email" autocomplete="username">`,true)}
      ${field('Wachtwoord',`<input id="sbPassword" type="password" autocomplete="current-password">`,true)}
      <div class="data-actions"><button class="primary" id="sbLogin">Aanmelden & verbinding testen</button></div></div>`:
      !isSupabaseLinked()?`<div class="supabase-box"><h3>Eerste synchronisatie</h3><p>Kies bewust welke gegevens het startpunt zijn. Zo wordt je huidige werk nooit automatisch overschreven.</p><div class="data-actions"><button class="primary" id="sbLocalFirst">Lokale Vappie → Supabase</button><button class="secondary" id="sbRemoteFirst">Supabase → deze Vappie</button></div><button class="text-btn" id="sbLogout">Uitloggen</button></div>`:
      `<div class="supabase-box"><h3>Supabase synchronisatie</h3><p>Wijzigingen worden eerst lokaal opgeslagen en daarna naar Supabase gestuurd. Iedere 2 minuten haalt Vappie ook de centrale gegevens opnieuw op.</p><div class="data-actions"><button class="primary" id="sbSyncNow">↻ Nu synchroniseren</button><button class="secondary" id="sbStopLink">Koppeling stoppen</button><button class="secondary" id="sbLogout">Uitloggen</button></div></div>`;
    const body=`<div class="data-panel">${supabaseStatusHtml()}<div class="notice"><b>✓</b><div><strong>Lokale opslag blijft de veiligheidsbasis.</strong><p>Ook bij een storing van Supabase blijft Vappie op dit apparaat werken. Maak daarnaast regelmatig een back-up.</p></div></div>
      ${field('Standaard vergoeding per persoon/uur',`<input id="rateInput" type="number" step="0.10" value="${yd().rate}">`)}
      <div class="data-actions"><button class="primary" id="backupDownload">⇩ Back-up downloaden</button><button class="secondary" id="backupImport">⇧ Back-up importeren</button><input hidden id="backupFile" type="file" accept="application/json"></div>${remoteBlock}</div>`;
    showModal('Data, back-up & Supabase',body,close=>{yd().rate=Number(val('rateInput'));save();close();render()},false);
    document.getElementById('backupDownload').onclick=downloadBackup;
    document.getElementById('backupImport').onclick=()=>document.getElementById('backupFile').click();
    document.getElementById('backupFile').onchange=importBackup;
    bindSupabasePanel();
  }
  function bindSupabasePanel(){
    const by=id=>document.getElementById(id);
    if(by('sbSaveConfig'))by('sbSaveConfig').onclick=saveSupabaseConfig;
    if(by('sbLogin'))by('sbLogin').onclick=supabaseLogin;
    if(by('sbClearConfig'))by('sbClearConfig').onclick=clearSupabaseConfig;
    if(by('sbLocalFirst'))by('sbLocalFirst').onclick=linkLocalFirst;
    if(by('sbRemoteFirst'))by('sbRemoteFirst').onclick=linkRemoteFirst;
    if(by('sbSyncNow'))by('sbSyncNow').onclick=syncNow;
    if(by('sbStopLink'))by('sbStopLink').onclick=()=>{if(confirm('Supabase-synchronisatie stoppen? De lokale gegevens blijven behouden.')){localStorage.removeItem(SUPABASE_LINKED_KEY);setSupabaseDirty(false);dataModal();}};
    if(by('sbLogout'))by('sbLogout').onclick=supabaseLogout;
  }
  async function saveSupabaseConfig(){
    const url=val('sbUrl').trim().replace(/\/$/,''), key=val('sbKey').trim();
    if(!/^https:\/\/.+\.supabase\.co$/i.test(url))return alert('Vul een geldige Supabase Project URL in.');
    if(!key)return alert('Vul de Publishable key of anon public key in.');
    if(key.startsWith('sb_secret_')||key.startsWith('service_role'))return alert('Gebruik nooit een Secret/service_role key in Vappie. Gebruik de Publishable key of anon public key.');
    try{
      await loadSupabaseLibrary();
      const test=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
      // De tabel is bewust niet toegankelijk vóór inloggen. Daarom testen we hier
      // alleen of de browserclient correct kan worden opgebouwd; de echte verbinding
      // en RLS-rechten worden bij het aanmelden getest.
      localStorage.setItem(SUPABASE_CONFIG_KEY,JSON.stringify({url,key}));
      supabaseClient=test;
      const {data:{session}}=await test.auth.getSession();
      supabaseUser=session?.user||null;
      supabaseStatus=supabaseUser?'connected':'configured';
      alert('Supabase-configuratie opgeslagen. Meld je nu aan om de verbinding en rechten te testen. De lokale Vappie is ongewijzigd gebleven.');
      dataModal();
    }catch(err){alert(`Supabase-configuratie kon niet worden opgeslagen: ${err?.message||err}`);}
  }
  async function testSupabaseAccess(){
    if(!supabaseClient||!supabaseUser)throw new Error('Niet aangemeld bij Supabase.');
    const {error}=await supabaseClient.from('vappie_state').select('id').limit(1);
    if(error)throw new Error(`Databasecontrole mislukt: ${error.message}. Controleer of supabase_setup.sql is uitgevoerd en RLS correct staat.`);
    return true;
  }
  async function supabaseLogin(){
    try{
      if(!supabaseClient){await initSupabase();if(!supabaseClient)throw new Error('Supabase is niet geconfigureerd.');}
      const {data,error}=await supabaseClient.auth.signInWithPassword({email:val('sbEmail').trim(),password:val('sbPassword')});
      if(error)throw error;
      supabaseUser=data.user;supabaseStatus='connected';
      await testSupabaseAccess();
      alert('Aangemeld en databaseverbinding getest. Kies nu welke data het startpunt is.');
      dataModal();
    }catch(err){
      supabaseStatus='error';
      alert(`Aanmelden/verbindingstest mislukt: ${err?.message||err}`);
    }
  }
  async function supabaseLogout(){
    try{if(supabaseClient)await supabaseClient.auth.signOut();}catch{}
    supabaseUser=null;setSupabaseDirty(false);supabaseStatus='configured';
    document.getElementById('modalRoot')?.remove();
    showLoginGate('Je bent uitgelogd.');
  }
  function clearSupabaseConfig(){
    if(!confirm('Supabase-configuratie van dit apparaat wissen? De lokale Vappie-data blijven behouden.'))return;
    localStorage.removeItem(SUPABASE_CONFIG_KEY);localStorage.removeItem(SUPABASE_LINKED_KEY);setSupabaseDirty(false);supabaseClient=null;supabaseUser=null;supabaseStatus='local';dataModal();
  }
  async function linkLocalFirst(){
    if(!confirm('Je huidige lokale Vappie wordt als startpunt naar Supabase gekopieerd. Doorgaan?'))return;
    try{localStorage.setItem(SUPABASE_LINKED_KEY,'1');setSupabaseDirty(true);await pushRemote();alert('Gelukt. Supabase synchronisatie is nu actief.');dataModal();render();}
    catch(err){localStorage.removeItem(SUPABASE_LINKED_KEY);alert(`Koppelen mislukt. Lokale data zijn niet gewijzigd: ${err?.message||err}`);dataModal();}
  }
  async function linkRemoteFirst(){
    if(!confirm('De gegevens uit Supabase worden op dit apparaat gebruikt. Maak zo nodig eerst een back-up. Doorgaan?'))return;
    try{const ok=await pullRemote({force:true});if(!ok)return alert('Er staat nog geen Vappie-dataset in Supabase. Kies “Lokale Vappie → Supabase”.');localStorage.setItem(SUPABASE_LINKED_KEY,'1');setSupabaseDirty(false);alert('Gelukt. Supabase synchronisatie is nu actief.');document.getElementById('modalRoot').innerHTML='';render();}
    catch(err){alert(`Ophalen mislukt. Lokale data zijn behouden: ${err?.message||err}`);}
  }
  async function syncNow(){
    try{if(isSupabaseDirty())await pushRemote();await pullRemote({force:true});alert('Synchronisatie voltooid.');document.getElementById('modalRoot').innerHTML='';render();}
    catch(err){alert(`Synchronisatie mislukt. Lokale Vappie blijft bruikbaar: ${err?.message||err}`);}
  }
  function downloadBackup(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`vappie-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)}
  function importBackup(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const x=JSON.parse(reader.result);if(!x.years)throw 0;if(confirm('Deze back-up vervangt de huidige lokale gegevens. Doorgaan?')){db=x;save();render()}}catch{alert('Geen geldige Vappie back-up.')}};reader.readAsText(file)}
  function newYear(){const current=Number(db.activeYear), input=prompt('Nieuw festivaljaar:',String(current+1));if(!input||db.years[input])return;const copy=confirm(`Gegevens van ${db.activeYear} kopiëren naar ${input}?\nOK = kopiëren, Annuleren = leeg jaar.`);db.years[input]=copy?clone(yd()):{rate:6.5,associations:[],shifts:[],barCaps:clone(yd().barCaps||{})};db.activeYear=input;save();page='home';render()}

  async function autoRefresh(){
    if(document.hidden||document.querySelector('.modal-backdrop')) return;
    const active=document.activeElement;
    const activeId=active?.id||'';
    const start=typeof active?.selectionStart==='number'?active.selectionStart:null;
    const end=typeof active?.selectionEnd==='number'?active.selectionEnd:null;
    try{
      if(supabaseClient&&supabaseUser&&isSupabaseLinked()){
        await pullRemote();
      }else{
        const stored=localStorage.getItem(STORAGE_KEY);
        if(stored){const fresh=JSON.parse(stored);if(fresh?.years&&fresh?.activeYear)db=fresh;}
      }
      render();
      if(activeId){
        const restored=document.getElementById(activeId);
        if(restored){restored.focus();if(start!==null&&typeof restored.setSelectionRange==='function')restored.setSelectionRange(start,end??start);}
      }
    }catch(err){console.warn('Automatisch verversen overgeslagen; lokale Vappie blijft actief:',err);}
  }

  boot();
  setInterval(autoRefresh,120000);
})();
