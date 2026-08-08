(() => {
  'use strict';
  const STORAGE_KEY = 'vappie-data-v2';
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
  let db=load(), page='home', searchQuery='', filters={day:'',daypart:'',bar:''}, adminQuery='';
  const app=document.getElementById('app');
  const save=()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
  const yd=()=>db.years[db.activeYear];
  const assoc=id=>yd().associations.find(a=>a.id===id);
  const sortedYears=()=>Object.keys(db.years).sort((a,b)=>Number(b)-Number(a));

  function render(){
    app.innerHTML=`
      <header class="topbar">
        <button class="mobile-menu" data-action="mobile-menu">☰</button>
        <button class="brand" data-page="home"><span class="brand-mark">V</span><span><strong>Vappie</strong><small>TEAM VERENIGINGEN</small></span></button>
        <nav class="nav" id="nav">
          ${navBtn('home','⌂','Zoeken')}${navBtn('planning','▣','Planning')}${navBtn('financial','€','Financieel')}${navBtn('occupancy','◉','Bezetting')}${navBtn('admin','☷','Administratie')}
        </nav>
        <div class="top-actions">
          <div class="year-select">▦ <select id="yearSelect">${sortedYears().map(y=>`<option ${y===db.activeYear?'selected':''}>${esc(y)}</option>`).join('')}</select></div>
          <button class="icon-btn" data-action="new-year" title="Nieuw jaar">＋</button>
          <button class="icon-btn" data-action="data" title="Data en back-up">◫</button>
        </div>
      </header>
      <main class="${page==='home'?'home-main':'main'}">${renderPage()}</main>
      <div id="modalRoot"></div>`;
    bindGlobal();
    if(page==='home') bindHome();
    if(page==='planning') bindPlanning();
    if(page==='financial') bindFinancial();
    if(page==='admin') bindAdmin();
  }
  function navBtn(id,icon,label){return `<button data-page="${id}" class="${page===id?'active':''}"><b>${icon}</b>${label}</button>`}
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
    const shifts=yd().shifts.filter(s=>s.associationId===a.id).sort(shiftSort), total=shifts.reduce((n,s)=>n+amount(s,a,yd().rate),0);
    return `<article class="result-card"><div class="result-head"><div><span class="eyebrow">VERENIGING</span><h2>${esc(a.name)}</h2>${a.planningName!==a.name?`<small>Planningnaam: ${esc(a.planningName)}</small>`:''}</div><div class="earnings"><span>Verdiensten</span><strong>${money(total)}</strong></div></div>
      <div class="contact-strip"><span>● ${esc(a.barchef||'Geen barchef')}</span><a ${a.phone?`href="tel:${attr(a.phone)}"`:''}>☎ ${esc(a.phone||'Geen telefoon')}</a><a ${a.email?`href="mailto:${attr(a.email)}"`:''}>✉ ${esc(a.email||'Geen e-mail')}</a></div>
      <div class="shift-list"><div class="shift-header"><span>Dag</span><span>Bar</span><span>Tijd</span><span>Personen</span><span>Bedrag</span></div>
      ${shifts.length?shifts.map(s=>`<div class="shift-row"><span><strong>${esc(s.day)}</strong><small>${esc(s.daypart)}</small></span><span>⌖ ${esc(s.bar)}</span><span>◷ ${esc(s.from)}–${esc(s.to)}</span><span>${s.people}</span><span>${money(amount(s,a,yd().rate))}</span></div>`).join(''):'<div class="no-shifts">Geen diensten gepland voor dit jaar.</div>'}</div></article>`;
  }

  function pageHeader(kicker,title,subtitle,action=''){return `<div class="page-header"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`}
  function planningHtml(){
    const bars=[...new Set([...Object.keys(yd().barCaps||{}),...yd().shifts.map(s=>s.bar)])].filter(Boolean).sort();
    const list=yd().shifts.filter(s=>(!filters.day||s.day===filters.day)&&(!filters.daypart||s.daypart===filters.daypart)&&(!filters.bar||s.bar===filters.bar)).sort(shiftSort);
    return `${pageHeader('PLANNING','Wie staat waar?','Filter, wijzig of voeg diensten toe.','<button class="primary" data-action="add-shift">＋ Dienst toevoegen</button>')}
      <div class="filterbar">${selectFilter('day','Dag',DAYS)}${selectFilter('daypart','Dagdeel',PARTS)}${selectFilter('bar','Bar',bars)}<button class="text-btn" data-action="clear-filters">Filters wissen</button><span class="count">${list.length} diensten</span></div>
      <div class="table-card"><div class="table-scroll"><table><thead><tr><th>Dag</th><th>Dagdeel</th><th>Bar</th><th>Vereniging</th><th>Tijd</th><th class="num">Personen</th><th></th></tr></thead><tbody>
      ${list.map(s=>{const a=assoc(s.associationId);return `<tr><td><strong>${esc(s.day)}</strong></td><td><span class="pill">${esc(s.daypart)}</span></td><td>${esc(s.bar)}</td><td><strong>${esc(a?.planningName||a?.name||'Onbekend')}</strong><small>${esc(a?.barchef||'')}</small></td><td>${esc(s.from)} – ${esc(s.to)}</td><td class="num">${s.people}</td><td class="actions"><button data-edit-shift="${attr(s.id)}">✎</button><button data-delete-shift="${attr(s.id)}">⌫</button></td></tr>`}).join('')}</tbody></table></div></div>`;
  }
  function selectFilter(key,label,opts){return `<label class="filter-select"><span>${label}</span><select data-filter="${key}"><option value="">Alles</option>${opts.map(o=>`<option ${filters[key]===o?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`}
  function shiftSort(a,b){return DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||PARTS.indexOf(a.daypart)-PARTS.indexOf(b.daypart)||String(a.bar).localeCompare(String(b.bar),'nl')}

  function financialHtml(){
    const am=Object.fromEntries(yd().associations.map(a=>[a.id,a]));
    const rows=yd().associations.map(a=>{const ss=yd().shifts.filter(s=>s.associationId===a.id);return {a,services:ss.length,hours:ss.reduce((n,s)=>n+durationHours(s.from,s.to)*s.people,0),amount:ss.reduce((n,s)=>n+amount(s,a,yd().rate),0)}}).filter(r=>r.services).sort((a,b)=>b.amount-a.amount);
    const total=rows.reduce((n,r)=>n+r.amount,0), hours=rows.reduce((n,r)=>n+r.hours,0), persons=yd().shifts.reduce((n,s)=>n+s.people,0);
    const byDay=DAYS.map(day=>({day,amount:yd().shifts.filter(s=>s.day===day).reduce((n,s)=>n+amount(s,am[s.associationId],yd().rate),0)})).filter(x=>x.amount>0); const max=Math.max(1,...byDay.map(x=>x.amount));
    return `${pageHeader('FINANCIEEL','Verdiensten in beeld',`Berekend met standaardtarief ${money(yd().rate)} per persoon per uur; uitzonderingen zijn per vereniging mogelijk.`,`<button class="primary" data-action="export-report">⇩ Rapport exporteren</button>`)}
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
    const q=norm(adminQuery), list=yd().associations.filter(a=>!q||norm(a.name).includes(q)||norm(a.barchef).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'nl'));
    return `${pageHeader('ADMINISTRATIE','Verenigingen & barchefs','Wijzig contact- en administratiegegevens of voeg een vereniging toe.','<button class="primary" data-action="add-assoc">＋ Vereniging toevoegen</button>')}
      <div class="admin-tools"><div class="mini-search">⌕ <input id="adminSearch" value="${attr(adminQuery)}" placeholder="Zoek vereniging of barchef..."></div><span class="count">${list.length} verenigingen</span></div>
      <div class="table-card"><div class="table-scroll"><table><thead><tr><th>Vereniging</th><th>Barchef</th><th>Telefoon</th><th>E-mail</th><th>Certificaten</th><th>Shirts</th><th></th></tr></thead><tbody>${list.map(a=>`<tr><td><strong>${esc(a.name)}</strong><small>Planning: ${esc(a.planningName)}</small></td><td>${esc(a.barchef)}</td><td>${esc(a.phone||'—')}</td><td>${esc(a.email||'—')}</td><td>${status(a.certificates)}</td><td>${status(a.shirts)}</td><td class="actions"><button data-edit-assoc="${attr(a.id)}">✎</button><button data-delete-assoc="${attr(a.id)}">⌫</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function status(v){return `<span class="status ${String(v).toLowerCase()==='ja'?'good':'neutral'}">${esc(v||'Onbekend')}</span>`}

  function bindGlobal(){
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page; render()});
    document.getElementById('yearSelect').onchange=e=>{db.activeYear=e.target.value;save();render()};
    document.querySelector('[data-action="mobile-menu"]').onclick=()=>document.getElementById('nav').classList.toggle('open');
    document.querySelector('[data-action="new-year"]').onclick=newYear;
    document.querySelector('[data-action="data"]').onclick=dataModal;
  }
  function bindHome(){
    const input=document.getElementById('mainSearch'); input.oninput=e=>{searchQuery=e.target.value; const pos=e.target.selectionStart; render(); const n=document.getElementById('mainSearch'); n.focus(); n.setSelectionRange(pos,pos)}; input.focus();
  }
  function bindPlanning(){
    document.querySelectorAll('[data-filter]').forEach(s=>s.onchange=e=>{filters[e.target.dataset.filter]=e.target.value;render()});
    document.querySelector('[data-action="clear-filters"]').onclick=()=>{filters={day:'',daypart:'',bar:''};render()};
    document.querySelector('[data-action="add-shift"]').onclick=()=>shiftModal();
    document.querySelectorAll('[data-edit-shift]').forEach(b=>b.onclick=()=>shiftModal(yd().shifts.find(s=>s.id===b.dataset.editShift)));
    document.querySelectorAll('[data-delete-shift]').forEach(b=>b.onclick=()=>{if(confirm('Deze dienst verwijderen?')){yd().shifts=yd().shifts.filter(s=>s.id!==b.dataset.deleteShift);save();render()}});
  }
  function bindFinancial(){
    const btn=document.querySelector('[data-action="export-report"]');
    if(btn) btn.onclick=reportModal;
  }

  function reportRows(associationId='all'){
    return yd().associations
      .filter(a=>associationId==='all'||a.id===associationId)
      .map(a=>{
        const shifts=yd().shifts.filter(s=>s.associationId===a.id).sort(shiftSort);
        const income=shifts.reduce((n,s)=>n+amount(s,a,yd().rate),0);
        const services=shifts.map(s=>`${s.day} ${s.daypart} · ${s.bar} · ${s.people} pers. · ${s.from}–${s.to}`).join(' | ');
        return {a,shifts,income,services};
      })
      .filter(r=>r.shifts.length>0)
      .sort((x,y)=>x.a.name.localeCompare(y.a.name,'nl'));
  }

  function reportModal(){
    const assocs=yd().associations.slice().sort((a,b)=>a.name.localeCompare(b.name,'nl'));
    const body=`<div class="data-panel">
      <div class="notice"><b>i</b><div><strong>Rapport ${esc(db.activeYear)}</strong><p>Exporteer één vereniging of alle verenigingen met diensten. Het PDF-rapport opent in een printvenster; kies daar eventueel “Opslaan als PDF”.</p></div></div>
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
    const header=['Naam vereniging','Naam Barchef','Telefoon Barchef','Email Barchef','Gewerkte diensten','Inkomsten','Extra info'];
    const lines=[header.map(csvCell).join(';')];
    rows.forEach(r=>lines.push([
      r.a.name,r.a.barchef||'',r.a.phone||'',r.a.email||'',r.services,
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
    const cards=rows.map(r=>`<section class="report-card">
      <div class="report-card-head"><div><span>VERENIGING</span><h2>${esc(r.a.name)}</h2></div><div class="income"><small>Inkomsten</small><strong>${money(r.income)}</strong></div></div>
      <div class="contact-grid"><div><b>Naam Barchef</b><span>${esc(r.a.barchef||'—')}</span></div><div><b>Telefoon Barchef</b><span>${esc(r.a.phone||'—')}</span></div><div><b>E-mail Barchef</b><span>${esc(r.a.email||'—')}</span></div></div>
      <h3>Gewerkte diensten</h3>
      <table><thead><tr><th>Dag</th><th>Dagdeel</th><th>Bar</th><th>Tijd</th><th>Personen</th><th>Bedrag</th></tr></thead><tbody>${r.shifts.map(s=>`<tr><td>${esc(s.day)}</td><td>${esc(s.daypart)}</td><td>${esc(s.bar)}</td><td>${esc(s.from)}–${esc(s.to)}</td><td>${s.people}</td><td>${money(amount(s,r.a,yd().rate))}</td></tr>`).join('')}</tbody></table>
      <div class="extra"><b>Extra info</b><p>${esc(r.a.notes||'—').replace(/\n/g,'<br>')}</p></div>
    </section>`).join('');
    const w=window.open('','_blank');
    if(!w) return alert('Het printvenster is geblokkeerd door de browser. Sta pop-ups voor Vappie toe en probeer opnieuw.');
    w.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Vappie rapport ${esc(db.activeYear)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;margin:0;background:#fff}main{max-width:1100px;margin:0 auto;padding:28px}.report-top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:5px solid #171717;padding-bottom:14px;margin-bottom:24px}.logo{font:900 34px Arial Black,Arial,sans-serif;text-transform:uppercase}.logo i{font-style:normal;background:#ff3f93;padding:3px 8px;margin-right:8px}.meta{text-align:right;color:#666;font-size:12px}.summary{display:flex;justify-content:space-between;background:#f3e800;padding:12px 16px;margin-bottom:24px;font-weight:700}.report-card{border:1px solid #d8d4ca;margin:0 0 24px;page-break-inside:avoid}.report-card-head{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #ddd}.report-card-head span{font-size:10px;letter-spacing:1.5px;font-weight:800}.report-card h2{margin:4px 0 0;font-size:23px}.income{text-align:right}.income small{display:block;font-size:10px;text-transform:uppercase}.income strong{font-size:22px}.contact-grid{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:10px;padding:14px 20px;background:#171717;color:white}.contact-grid b{display:block;font-size:9px;text-transform:uppercase;color:#bbb;margin-bottom:4px}.contact-grid span{font-size:12px}.report-card h3{font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:18px 20px 8px}table{width:calc(100% - 40px);margin:0 20px;border-collapse:collapse;font-size:11px}th{text-align:left;background:#eee;padding:7px;border-bottom:1px solid #ccc}td{padding:7px;border-bottom:1px solid #eee}.extra{margin:16px 20px 20px;padding:12px;background:#f7f6f2}.extra b{font-size:10px;text-transform:uppercase}.extra p{margin:5px 0 0;font-size:12px;line-height:1.45}@media print{main{padding:0}.report-card{break-inside:avoid}.report-top{margin-top:0}@page{size:A4 landscape;margin:10mm}}
    </style></head><body><main><header class="report-top"><div class="logo"><i>V</i>Vappie</div><div class="meta">Zomerparkfeest · ${esc(db.activeYear)}<br>Gegenereerd: ${esc(generated)}</div></header><div class="summary"><span>${rows.length} vereniging${rows.length===1?'':'en'}</span><span>Totaal inkomsten: ${money(total)}</span></div>${cards}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));<\/script></body></html>`);
    w.document.close();
  }

  function bindAdmin(){
    const input=document.getElementById('adminSearch'); input.oninput=e=>{adminQuery=e.target.value; const pos=e.target.selectionStart; render(); const n=document.getElementById('adminSearch'); n.focus(); n.setSelectionRange(pos,pos)};
    document.querySelector('[data-action="add-assoc"]').onclick=()=>assocModal();
    document.querySelectorAll('[data-edit-assoc]').forEach(b=>b.onclick=()=>assocModal(yd().associations.find(a=>a.id===b.dataset.editAssoc)));
    document.querySelectorAll('[data-delete-assoc]').forEach(b=>b.onclick=()=>{const a=yd().associations.find(x=>x.id===b.dataset.deleteAssoc),n=yd().shifts.filter(s=>s.associationId===a.id).length;if(n)return alert(`Deze vereniging heeft nog ${n} diensten. Verwijder of wijzig die eerst in Planning.`);if(confirm(`${a.name} verwijderen?`)){yd().associations=yd().associations.filter(x=>x.id!==a.id);save();render()}});
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

  function dataModal(){
    const body=`<div class="data-panel"><div class="notice"><b>!</b><div><strong>Gegevens staan lokaal op dit apparaat.</strong><p>Vercel host de app, maar wijzigingen worden alleen in deze browser opgeslagen. Gebruik daarom regelmatig een back-up.</p></div></div>
      ${field('Standaard vergoeding per persoon/uur',`<input id="rateInput" type="number" step="0.10" value="${yd().rate}">`)}
      <div class="data-actions"><button class="primary" id="backupDownload">⇩ Back-up downloaden</button><button class="secondary" id="backupImport">⇧ Back-up importeren</button><input hidden id="backupFile" type="file" accept="application/json"></div></div>`;
    showModal('Data & back-up',body,close=>{yd().rate=Number(val('rateInput'));save();close();render()},false);
    document.getElementById('backupDownload').onclick=downloadBackup;
    document.getElementById('backupImport').onclick=()=>document.getElementById('backupFile').click();
    document.getElementById('backupFile').onchange=importBackup;
  }
  function downloadBackup(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`vappie-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)}
  function importBackup(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const x=JSON.parse(reader.result);if(!x.years)throw 0;if(confirm('Deze back-up vervangt de huidige lokale gegevens. Doorgaan?')){db=x;save();render()}}catch{alert('Geen geldige Vappie back-up.')}};reader.readAsText(file)}
  function newYear(){const current=Number(db.activeYear), input=prompt('Nieuw festivaljaar:',String(current+1));if(!input||db.years[input])return;const copy=confirm(`Gegevens van ${db.activeYear} kopiëren naar ${input}?\nOK = kopiëren, Annuleren = leeg jaar.`);db.years[input]=copy?clone(yd()):{rate:6.5,associations:[],shifts:[],barCaps:clone(yd().barCaps||{})};db.activeYear=input;save();page='home';render()}

  render();
})();
