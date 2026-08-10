(() => {
  'use strict';

  const SB_URL='https://ngijjzcizhwoeieaelgz.supabase.co';
  const SB_KEY='sb_publishable_fQFpxmC6XeNeJ0yOv52S7g_VIbs2jLg';
  const TABLE='vappie_meldingen';
  const REACTION_TABLE='vappie_melding_reacties';
  const PHOTO_BUCKET='vappie-melding-fotos';
  const PREVIEW_KEY='vappie-external-preview-v1';

  let client=null;
  let currentUser=null;
  let trueExternal=false;
  let rendering=false;

  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function userRole(user){
    return user?.app_metadata?.role || user?.user_metadata?.role || '';
  }

  function isExternalRole(user){
    return userRole(user)==='external_reporter';
  }

  function isPreview(){
    try{return sessionStorage.getItem(PREVIEW_KEY)==='1'}catch{return false}
  }

  async function getClient(){
    if(window.__VAPPIE_EXTERNAL_TEST_CLIENT)return window.__VAPPIE_EXTERNAL_TEST_CLIENT;
    if(client)return client;

    if(!window.supabase?.createClient){
      for(let i=0;i<40&&!window.supabase?.createClient;i++){
        await new Promise(r=>setTimeout(r,100));
      }
    }
    if(!window.supabase?.createClient)throw new Error('Supabase is nog niet geladen.');

    client=window.supabase.createClient(SB_URL,SB_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    return client;
  }

  async function getUser(){
    if(window.__VAPPIE_EXTERNAL_TEST_USER)return window.__VAPPIE_EXTERNAL_TEST_USER;
    const c=await getClient();
    const {data:{session}}=await c.auth.getSession();
    return session?.user||null;
  }

  function displayName(user){
    const m=user?.user_metadata||{};
    return m.display_name||m.full_name||m.name||user?.email?.split('@')[0]||'Externe melder';
  }

  function initials(user){
    const name=displayName(user).trim();
    return (name[0]||'E').toUpperCase();
  }

  function injectAdminSwitch(){
    if(trueExternal||isPreview())return;
    const topbar=document.querySelector('.workspace-topbar');
    if(!topbar||topbar.querySelector('[data-external-preview]'))return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='topbar-action external-preview-toggle';
    btn.dataset.externalPreview='1';
    btn.title='Bekijk Vappie zoals een externe melder';
    btn.innerHTML='<b>↔</b><span>Externe weergave</span>';
    btn.addEventListener('click',()=>{
      try{sessionStorage.setItem(PREVIEW_KEY,'1')}catch{}
      renderExternalPortal(true);
    });

    const spacer=topbar.querySelector('.topbar-spacer');
    if(spacer)spacer.insertAdjacentElement('afterend',btn);
    else topbar.appendChild(btn);
  }

  function portalHtml(preview){
    const user=currentUser;
    const now=new Date();
    return `<main class="external-shell">
      <header class="external-topbar">
        <div class="external-brand">
          <span class="external-brand-mark">Z</span>
          <div><strong>Vappie</strong><small>EXTERNE MELDINGEN</small></div>
        </div>
        <div class="external-top-actions">
          ${preview?'<button type="button" class="external-back" id="externalBack">← Terug naar beheer</button>':''}
          <div class="external-user"><span>${esc(initials(user))}</span><div><strong>${esc(displayName(user))}</strong><small>${esc(user?.email||'')}</small></div></div>
          ${preview?'':'<button type="button" class="external-logout" id="externalLogout">Uitloggen</button>'}
        </div>
      </header>

      ${preview?'<div class="external-preview-banner"><b>Voorbeeldweergave</b> · Zo ziet een externe melder Vappie.</div>':''}

      <section class="external-content">
        <div class="external-intro">
          <span>MELDINGEN</span>
          <h1>Melding doorgeven</h1>
          <p>Geef een calamiteit of bijzonderheid door aan Team Verenigingen. Je ziet hieronder alleen je eigen meldingen.</p>
        </div>

        <section class="external-card external-form-card">
          <div class="external-card-head"><div><small>NIEUWE MELDING</small><h2>Wat is er aan de hand?</h2></div><span class="external-status-pill">Direct naar Team Verenigingen</span></div>
          <div class="external-form-grid">
            <label><span>Naam</span><input id="extName" value="${esc(displayName(user))}" placeholder="Naam"></label>
            <label><span>Datum</span><input id="extDate" type="date" value="${now.toISOString().slice(0,10)}"></label>
            <label><span>Tijd</span><input id="extTime" type="time" value="${now.toTimeString().slice(0,5)}"></label>
            <label><span>Betreft</span><input id="extSubject" placeholder="Waar gaat de melding over?"></label>
            <label class="external-full"><span>Melding</span><textarea id="extMessage" rows="5" placeholder="Omschrijf de calamiteit zo duidelijk mogelijk..."></textarea></label>
            <label class="external-full"><span>Foto's <small>(optioneel, maximaal 5)</small></span><input id="extPhotos" type="file" accept="image/*" multiple><div id="extPreview" class="external-photo-preview"></div></label>
          </div>
          <div class="external-form-actions">
            <span id="extFormStatus"></span>
            <button type="button" class="external-primary" id="extSubmit">Melding versturen →</button>
          </div>
        </section>

        <section class="external-own">
          <div class="external-section-head"><div><small>MIJN MELDINGEN</small><h2>Eerder doorgegeven</h2></div><button type="button" id="extRefresh">↻ Vernieuwen</button></div>
          <div id="extListStatus" class="external-list-status">Meldingen laden…</div>
          <div id="extList" class="external-list"></div>
        </section>
      </section>
    </main>`;
  }

  async function resizePhoto(file){
    const bitmap=await createImageBitmap(file);
    const max=1600;
    const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close?.();
    return await new Promise((resolve,reject)=>{
      canvas.toBlob(b=>b?resolve(b):reject(new Error('Foto kon niet worden verwerkt.')),'image/jpeg',0.8);
    });
  }

  function previewSelectedPhotos(){
    const input=document.getElementById('extPhotos');
    const preview=document.getElementById('extPreview');
    if(!input||!preview)return;

    const files=[...(input.files||[])];
    if(files.length>5){
      alert("Je kunt maximaal 5 foto's toevoegen.");
      input.value='';
      preview.innerHTML='';
      return;
    }

    preview.innerHTML='';
    files.forEach(file=>{
      const url=URL.createObjectURL(file);
      const img=document.createElement('img');
      img.src=url;
      img.alt='Voorbeeld foto';
      img.onload=()=>URL.revokeObjectURL(url);
      preview.appendChild(img);
    });
  }

  async function uploadPhotos(meldingId){
    const files=[...(document.getElementById('extPhotos')?.files||[])];
    if(files.length>5)throw new Error("Je kunt maximaal 5 foto's toevoegen.");
    if(!files.length)return;

    const c=await getClient();
    for(let i=0;i<files.length;i++){
      const blob=await resizePhoto(files[i]);
      const path=`${meldingId}/${Date.now()}_${i}_${Math.random().toString(36).slice(2,8)}.jpg`;
      const {error}=await c.storage.from(PHOTO_BUCKET).upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});
      if(error)throw error;
    }
  }

  async function photoUrls(meldingId){
    if(window.__VAPPIE_EXTERNAL_TEST_PHOTOS?.[meldingId])return window.__VAPPIE_EXTERNAL_TEST_PHOTOS[meldingId];
    const c=await getClient();
    const {data,error}=await c.storage.from(PHOTO_BUCKET).list(String(meldingId),{limit:5,sortBy:{column:'created_at',order:'asc'}});
    if(error)return [];
    const urls=[];
    for(const f of (data||[]).filter(x=>x?.name&&!x.name.startsWith('.')).slice(0,5)){
      const {data:signed}=await c.storage.from(PHOTO_BUCKET).createSignedUrl(`${meldingId}/${f.name}`,3600);
      if(signed?.signedUrl)urls.push(signed.signedUrl);
    }
    return urls;
  }

  async function fetchOwnReports(){
    if(window.__VAPPIE_EXTERNAL_TEST_REPORTS)return window.__VAPPIE_EXTERNAL_TEST_REPORTS;
    const c=await getClient();
    const {data,error}=await c.from(TABLE).select('*').eq('created_by',currentUser.id).order('created_at',{ascending:false});
    if(error)throw error;
    return data||[];
  }

  async function fetchReactions(ids){
    if(window.__VAPPIE_EXTERNAL_TEST_REACTIONS)return window.__VAPPIE_EXTERNAL_TEST_REACTIONS;
    if(!ids.length)return [];
    const c=await getClient();
    const {data,error}=await c.from(REACTION_TABLE).select('*').in('melding_id',ids).order('created_at',{ascending:true});
    if(error)return [];
    return data||[];
  }

  function reactionsFor(all,id){
    return (all||[]).filter(r=>String(r.melding_id)===String(id));
  }

  async function addReaction(meldingId,input){
    const text=input.value.trim();
    if(!text)return;
    const c=await getClient();
    const {error}=await c.from(REACTION_TABLE).insert({
      melding_id:meldingId,
      user_id:currentUser.id,
      name:displayName(currentUser),
      message:text
    });
    if(error)throw error;
    input.value='';
    await loadOwnReports();
  }

  async function loadOwnReports(){
    const list=document.getElementById('extList');
    const status=document.getElementById('extListStatus');
    if(!list||!status)return;

    status.textContent='Meldingen laden…';
    list.innerHTML='';

    try{
      const reports=await fetchOwnReports();
      const reactions=await fetchReactions(reports.map(r=>r.id));
      status.textContent=`${reports.length} melding${reports.length===1?'':'en'}`;

      if(!reports.length){
        list.innerHTML='<div class="external-empty"><b>Nog geen meldingen.</b><span>Je eerste melding verschijnt hier na het versturen.</span></div>';
        return;
      }

      for(const r of reports){
        const photos=await photoUrls(r.id);
        const reacts=reactionsFor(reactions,r.id);
        const card=document.createElement('article');
        card.className='external-report';
        card.innerHTML=`
          <div class="external-report-head">
            <div><span class="external-state ${r.handled?'done':'open'}">${r.handled?'Afgehandeld':'Open'}</span><h3>${esc(r.subject)}</h3></div>
            <small>${esc(r.notice_date)} · ${esc(String(r.notice_time||'').slice(0,5))}</small>
          </div>
          <p>${esc(r.message)}</p>
          ${photos.length?`<div class="external-report-photos">${photos.map(u=>`<img src="${u}" alt="Foto bij melding">`).join('')}</div>`:''}
          <div class="external-reactions">
            <strong>Reacties</strong>
            ${reacts.length?reacts.map(x=>`<div class="external-reaction"><b>${esc(x.name||'Team Verenigingen')}</b><span>${esc(x.message)}</span></div>`).join(''):'<small>Nog geen reacties.</small>'}
            <div class="external-reply"><input type="text" placeholder="Reageer op deze melding..."><button type="button">Reageren</button></div>
          </div>`;
        const reply=card.querySelector('.external-reply input');
        card.querySelector('.external-reply button').onclick=()=>addReaction(r.id,reply).catch(err=>alert(err?.message||err));
        list.appendChild(card);
      }
    }catch(err){
      status.textContent=`Meldingen konden niet worden geladen: ${err?.message||err}`;
    }
  }

  async function submitReport(){
    const status=document.getElementById('extFormStatus');
    const btn=document.getElementById('extSubmit');
    const row={
      name:document.getElementById('extName')?.value.trim(),
      notice_date:document.getElementById('extDate')?.value,
      notice_time:document.getElementById('extTime')?.value,
      subject:document.getElementById('extSubject')?.value.trim(),
      message:document.getElementById('extMessage')?.value.trim(),
      handled:false,
      created_by:currentUser.id
    };

    if(!row.name||!row.notice_date||!row.notice_time||!row.subject||!row.message){
      status.textContent='Vul alle velden in.';
      return;
    }

    const files=[...(document.getElementById('extPhotos')?.files||[])];
    if(files.length>5){
      status.textContent="Je kunt maximaal 5 foto's toevoegen.";
      return;
    }

    btn.disabled=true;
    btn.textContent='Versturen…';
    status.textContent='';

    try{
      if(window.__VAPPIE_EXTERNAL_TEST_CLIENT){
        status.textContent='Melding verzonden ✓';
      }else{
        const c=await getClient();
        const {data,error}=await c.from(TABLE).insert(row).select().single();
        if(error)throw error;
        await uploadPhotos(data.id);
        status.textContent='Melding verzonden ✓';
      }

      document.getElementById('extSubject').value='';
      document.getElementById('extMessage').value='';
      document.getElementById('extPhotos').value='';
      document.getElementById('extPreview').innerHTML='';
      await loadOwnReports();
    }catch(err){
      status.textContent=`Versturen mislukt: ${err?.message||err}`;
    }finally{
      btn.disabled=false;
      btn.textContent='Melding versturen →';
    }
  }

  async function renderExternalPortal(preview=false){
    if(rendering)return;
    rendering=true;
    try{
      document.documentElement.classList.remove('vappie-role-check');
      const app=document.getElementById('app');
      if(!app)return;
      app.innerHTML=portalHtml(preview);
      document.body.classList.toggle('external-preview-mode',preview);
      document.body.classList.toggle('external-user-mode',!preview);

      document.getElementById('extPhotos')?.addEventListener('change',previewSelectedPhotos);
      document.getElementById('extSubmit')?.addEventListener('click',submitReport);
      document.getElementById('extRefresh')?.addEventListener('click',loadOwnReports);

      if(preview){
        document.getElementById('externalBack')?.addEventListener('click',()=>{
          try{sessionStorage.removeItem(PREVIEW_KEY)}catch{}
          location.reload();
        });
      }else{
        document.getElementById('externalLogout')?.addEventListener('click',async()=>{
          try{(await getClient()).auth.signOut()}catch{}
          location.reload();
        });
      }

      await loadOwnReports();
    }finally{
      rendering=false;
    }
  }

  async function enforceRole(){
    try{
      currentUser=await getUser();
      if(!currentUser){
        document.documentElement.classList.remove('vappie-role-check');
        return;
      }

      trueExternal=isExternalRole(currentUser);

      if(trueExternal){
        try{
          localStorage.removeItem('vappie-data-v2');
          localStorage.removeItem('vappie-supabase-dirty-v1');
        }catch{}
        await renderExternalPortal(false);
        return;
      }

      if(isPreview()){
        await renderExternalPortal(true);
        return;
      }

      document.documentElement.classList.remove('vappie-role-check');
      injectAdminSwitch();
    }catch(err){
      console.warn('Externe rolcontrole:',err);
      document.documentElement.classList.remove('vappie-role-check');
    }
  }

  const obs=new MutationObserver(()=>{
    if(trueExternal){
      if(!document.querySelector('.external-shell'))renderExternalPortal(false);
      return;
    }
    if(isPreview()){
      if(!document.querySelector('.external-shell'))renderExternalPortal(true);
      return;
    }
    injectAdminSwitch();
  });
  obs.observe(document.documentElement,{childList:true,subtree:true});

  setTimeout(enforceRole,150);

  (async()=>{
    try{
      const c=await getClient();
      c.auth.onAuthStateChange(()=>setTimeout(enforceRole,80));
    }catch{}
  })();

  window.__VappieExternalPortal={
    enforceRole,
    renderExternalPortal,
    injectAdminSwitch,
    isExternalRole,
    portalHtml,
    _setTestUser:(u)=>{currentUser=u;}
  };
})();