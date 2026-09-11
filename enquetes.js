(() => {
  'use strict';
  let ctx={year:'',associations:[],client:null,user:null,escape:s=>String(s??''),refresh:()=>{}}, surveys=[], invitations=[], responses=[], loading=false,loadedYear='';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const TEST_ASSOCIATION=Object.freeze({id:'test-vereniging-vappie',name:'Test-vereniging',barchef:'Chris Munten test',email:'chrismunten@zomerparkfeest.nl'});
  const recipientAssociations=()=>[TEST_ASSOCIATION,...ctx.associations.filter(a=>a.id!==TEST_ASSOCIATION.id)];
  const byId=id=>surveys.find(x=>x.id===id);
  const questions=s=>(s?.questions||[]);
  const fmt=d=>d?new Date(d).toLocaleString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  const baseUrl=()=>`${location.origin}${location.pathname}`;
  const surveyUrl=token=>`${baseUrl()}?enquete=${encodeURIComponent(token)}`;
  function modal(title,body,footer=''){
    const root=document.getElementById('modalRoot');
    root.innerHTML=`<div class="modal-backdrop"><section class="modal survey-modal-wide"><div class="modal-head"><h2>${esc(title)}</h2><button data-survey-close>×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-foot">${footer}</div>`:''}</section></div>`;
    root.querySelectorAll('[data-survey-close]').forEach(b=>b.onclick=()=>root.innerHTML='');
  }
  async function reload(){
    if(!ctx.client||!ctx.user)return;
    loading=true;
    const [a,b,c]=await Promise.all([
      ctx.client.from('vappie_surveys').select('*').eq('festival_year',String(ctx.year)).order('created_at',{ascending:false}),
      ctx.client.from('vappie_survey_invitations').select('*').eq('festival_year',String(ctx.year)),
      ctx.client.from('vappie_survey_responses').select('*').eq('festival_year',String(ctx.year))
    ]);
    loading=false;
    const err=a.error||b.error||c.error;
    if(err){surveys=[];invitations=[];responses=[];throw err;}
    surveys=a.data||[]; invitations=b.data||[]; responses=c.data||[];loadedYear=String(ctx.year);
  }
  function counts(s){
    const inv=invitations.filter(x=>x.survey_id===s.id), done=inv.filter(x=>x.status==='completed').length;
    return {inv:inv.length,sent:inv.filter(x=>x.sent_at).length,opened:inv.filter(x=>x.opened_at).length,done,pending:Math.max(0,inv.length-done)};
  }
  function adminHtml(next){
    ctx={...ctx,...next};
    if(ctx.client&&!loading&&loadedYear!==String(ctx.year))setTimeout(()=>reload().then(ctx.refresh).catch(showSetupError),0);
    const total=surveys.length, active=surveys.filter(s=>s.status==='published').length, opened=invitations.filter(i=>i.opened_at).length, done=invitations.filter(i=>i.status==='completed').length;
    return `<section class="survey-page"><div class="page-header"><div><span class="eyebrow">ENQUÊTES · ${esc(ctx.year)}</span><h1>Evaluaties en enquêtes</h1><p>Importeer een Markdown-enquête, selecteer verenigingen en volg openen en voltooien live.</p></div><div class="header-actions"><input hidden id="surveyMarkdownFile" type="file" accept=".md,.markdown,text/markdown,text/plain"><button class="secondary" data-survey-refresh>↻ Verversen</button><button class="secondary" data-survey-import>⇧ Markdown importeren</button><button class="primary" data-survey-new>＋ Nieuwe enquête</button></div></div>
      <div class="survey-kpis"><div class="survey-kpi"><span>Enquêtes</span><strong>${total}</strong></div><div class="survey-kpi"><span>Gepubliceerd</span><strong>${active}</strong></div><div class="survey-kpi"><span>Geopend</span><strong>${opened}</strong></div><div class="survey-kpi"><span>Voltooid</span><strong>${done}</strong></div></div>
      ${loading?'<div class="survey-empty">Enquêtes laden…</div>':surveys.length?`<div class="survey-list">${surveys.map(s=>{const n=counts(s);return `<article class="survey-card"><div class="survey-card-main"><div class="survey-card-badges"><span class="survey-badge ${s.status==='published'?'live':'draft'}">${s.status==='published'?'Gepubliceerd':s.status==='closed'?'Gesloten':'Concept'}</span><span class="survey-badge opened">${n.opened} geopend</span><span class="survey-badge completed">${n.done}/${n.inv} voltooid</span></div><h3>${esc(s.title)}</h3><p>${esc(s.description||'Geen toelichting')} · gewijzigd ${fmt(s.updated_at)}</p></div><div class="survey-workflow"><button class="survey-step" data-survey-preview="${s.id}"><b>1</b><span>Voorbeeld<small>Bekijk wat men ontvangt</small></span></button><button class="survey-step" data-survey-edit="${s.id}"><b>2</b><span>Bewerken<small>Pas vragen en tekst aan</small></span></button><button class="survey-step" data-survey-send="${s.id}"><b>3</b><span>Verenigingen<small>Selecteer en verstuur</small></span></button><button class="survey-step primary-step" data-survey-results="${s.id}"><b>4</b><span>Status & resultaten<small>Bekijk reacties</small></span></button></div><div class="survey-card-secondary"><button class="text-btn" data-survey-copy="${s.id}">Kopie maken</button><button class="text-btn danger" data-survey-delete="${s.id}">Enquête verwijderen</button></div></article>`}).join('')}</div>`:'<div class="survey-empty"><h3>Nog geen enquêtes</h3><p>Importeer een Markdown-bestand of maak handmatig een enquête.</p><button class="secondary" data-survey-import>Markdown importeren</button> <button class="primary" data-survey-new>Nieuwe enquête maken</button></div>'}</section>`;
  }
  function bindAdmin(){
    document.querySelectorAll('[data-survey-new]').forEach(b=>b.onclick=()=>editSurvey());
    document.querySelectorAll('[data-survey-import]').forEach(b=>b.onclick=()=>document.getElementById('surveyMarkdownFile')?.click());
    const markdown=document.getElementById('surveyMarkdownFile');if(markdown)markdown.onchange=importMarkdown;
    document.querySelectorAll('[data-survey-refresh]').forEach(b=>b.onclick=async()=>{b.disabled=true;await reload().catch(showSetupError);ctx.refresh()});
    document.querySelectorAll('[data-survey-edit]').forEach(b=>b.onclick=()=>editSurvey(byId(b.dataset.surveyEdit)));
    document.querySelectorAll('[data-survey-preview]').forEach(b=>b.onclick=()=>previewSurvey(byId(b.dataset.surveyPreview)));
    document.querySelectorAll('[data-survey-send]').forEach(b=>b.onclick=()=>recipientModal(byId(b.dataset.surveySend)));
    document.querySelectorAll('[data-survey-results]').forEach(b=>b.onclick=()=>resultsModal(byId(b.dataset.surveyResults)));
    document.querySelectorAll('[data-survey-copy]').forEach(b=>b.onclick=()=>copySurvey(byId(b.dataset.surveyCopy)));
    document.querySelectorAll('[data-survey-delete]').forEach(b=>b.onclick=()=>deleteSurvey(byId(b.dataset.surveyDelete)));
  }
  function markdownType(value){
    const v=String(value||'').toLowerCase();
    if(v.includes('meerdere')||v.includes('multi'))return 'multi_choice';
    if(v.includes('meerkeuze')||v.includes('één antwoord')||v.includes('een antwoord')||v.includes('single'))return 'single_choice';
    if(v.includes('1 tot en met 10')||v.includes('1–10')||v.includes('1-10')||v.includes('rapportcijfer'))return 'scale10';
    if(v.includes('schaal')||v.includes('waardering')||v.includes('rating'))return 'scale5';
    if(v.includes('kort'))return 'short_text';
    return 'long_text';
  }
  function parseMarkdown(text,fileName='enquete.md'){
    const lines=String(text||'').replace(/\r/g,'').split('\n');
    const title=(lines.find(x=>/^#\s+/.test(x))||`# ${fileName.replace(/\.(md|markdown)$/i,'')}`).replace(/^#\s+/,'').trim();
    let section='Algemeen',current=null,description=[],seenSection=false;
    const qs=[];
    const finish=()=>{if(current?.title){current.options=[...new Set(current.options)];current.order=qs.length;qs.push(current)}current=null};
    for(const raw of lines){
      const line=raw.trim();
      if(/^##\s+/.test(line)){finish();section=line.replace(/^##\s+/,'').replace(/^\d+[.)]?\s*/,'').trim()||'Algemeen';seenSection=true;continue}
      if(/^###\s+/.test(line)){finish();current={id:uid(),title:line.replace(/^###\s+/,'').trim(),section,type:'long_text',required:false,options:[]};continue}
      if(!current){if(!seenSection&&line&&!/^#|^---$/.test(line))description.push(line);continue}
      const type=line.match(/^(vraagtype|type)\s*:\s*(.+)$/i);if(type){current.type=markdownType(type[2]);continue}
      const required=line.match(/^verplicht\s*:\s*(.+)$/i);if(required){current.required=/^(ja|yes|true)/i.test(required[1]);continue}
      const option=line.match(/^[-*]\s+(.+)$/);if(option)current.options.push(option[1].trim());
    }
    finish();
    return {title,description:description.join('\n').trim(),questions:qs};
  }
  async function importMarkdown(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      const parsed=parseMarkdown(await file.text(),file.name);
      if(!parsed.questions.length)throw new Error('Geen vragen gevonden. Gebruik voor iedere vraag een regel die begint met ###.');
      const payload={...parsed,status:'draft',festival_year:String(ctx.year),updated_at:new Date().toISOString(),updated_by:ctx.user.id};
      const {error}=await ctx.client.from('vappie_surveys').insert(payload);if(error)throw error;
      await reload();ctx.refresh();alert(`“${parsed.title}” is geïmporteerd als concept met ${parsed.questions.length} vragen.`);
    }catch(err){alert(`Markdown importeren mislukt: ${err.message}`)}finally{e.target.value=''}
  }
  function questionRow(q={id:uid(),type:'long_text',title:'',section:'Algemeen',required:false,options:[]}){
    return `<div class="survey-question-row" data-qid="${esc(q.id)}"><label class="field"><span>Vraag</span><textarea data-q-title placeholder="Typ hier de vraag…">${esc(q.title)}</textarea><span>Sectie</span><input data-q-section value="${esc(q.section||'Algemeen')}" placeholder="Bijv. Planning"></label><label class="field"><span>Vraagtype</span><select data-q-type><option value="short_text" ${q.type==='short_text'?'selected':''}>Korte tekst</option><option value="long_text" ${q.type==='long_text'?'selected':''}>Lange tekst</option><option value="single_choice" ${q.type==='single_choice'?'selected':''}>Eén keuze</option><option value="multi_choice" ${q.type==='multi_choice'?'selected':''}>Meerdere keuzes</option><option value="scale5" ${q.type==='scale5'?'selected':''}>Schaal 1–5</option><option value="scale10" ${q.type==='scale10'?'selected':''}>Cijfer 1–10</option></select><textarea data-q-options placeholder="Keuzes, één per regel" style="display:${q.type.includes('choice')?'block':'none'}">${esc((q.options||[]).join('\n'))}</textarea><label class="survey-check"><input data-q-required type="checkbox" ${q.required?'checked':''}> Verplicht</label></label><button class="secondary" data-q-remove>Verwijder</button></div>`;
  }
  function editSurvey(s){
    const draft=s||{title:'',description:'',status:'draft',questions:[]};
    const body=`<div class="survey-editor"><label class="field"><span>Titel</span><input id="surveyTitle" value="${esc(draft.title)}" placeholder="Bijv. Evaluatie Barchefs 2026"></label><label class="field"><span>Introductie</span><textarea id="surveyDescription" rows="4">${esc(draft.description||'')}</textarea></label><label class="field"><span>Status</span><select id="surveyStatus"><option value="draft">Concept</option><option value="published" ${draft.status==='published'?'selected':''}>Gepubliceerd</option><option value="closed" ${draft.status==='closed'?'selected':''}>Gesloten</option></select></label><div><div class="survey-recipient-tools"><strong>Vragen</strong><button class="secondary" id="addSurveyQuestion">＋ Vraag toevoegen</button></div><div id="surveyQuestions" class="survey-editor">${questions(draft).map(questionRow).join('')}</div></div></div>`;
    modal(s?'Enquête bewerken':'Nieuwe enquête',body,`<button class="secondary" data-survey-close>Annuleren</button><button class="primary" id="saveSurvey">Opslaan</button>`);
    const box=document.getElementById('surveyQuestions');
    const bindRows=()=>box.querySelectorAll('.survey-question-row').forEach(r=>{r.querySelector('[data-q-remove]').onclick=()=>r.remove();r.querySelector('[data-q-type]').onchange=e=>r.querySelector('[data-q-options]').style.display=e.target.value.includes('choice')?'block':'none'});
    bindRows();document.getElementById('addSurveyQuestion').onclick=()=>{box.insertAdjacentHTML('beforeend',questionRow());bindRows()};
    document.getElementById('saveSurvey').onclick=async()=>{
      const title=document.getElementById('surveyTitle').value.trim();if(!title)return alert('Vul een titel in.');
      const qs=[...box.querySelectorAll('.survey-question-row')].map((r,i)=>({id:r.dataset.qid,type:r.querySelector('[data-q-type]').value,title:r.querySelector('[data-q-title]').value.trim(),section:r.querySelector('[data-q-section]').value.trim()||'Algemeen',required:r.querySelector('[data-q-required]').checked,options:r.querySelector('[data-q-options]').value.split('\n').map(x=>x.trim()).filter(Boolean),order:i})).filter(q=>q.title);
      if(!qs.length)return alert('Voeg minimaal één vraag toe.');
      const payload={title,description:document.getElementById('surveyDescription').value.trim(),status:document.getElementById('surveyStatus').value,questions:qs,festival_year:String(ctx.year),updated_at:new Date().toISOString(),updated_by:ctx.user.id};
      const res=s?await ctx.client.from('vappie_surveys').update(payload).eq('id',s.id):await ctx.client.from('vappie_surveys').insert(payload);
      if(res.error)return alert(`Opslaan mislukt: ${res.error.message}`);document.getElementById('modalRoot').innerHTML='';await reload();ctx.refresh();
    };
  }
  async function copySurvey(s){const p={title:`Kopie van ${s.title}`,description:s.description,status:'draft',questions:s.questions,festival_year:String(ctx.year),updated_by:ctx.user.id};const {error}=await ctx.client.from('vappie_surveys').insert(p);if(error)return alert(error.message);await reload();ctx.refresh()}
  async function deleteSurvey(s){if(!confirm(`Enquête “${s.title}” en alle antwoorden verwijderen?`))return;const {error}=await ctx.client.from('vappie_surveys').delete().eq('id',s.id);if(error)return alert(error.message);await reload();ctx.refresh()}
  function previewSurvey(s){
    const sample={recipient_name:TEST_ASSOCIATION.barchef,association_name:TEST_ASSOCIATION.name,token:'VOORBEELD-LINK'};
    const grouped=[];questions(s).forEach(q=>{const name=q.section||'Vragen';let g=grouped.find(x=>x.name===name);if(!g){g={name,qs:[]};grouped.push(g)}g.qs.push(q)});
    const form=`<div class="survey-preview-form"><header><span class="brand-mark">Z</span><h1>${esc(s.title)}</h1><p>${esc(s.description||'')}</p><strong>${esc(TEST_ASSOCIATION.name)}</strong></header><div class="survey-preview-body">${grouped.map(g=>`<section><h2>${esc(g.name)}</h2>${g.qs.map(previewQuestion).join('')}</section>`).join('')}<button class="primary" type="button" disabled>Evaluatie versturen →</button></div></div>`;
    const email=`<div class="survey-preview-email"><div class="survey-preview-email-meta"><b>Aan:</b> ${esc(TEST_ASSOCIATION.email)}<br><b>Onderwerp:</b> ${esc(s.title)}</div><pre>${esc(mailText(sample,s).replace(surveyUrl(sample.token),'https://jullie-vappie.nl?enquete=PERSOONLIJKE-LINK'))}</pre></div>`;
    modal(`Voorbeeld voor vereniging · ${s.title}`,`<div class="survey-preview-bar"><div class="survey-preview-tabs"><button class="primary" data-preview-tab="mail">✉ Uitnodigingsmail</button><button class="secondary" data-preview-tab="form">▤ Invulformulier</button></div><button class="secondary" data-preview-fullscreen>⛶ Volledig scherm</button></div><div id="surveyPreviewMail">${email}</div><div id="surveyPreviewForm" hidden>${form}</div>`);
    document.querySelectorAll('[data-preview-tab]').forEach(b=>b.onclick=()=>{const mail=b.dataset.previewTab==='mail';document.getElementById('surveyPreviewMail').hidden=!mail;document.getElementById('surveyPreviewForm').hidden=mail;document.querySelectorAll('[data-preview-tab]').forEach(x=>x.className=x===b?'primary':'secondary')});
    document.querySelector('[data-preview-fullscreen]').onclick=e=>{const m=e.target.closest('.modal');m.classList.toggle('survey-fullscreen');e.target.textContent=m.classList.contains('survey-fullscreen')?'⊠ Normaal scherm':'⛶ Volledig scherm'};
  }
  function previewQuestion(q){let input='';if(q.type==='long_text')input='<textarea disabled placeholder="Antwoord van de vereniging…"></textarea>';else if(q.type==='short_text')input='<input disabled placeholder="Antwoord…">';else if(q.type==='single_choice'||q.type==='multi_choice')input=`<div class="survey-options">${(q.options||[]).map(o=>`<label class="survey-option"><input disabled type="${q.type==='multi_choice'?'checkbox':'radio'}"> ${esc(o)}</label>`).join('')}</div>`;else{const max=q.type==='scale10'?10:5;input=`<div class="survey-scale">${Array.from({length:max},(_,n)=>`<label>${n+1}</label>`).join('')}</div>`}return `<div class="survey-public-question"><label>${esc(q.title)}${q.required?' *':''}</label>${input}</div>`}
  function invitationStatus(i){
    if(!i)return '<span class="survey-state neutral">Niet geselecteerd</span>';
    if(i.status==='completed')return '<span class="survey-state completed">✓ Voltooid</span>';
    if(i.opened_at||i.status==='opened')return '<span class="survey-state opened">◉ Geopend</span>';
    if(i.sent_at||i.status==='sent')return '<span class="survey-state sent">✉ Verzonden</span>';
    return '<span class="survey-state neutral">Niet verzonden</span>';
  }
  function recipientModal(s){
    const current=invitations.filter(i=>i.survey_id===s.id), map=Object.fromEntries(current.map(i=>[i.association_id,i]));
    const rows=recipientAssociations().map(a=>{const i=map[a.id],isTest=a.id===TEST_ASSOCIATION.id;return `<tr class="${isTest?'survey-test-row':''}"><td><input type="checkbox" data-recipient="${esc(a.id)}" ${i?'checked':''}></td><td><strong>${esc(a.name)}</strong>${isTest?'<span class="survey-badge test">TEST</span>':''}<small>${esc(a.barchef||'')}</small></td><td>${esc(a.email||'—')}</td><td>${invitationStatus(i)}${i?.opened_at?`<small>${fmt(i.opened_at)}</small>`:''}</td><td>${i?`<button class="secondary" data-mail-one="${i.id}">${i.sent_at?'Opnieuw mailen':'Mail'}</button>`:''}</td></tr>`}).join('');
    modal(`Ontvangers · ${s.title}`,`<div class="survey-recipient-tools"><label class="survey-check"><input id="selectAllRecipients" type="checkbox"> Selecteer alles</label><span>Persoonlijke links worden veilig per vereniging aangemaakt.</span></div><div class="table-card"><div class="table-scroll"><table class="survey-table"><thead><tr><th></th><th>Vereniging</th><th>E-mail</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`,`<button class="secondary" id="saveRecipients">Selectie opslaan</button><button class="primary" id="mailSelected">Geselecteerde uitnodigingen mailen</button>`);
    document.getElementById('selectAllRecipients').onchange=e=>document.querySelectorAll('[data-recipient]').forEach(x=>x.checked=e.target.checked);
    document.getElementById('saveRecipients').onclick=()=>saveRecipients(s,false);
    document.getElementById('mailSelected').onclick=()=>saveRecipients(s,true);
    document.querySelectorAll('[data-mail-one]').forEach(b=>b.onclick=()=>mailInvitation(current.find(i=>i.id===b.dataset.mailOne),s));
  }
  async function saveRecipients(s,mail){
    const ids=[...document.querySelectorAll('[data-recipient]:checked')].map(x=>x.dataset.recipient), existing=invitations.filter(i=>i.survey_id===s.id);
    const add=ids.filter(id=>!existing.some(i=>i.association_id===id)).map(id=>{const a=recipientAssociations().find(x=>x.id===id);return {survey_id:s.id,festival_year:String(ctx.year),association_id:id,association_name:a.name,recipient_name:a.barchef||'',recipient_email:a.email||'',token:uid().replaceAll('-',''),status:'pending'}});
    if(add.length){const {error}=await ctx.client.from('vappie_survey_invitations').insert(add);if(error)return alert(error.message)}
    const remove=existing.filter(i=>!ids.includes(i.association_id)&&i.status!=='completed').map(i=>i.id);if(remove.length){const {error}=await ctx.client.from('vappie_survey_invitations').delete().in('id',remove);if(error)return alert(error.message)}
    await reload();
    if(mail){const selected=invitations.filter(i=>i.survey_id===s.id&&ids.includes(i.association_id)&&i.status!=='completed');if(!selected.length)return alert('Geen openstaande ontvangers geselecteerd.');bulkMail(selected,s)}else{document.getElementById('modalRoot').innerHTML='';ctx.refresh()}
  }
  function mailText(i,s){return `Beste ${i.recipient_name||'Barchef'},\n\nVoor deze Zomerparkfeest-editie komen we nog één keer in actie: de evaluatie. We horen graag wat goed ging en wat we kunnen verbeteren.\n\nVul de enquête voor ${i.association_name} in via jouw persoonlijke link:\n${surveyUrl(i.token)}\n\nAlvast bedankt!\n\nTeam Verenigingen`}
  async function markSent(i){await ctx.client.from('vappie_survey_invitations').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',i.id)}
  function mailInvitation(i,s){const a=document.createElement('a');a.href=`mailto:${encodeURIComponent(i.recipient_email)}?subject=${encodeURIComponent(s.title)}&body=${encodeURIComponent(mailText(i,s))}`;a.click();markSent(i)}
  function bulkMail(list,s){
    if(list.length===1){mailInvitation(list[0],s);return}
    const csv=['Vereniging;Contactpersoon;E-mail;Persoonlijke link',...list.map(i=>[i.association_name,i.recipient_name,i.recipient_email,surveyUrl(i.token)].map(csvCell).join(';'))].join('\r\n');download(`mailing-${slug(s.title)}.csv`,'\ufeff'+csv,'text/csv;charset=utf-8');
    Promise.all(list.map(markSent));alert(`Voor ${list.length} ontvangers is een mailingbestand gedownload. Vanwege de persoonlijke links verstuur je deze via Afdruk samenvoegen in Outlook/Word. De status is op Verzonden gezet.`);document.getElementById('modalRoot').innerHTML='';reload().then(ctx.refresh)
  }
  function resultsModal(s){
    const inv=invitations.filter(i=>i.survey_id===s.id), res=responses.filter(r=>r.survey_id===s.id), map=Object.fromEntries(res.map(r=>[r.invitation_id,r]));
    const opened=inv.filter(i=>i.opened_at).length;
    const rows=inv.map(i=>`<tr><td><strong>${esc(i.association_name)}</strong><small>${esc(i.recipient_name)}</small></td><td>${invitationStatus(i)}</td><td>${i.sent_at?fmt(i.sent_at):'—'}</td><td>${i.opened_at?fmt(i.opened_at):'—'}</td><td>${i.completed_at?fmt(i.completed_at):'—'}</td><td>${map[i.id]?`<button class="secondary" data-view-response="${map[i.id].id}">Resultaat bekijken</button>`:'—'}</td></tr>`).join('');
    modal(`Status & resultaten · ${s.title}`,`<div class="survey-kpis"><div class="survey-kpi"><span>Uitgenodigd</span><strong>${inv.length}</strong></div><div class="survey-kpi"><span>Geopend</span><strong>${opened}</strong></div><div class="survey-kpi"><span>Voltooid</span><strong>${res.length}</strong></div><div class="survey-kpi"><span>Respons</span><strong>${inv.length?Math.round(res.length/inv.length*100):0}%</strong></div></div><div class="survey-recipient-tools"><span>De status wordt bijgewerkt zodra je dit overzicht opent of op verversen klikt.</span><button class="secondary" id="refreshSurveyResults">↻ Verversen</button></div><div class="table-card"><div class="table-scroll"><table><thead><tr><th>Vereniging</th><th>Status</th><th>Verzonden</th><th>Geopend</th><th>Voltooid</th><th>Resultaat</th></tr></thead><tbody>${rows}</tbody></table></div></div>`,`<button class="secondary" id="remindSurvey">Herinneringsbestand</button><button class="primary" id="exportSurvey">Export Excel</button>`);
    document.getElementById('exportSurvey').onclick=()=>exportResults(s,inv,res);
    document.getElementById('remindSurvey').onclick=()=>bulkMail(inv.filter(i=>i.status!=='completed'),s);
    document.getElementById('refreshSurveyResults').onclick=async()=>{await reload();resultsModal(byId(s.id))};
    document.querySelectorAll('[data-view-response]').forEach(b=>b.onclick=()=>viewResponse(s,res.find(r=>r.id===b.dataset.viewResponse),inv));
  }
  function viewResponse(s,r,inv){const i=inv.find(x=>x.id===r.invitation_id), ans=r.answers||{};modal(`Antwoorden · ${i?.association_name||''}`,questions(s).map(q=>`<div class="survey-public-question"><label>${esc(q.title)}</label><div class="survey-answer">${esc(Array.isArray(ans[q.id])?ans[q.id].join(', '):(ans[q.id]??'—'))}</div></div>`).join(''))}
  function exportResults(s,inv,res){
    const headers=['Vereniging','Contactpersoon','E-mail','Status','Datum verzonden','Datum geopend','Datum voltooid',...questions(s).map(q=>q.title)];
    const rows=inv.map(i=>{const r=res.find(x=>x.invitation_id===i.id),a=r?.answers||{};return [i.association_name,i.recipient_name,i.recipient_email,i.status,i.sent_at||'',i.opened_at||'',i.completed_at||'',...questions(s).map(q=>Array.isArray(a[q.id])?a[q.id].join(', '):(a[q.id]??''))]});
    if(window.XLSX){const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);ws['!cols']=headers.map((h,i)=>({wch:Math.min(60,Math.max(14,h.length+2,...rows.map(r=>String(r[i]||'').length+2)))}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Resultaten');XLSX.writeFile(wb,`resultaten-${slug(s.title)}.xlsx`);return}
    download(`resultaten-${slug(s.title)}.csv`,'\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8')
  }
  function csvCell(v){return `"${String(v??'').replaceAll('"','""')}"`}
  function slug(v){return String(v||'enquete').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
  function download(name,data,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
  function showSetupError(err){const target=document.querySelector('.survey-page');if(target)target.insertAdjacentHTML('afterbegin',`<div class="notice"><b>!</b><div><strong>Database-installatie nodig</strong><p>Voer SUPABASE_ENQUETES_SETUP.sql uit. Technische melding: ${esc(err.message)}</p></div></div>`)}
  async function loadSupabase(){if(window.supabase?.createClient)return;await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
  async function openPublic({app,token,config}){
    app.innerHTML='<main class="survey-public"><section class="survey-public-shell"><div class="survey-thanks">Enquête laden…</div></section></main>';
    try{await loadSupabase();const client=window.supabase.createClient(config.url,config.key,{auth:{persistSession:false}});const {data,error}=await client.rpc('get_public_survey',{p_token:token});if(error)throw error;if(!data?.survey)throw new Error('Deze persoonlijke link is niet geldig.');renderPublic(app,client,token,data)}catch(err){app.innerHTML=`<main class="survey-public"><section class="survey-public-shell"><div class="survey-thanks"><h1>Link niet beschikbaar</h1><p>${esc(err.message)}</p></div></section></main>`}
  }
  function renderPublic(app,client,token,data){const s=data.survey,i=data.invitation;if(i.status==='completed'){app.innerHTML=`<main class="survey-public"><section class="survey-public-shell"><div class="survey-thanks"><h1>Bedankt!</h1><p>De evaluatie voor ${esc(i.association_name)} is al ingevuld.</p></div></section></main>`;return}
    const grouped=[];questions(s).forEach(q=>{const section=q.section||'Vragen';let g=grouped.find(x=>x.name===section);if(!g){g={name:section,qs:[]};grouped.push(g)}g.qs.push(q)});
    app.innerHTML=`<main class="survey-public"><section class="survey-public-shell"><div class="survey-progress"><i style="width:15%"></i></div><header class="survey-public-head"><span class="brand-mark">Z</span><h1>${esc(s.title)}</h1><p>${esc(s.description||'')}</p><p><strong>${esc(i.association_name)}</strong></p></header><form class="survey-public-form" id="publicSurveyForm">${grouped.map(g=>`<section class="survey-public-section"><h2>${esc(g.name)}</h2>${g.qs.map(publicQuestion).join('')}</section>`).join('')}<button class="primary" type="submit">Evaluatie versturen →</button></form></section></main>`;
    const form=document.getElementById('publicSurveyForm');form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form);const missing=questions(s).find(q=>q.required&&(q.type==='multi_choice'?!fd.getAll(q.id).length:!fd.get(q.id)));if(missing)return alert(`Vul de verplichte vraag in: ${missing.title}`);const btn=form.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Versturen…';const answers={};questions(s).forEach(q=>{answers[q.id]=q.type==='multi_choice'?fd.getAll(q.id):fd.get(q.id)||''});const {data:ok,error}=await client.rpc('submit_public_survey',{p_token:token,p_answers:answers});if(error||!ok){btn.disabled=false;btn.textContent='Evaluatie versturen →';return alert(`Versturen mislukt: ${error?.message||'Probeer het opnieuw.'}`)}app.innerHTML=`<main class="survey-public"><section class="survey-public-shell"><div class="survey-thanks"><span class="brand-mark">Z</span><h1>Bedankt!</h1><p>Jullie antwoorden zijn goed ontvangen. Samen maken we Zomerparkfeest ieder jaar nóg verrökkelijker! 🎪🍻</p></div></section></main>`}
  }
  function publicQuestion(q){const req=q.required?'required':'';let input='';if(q.type==='long_text')input=`<textarea name="${q.id}" ${req}></textarea>`;else if(q.type==='short_text')input=`<input type="text" name="${q.id}" ${req}>`;else if(q.type==='single_choice'||q.type==='multi_choice')input=`<div class="survey-options">${(q.options||[]).map((o,n)=>`<label class="survey-option"><input type="${q.type==='multi_choice'?'checkbox':'radio'}" name="${q.id}" value="${esc(o)}" ${q.type==='single_choice'&&n===0?req:''}> ${esc(o)}</label>`).join('')}</div>`;else{const max=q.type==='scale10'?10:5;input=`<div class="survey-scale">${Array.from({length:max},(_,x)=>`<label><input type="radio" name="${q.id}" value="${x+1}" ${x===0?req:''}>${x+1}</label>`).join('')}</div>`}return `<div class="survey-public-question"><label>${esc(q.title)}${q.required?' *':''}</label>${input}</div>`}
  window.VappieEnquetes={adminHtml,bindAdmin,openPublic,parseMarkdown};
})();
