(() => {
  'use strict';

  const TABLE='vappie_meldingen';
  const READ_TABLE='vappie_melding_reads';
  const REACTION_TABLE='vappie_melding_reacties';
  const MELD_PHOTO_BUCKET='vappie-melding-fotos';
  const SB_URL='https://ngijjzcizhwoeieaelgz.supabase.co';
  const SB_KEY='sb_publishable_fQFpxmC6XeNeJ0yOv52S7g_VIbs2jLg';

  let client=null;
  let active=false;
  let restoring=false;
  let tab='open';
  let editingId=null;

  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  async function getClient(){
    if(client)return client;
    if(!window.supabase?.createClient)throw new Error('Supabase is nog niet geladen.');
    client=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return client;
  }

  async function session(){
    const c=await getClient();
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw new Error('Je bent niet aangemeld bij Supabase.');
    return {c,session};
  }

  function ensureNav(){
    const nav=document.querySelector('.sidebar-nav');
    if(!nav)return null;

    let btn=nav.querySelector('[data-meldingen-page]');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.setAttribute('data-meldingen-page','1');
      btn.setAttribute('aria-label','Meldingen openen');
      btn.innerHTML='<b>!</b><span>Meldingen</span><em class="meldingen-badge" hidden>0</em>';
    }

    if(btn.dataset.v36Bound!=='1'){
      btn.dataset.v36Bound='1';
      const openFromButton=(e)=>{
        e.preventDefault();
        e.stopPropagation();
        window.VappieOpenMeldingen();
      };
      btn.addEventListener('pointerdown',openFromButton);
      btn.addEventListener('click',openFromButton);
    }

    const occupancy=nav.querySelector('[data-page="occupancy"]');
    if(occupancy){
      if(occupancy.nextElementSibling!==btn)occupancy.insertAdjacentElement('afterend',btn);
    }else if(!btn.isConnected){
      nav.appendChild(btn);
    }
    return btn;
  }

  function pageHtml(){
    const now=new Date();
    return `<section class="meldingen-page">
      <div class="meldingen-head">
        <div>
          <span class="eyebrow">TEAM VERENIGINGEN</span>
          <h1>Meldingen</h1>
          <p>Leg calamiteiten vast, reageer erop en rond ze af.</p>
        </div>
        <div class="meld-head-actions">
          <button type="button" class="secondary meld-badge-permission" id="meldBadgePermission" hidden>● App-badge activeren</button>
          <button type="button" class="primary" id="meldNew">＋ Nieuwe melding</button>
        </div>
      </div>

      <section class="meldingen-form" id="meldForm" hidden>
        <div class="meld-form-head"><h3 id="meldFormTitle">Nieuwe melding</h3><button type="button" id="meldClose">×</button></div>
        <div class="meld-grid">
          <label><span>Naam</span><input id="meldName" placeholder="Naam melder"></label>
          <label><span>Datum</span><input id="meldDate" type="date" value="${now.toISOString().slice(0,10)}"></label>
          <label><span>Tijd</span><input id="meldTime" type="time" value="${now.toTimeString().slice(0,5)}"></label>
          <label><span>Betreft</span><input id="meldSubject" placeholder="Waar gaat de melding over?"></label>
          <label class="full"><span>Melding</span><textarea id="meldMessage" rows="5" placeholder="Omschrijf de calamiteit zo duidelijk mogelijk..."></textarea></label>
          <label class="full meld-photo-field">
            <span>Foto's <small>(maximaal 5)</small></span>
            <input id="meldPhotos" type="file" accept="image/*" multiple>
            <div id="meldPhotoPreview" class="meld-photo-preview"></div>
          </label>
        </div>
        <div class="meld-actions">
          <button type="button" class="secondary" id="meldCancel">Annuleren</button>
          <button type="button" class="primary" id="meldSave">✓ Melding opslaan</button>
        </div>
      </section>

      <div class="meld-tabs">
        <button type="button" class="meld-tab active" data-meld-tab="open">Open</button>
        <button type="button" class="meld-tab" data-meld-tab="handled">Afgehandeld</button>
      </div>

      <div class="meld-list-head">
        <div><span>MELDINGENLOGBOEK</span><h3 id="meldListTitle">Open meldingen</h3></div>
        <button type="button" class="secondary" id="meldRefresh">↻ Vernieuwen</button>
      </div>
      <div id="meldStatus" class="meld-status">Meldingen laden…</div>
      <div id="meldList" class="meld-list"></div>
    </section>`;
  }

  async function openPage(){
    active=true;
    document.body.dataset.meldingenActive='1';

    const main=document.querySelector('.workspace-main');
    if(!main){
      console.warn('Meldingen: workspace-main niet gevonden.');
      return false;
    }

    document.querySelectorAll('.sidebar-nav button').forEach(b=>b.classList.remove('active'));
    ensureNav()?.classList.add('active');
    document.getElementById('nav')?.classList.remove('open');

    main.className='workspace-main main';
    main.innerHTML=pageHtml();
    bindPage();
    return true;
  }

  async function fetchNotices(){
    const {c}=await session();
    const {data,error}=await c.from(TABLE).select('*').order('created_at',{ascending:false});
    if(error)throw error;
    return data||[];
  }

  async function readIds(){
    const {c,session:s}=await session();
    const {data,error}=await c.from(READ_TABLE).select('melding_id').eq('user_id',s.user.id);
    if(error)throw error;
    return new Set((data||[]).map(x=>String(x.melding_id)));
  }

  async function markRead(ids){
    if(!ids.length)return;
    const {c,session:s}=await session();
    const rows=[...new Set(ids.map(String))].map(id=>({user_id:s.user.id,melding_id:id,read_at:new Date().toISOString()}));
    const {error}=await c.from(READ_TABLE).upsert(rows,{onConflict:'user_id,melding_id'});
    if(error)throw error;
  }

  async function fetchReactions(ids){
    if(!ids.length)return new Map();
    const {c}=await session();
    const {data,error}=await c.from(REACTION_TABLE).select('*').in('melding_id',ids).order('created_at',{ascending:true});
    if(error)throw error;
    const map=new Map();
    (data||[]).forEach(r=>{
      const key=String(r.melding_id);
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(r);
    });
    return map;
  }


  async function resizeMeldPhoto(file){
    const bitmap=await createImageBitmap(file);
    const max=1600;
    const factor=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*factor));
    const h=Math.max(1,Math.round(bitmap.height*factor));
    const canvas=document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.drawImage(bitmap,0,0,w,h);
    bitmap.close?.();
    return await new Promise((resolve,reject)=>{
      canvas.toBlob(
        blob=>blob?resolve(blob):reject(new Error('Foto kon niet worden verwerkt.')),
        'image/jpeg',
        0.80
      );
    });
  }

  function selectedMeldPhotos(){
    return [...(document.getElementById('meldPhotos')?.files||[])];
  }

  function renderMeldPhotoPreview(){
    const preview=document.getElementById('meldPhotoPreview');
    const input=document.getElementById('meldPhotos');
    if(!preview||!input)return;

    const files=[...(input.files||[])];
    if(files.length>5){
      alert("Je kunt maximaal 5 foto's aan een melding toevoegen.");
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

  async function uploadMeldPhotos(meldingId){
    const files=selectedMeldPhotos();
    if(files.length>5)throw new Error("Je kunt maximaal 5 foto's toevoegen.");
    if(!files.length)return;

    const {c}=await session();
    for(let i=0;i<files.length;i++){
      const blob=await resizeMeldPhoto(files[i]);
      const filename=`${meldingId}/${Date.now()}_${i}_${Math.random().toString(36).slice(2,8)}.jpg`;
      const {error}=await c.storage.from(MELD_PHOTO_BUCKET).upload(filename,blob,{
        contentType:'image/jpeg',
        cacheControl:'3600',
        upsert:false
      });
      if(error)throw error;
    }
  }

  async function fetchMeldPhotos(meldingId){
    const {c}=await session();
    const {data,error}=await c.storage.from(MELD_PHOTO_BUCKET).list(String(meldingId),{
      limit:5,
      sortBy:{column:'created_at',order:'asc'}
    });
    if(error)return [];

    const urls=[];
    for(const f of (data||[]).filter(x=>x?.name&&!x.name.startsWith('.')).slice(0,5)){
      const path=`${meldingId}/${f.name}`;
      const {data:signed}=await c.storage.from(MELD_PHOTO_BUCKET).createSignedUrl(path,3600);
      if(signed?.signedUrl)urls.push(signed.signedUrl);
    }
    return urls;
  }

  function meldPhotosHtml(urls){
    if(!urls?.length)return '';
    return `<div class="meld-attached-photos">${urls.map(u=>`<button type="button" class="meld-photo-thumb"><img src="${u}" alt="Foto bij melding"></button>`).join('')}</div>`;
  }

  function openMeldPhoto(url){
    const box=document.createElement('div');
    box.className='meld-photo-lightbox';
    box.innerHTML=`<button type="button" class="meld-photo-close">×</button><img src="${url}" alt="Vergrote foto">`;
    box.addEventListener('click',e=>{
      if(e.target===box||e.target.closest('.meld-photo-close'))box.remove();
    });
    document.body.appendChild(box);
  }


  function resetMeldForm(){
    editingId=null;
    const form=document.getElementById('meldForm');
    if(!form)return;

    const now=new Date();
    document.getElementById('meldFormTitle').textContent='Nieuwe melding';
    document.getElementById('meldSave').textContent='✓ Melding opslaan';
    document.getElementById('meldName').value='';
    document.getElementById('meldDate').value=now.toISOString().slice(0,10);
    document.getElementById('meldTime').value=now.toTimeString().slice(0,5);
    document.getElementById('meldSubject').value='';
    document.getElementById('meldMessage').value='';
    const photoInput=document.getElementById('meldPhotos');
    if(photoInput)photoInput.value='';
    const preview=document.getElementById('meldPhotoPreview');
    if(preview)preview.innerHTML='';
  }

  function editNotice(n){
    editingId=n.id;
    const form=document.getElementById('meldForm');
    if(!form)return;
    form.hidden=false;

    document.getElementById('meldFormTitle').textContent='Melding bewerken';
    document.getElementById('meldSave').textContent='✓ Wijzigingen opslaan';
    document.getElementById('meldName').value=n.name||'';
    document.getElementById('meldDate').value=n.notice_date||'';
    document.getElementById('meldTime').value=String(n.notice_time||'').slice(0,5);
    document.getElementById('meldSubject').value=n.subject||'';
    document.getElementById('meldMessage').value=n.message||'';

    const photoInput=document.getElementById('meldPhotos');
    if(photoInput)photoInput.value='';
    const preview=document.getElementById('meldPhotoPreview');
    if(preview)preview.innerHTML="<small>Bestaande foto's blijven behouden. Kies alleen nieuwe foto's als je extra foto's wilt toevoegen.</small>";

    form.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function saveNotice(){
    const row={
      name:document.getElementById('meldName')?.value.trim(),
      notice_date:document.getElementById('meldDate')?.value,
      notice_time:document.getElementById('meldTime')?.value,
      subject:document.getElementById('meldSubject')?.value.trim(),
      message:document.getElementById('meldMessage')?.value.trim()
    };

    if(!row.name||!row.notice_date||!row.notice_time||!row.subject||!row.message){
      alert('Vul alle velden volledig in.');
      return;
    }

    const btn=document.getElementById('meldSave');
    if(btn){btn.disabled=true;btn.textContent=editingId?'Wijzigingen opslaan…':'Opslaan…';}

    try{
      const {c,session:s}=await session();

      if(editingId){
        const {error}=await c.from(TABLE).update(row).eq('id',editingId);
        if(error)throw error;

        const newFiles=selectedMeldPhotos();
        if(newFiles.length){
          const existing=await fetchMeldPhotos(editingId);
          if(existing.length+newFiles.length>5){
            throw new Error(`Deze melding heeft al ${existing.length} foto('s). Maximaal 5 foto's per melding.`);
          }
          await uploadMeldPhotos(editingId);
        }
      }else{
        row.handled=false;
        row.created_by=s.user.id;
        const {data,error}=await c.from(TABLE).insert(row).select().single();
        if(error)throw error;
        await markRead([data.id]);
        await uploadMeldPhotos(data.id);
      }

      document.getElementById('meldForm').hidden=true;
      resetMeldForm();
      tab='open';
      syncTabs();
      await loadList(true);
      await refreshState();
    }catch(err){
      alert(`Melding opslaan mislukt: ${err?.message||err}`);
    }finally{
      if(btn){
        btn.disabled=false;
        btn.textContent=editingId?'✓ Wijzigingen opslaan':'✓ Melding opslaan';
      }
    }
  }

  async function setHandled(id,handled){
    try{
      const {c,session:s}=await session();
      const payload=handled
        ? {handled:true,handled_at:new Date().toISOString(),handled_by:s.user.id}
        : {handled:false,handled_at:null,handled_by:null};

      const {error}=await c.from(TABLE).update(payload).eq('id',id);
      if(error)throw error;

      await loadList(false);
      await refreshState();
    }catch(err){
      alert(`Afhandeling wijzigen mislukt: ${err?.message||err}`);
    }
  }

  async function addReaction(id,card){
    const input=card.querySelector('[data-reaction-input]');
    const message=input?.value.trim();
    if(!message)return;

    try{
      const {c,session:s}=await session();
      const name=s.user?.user_metadata?.display_name||
                 s.user?.user_metadata?.full_name||
                 s.user?.email?.split('@')[0]||
                 'Vappie gebruiker';

      const {error}=await c.from(REACTION_TABLE).insert({
        melding_id:id,
        user_id:s.user.id,
        name,
        message
      });
      if(error)throw error;

      input.value='';
      await loadList(false);
    }catch(err){
      alert(`Reactie opslaan mislukt: ${err?.message||err}`);
    }
  }

  function reactionsHtml(items){
    if(!items?.length)return '<div class="meld-no-reactions">Nog geen reacties.</div>';
    return items.map(r=>`
      <div class="meld-reaction">
        <div><strong>${esc(r.name)}</strong><small>${new Date(r.created_at).toLocaleString('nl-NL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></div>
        <p>${esc(r.message)}</p>
      </div>`).join('');
  }

  async function loadList(markVisibleRead=true){
    const status=document.getElementById('meldStatus');
    const list=document.getElementById('meldList');
    if(!status||!list)return;

    status.textContent='Meldingen laden…';
    list.innerHTML='';

    try{
      const notices=await fetchNotices();
      const reads=await readIds();
      const shown=notices.filter(n=>tab==='handled'?!!n.handled:!n.handled);
      const reactions=await fetchReactions(shown.map(n=>n.id));
      const photosById=new Map();
      for(const n of shown){
        photosById.set(String(n.id),await fetchMeldPhotos(n.id));
      }

      status.textContent=`${shown.length} melding${shown.length===1?'':'en'}`;
      const title=document.getElementById('meldListTitle');
      if(title)title.textContent=tab==='handled'?'Afgehandelde meldingen':'Open meldingen';

      if(!shown.length){
        list.innerHTML=`<div class="meld-empty">${tab==='handled'?'Nog geen afgehandelde meldingen.':'Geen open meldingen.'}</div>`;
      }

      shown.forEach(n=>{
        const unread=!reads.has(String(n.id));
        const card=document.createElement('article');
        card.className=`meld-item${unread?' unread':''}`;
        card.innerHTML=`
          <div class="meld-item-head">
            <div><strong>${esc(n.subject)}</strong>${unread?'<span class="meld-new">Nieuw</span>':''}</div>
            <div class="meld-item-actions">
              <small>${esc(n.notice_date)} · ${esc(String(n.notice_time).slice(0,5))} · ${esc(n.name)}</small>
              <button type="button" class="meld-edit-btn" data-edit-notice>✎ Bewerken</button>
            </div>
          </div>
          <p class="meld-message">${esc(n.message)}</p>
          ${meldPhotosHtml(photosById.get(String(n.id)))}

          <label class="meld-handled-check">
            <input type="checkbox" data-handled ${n.handled?'checked':''}>
            <span>Afgehandeld</span>
          </label>

          <section class="meld-reactions">
            <h4>Reacties</h4>
            <div class="meld-reaction-list">${reactionsHtml(reactions.get(String(n.id)))}</div>
            <div class="meld-reaction-add">
              <input type="text" data-reaction-input placeholder="Schrijf een reactie...">
              <button type="button" class="secondary" data-reaction-send>Reageren</button>
            </div>
          </section>`;

        card.querySelector('[data-edit-notice]').addEventListener('click',()=>editNotice(n));
        card.querySelector('[data-handled]').addEventListener('change',e=>setHandled(n.id,e.target.checked));
        card.querySelector('[data-reaction-send]').addEventListener('click',()=>addReaction(n.id,card));
        card.querySelector('[data-reaction-input]').addEventListener('keydown',e=>{
          if(e.key==='Enter'){
            e.preventDefault();
            addReaction(n.id,card);
          }
        });

        card.querySelectorAll('.meld-photo-thumb').forEach((btn,i)=>{
          const urls=photosById.get(String(n.id))||[];
          btn.addEventListener('click',()=>openMeldPhoto(urls[i]));
        });

        list.appendChild(card);
      });

      if(markVisibleRead){
        const unread=shown.filter(n=>!reads.has(String(n.id))).map(n=>n.id);
        if(unread.length)await markRead(unread);
      }
      await refreshState();
    }catch(err){
      status.textContent=`Meldingen niet beschikbaar: ${err?.message||err}`;
    }
  }

  function syncTabs(){
    document.querySelectorAll('[data-meld-tab]').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.meldTab===tab);
    });
  }


  function isStandaloneApp(){
    return window.matchMedia?.('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function updateBadgePermissionButton(){
    const btn=document.getElementById('meldBadgePermission');
    if(!btn)return;

    const supportsBadge=('setAppBadge' in navigator);
    const supportsNotifications=('Notification' in window);
    const smartphone=window.matchMedia?.('(max-width: 899px)').matches;

    // Alleen tonen waar het relevant is: smartphone/PWA + Badging API.
    if(!supportsBadge || !supportsNotifications || !smartphone){
      btn.hidden=true;
      return;
    }

    if(Notification.permission==='granted'){
      btn.hidden=true;
      return;
    }

    btn.hidden=false;
    btn.textContent=Notification.permission==='denied'
      ? 'Badge-toestemming geblokkeerd'
      : '● App-badge activeren';
    btn.disabled=Notification.permission==='denied';
    btn.title=Notification.permission==='denied'
      ? 'Sta meldingen/badges toe via de instellingen van je telefoon.'
      : 'Eenmalig toestemming geven zodat het rode cijfer op het app-icoon zichtbaar kan worden.';
  }

  async function requestBadgePermission(){
    const btn=document.getElementById('meldBadgePermission');
    if(!('Notification' in window)){
      alert('Deze telefoon/browser ondersteunt app-badges niet.');
      return;
    }

    try{
      const permission=await Notification.requestPermission();
      updateBadgePermissionButton();

      if(permission==='granted'){
        await refreshState();
        alert('App-badge is geactiveerd. Het aantal open meldingen kan nu als rood cijfer op het Vappie-icoon worden getoond.');
      }else if(permission==='denied'){
        alert('Toestemming is geweigerd. Je kunt badges later inschakelen via Instellingen > Meldingen > Vappie.');
      }
    }catch(err){
      console.warn('Badge-toestemming:',err);
      if(btn)btn.hidden=false;
    }
  }

  function bindPage(){
    const form=document.getElementById('meldForm');
    if(!form)return;

    document.getElementById('meldNew').onclick=()=>{
      resetMeldForm();
      form.hidden=false;
      document.getElementById('meldName')?.focus();
    };
    document.getElementById('meldClose').onclick=()=>{form.hidden=true;resetMeldForm();};
    document.getElementById('meldCancel').onclick=()=>{form.hidden=true;resetMeldForm();};
    document.getElementById('meldSave').onclick=saveNotice;
    document.getElementById('meldRefresh').onclick=()=>loadList(false);
    document.getElementById('meldBadgePermission')?.addEventListener('click',requestBadgePermission);
    updateBadgePermissionButton();
    document.getElementById('meldPhotos')?.addEventListener('change',renderMeldPhotoPreview);

    document.querySelectorAll('[data-meld-tab]').forEach(btn=>{
      btn.onclick=()=>{
        tab=btn.dataset.meldTab;
        syncTabs();
        loadList(true);
      };
    });

    syncTabs();
    loadList(true);
  }

  function ensureHome(){
    if(active)return null;

    const main=document.querySelector('.workspace-main');
    const search=main?.querySelector('.search-hero');
    const home=!!document.querySelector('.sidebar-nav [data-page="home"].active');
    if(!main||!search||!home)return null;

    let block=main.querySelector('.meld-home');
    if(!block){
      block=document.createElement('section');
      block.className='meld-home';
      search.insertAdjacentElement('afterend',block);
    }
    return block;
  }

  async function renderLatest(){
    const block=ensureHome();
    if(!block)return;

    try{
      const notices=await fetchNotices();
      const n=notices.find(x=>!x.handled);

      if(!n){
        block.remove();
        return;
      }

      const photos=await fetchMeldPhotos(n.id);
      const homePhotos=photos.length
        ? `<div class="meld-home-photos">${photos.map(u=>`<img src="${u}" alt="Foto bij melding">`).join('')}</div>`
        : '';

      block.innerHTML=`<button type="button" class="meld-home-card"><span>!</span><div><small>LAATSTE OPEN MELDING</small><strong>${esc(n.subject)}</strong><em>${esc(n.notice_date)} · ${esc(String(n.notice_time).slice(0,5))} · ${esc(n.name)}</em><p>${esc(n.message)}</p>${homePhotos}</div><b>Bekijk →</b></button>`;

      const homeButton=block.querySelector('button');
      if(homeButton){
        homeButton.addEventListener('pointerdown',e=>{
          e.preventDefault();
          e.stopPropagation();
          window.VappieOpenMeldingen();
        });
        homeButton.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          window.VappieOpenMeldingen();
        });
      }
    }catch{}
  }

  async function refreshState(){
    ensureNav();
    ensureHome();

    try{
      const notices=await fetchNotices();
      const openCount=notices.filter(n=>!n.handled).length;

      // Menu-badge toont het aantal meldingen dat nog OPEN staat.
      const badge=ensureNav()?.querySelector('.meldingen-badge');
      if(badge){
        badge.hidden=openCount===0;
        badge.textContent=String(openCount);
        badge.setAttribute('aria-label',`${openCount} open melding${openCount===1?'':'en'}`);
        badge.title=`${openCount} open melding${openCount===1?'':'en'}`;
      }

      // PWA/app-badge: op iPhone/iPad verschijnt deze pas nadat de gebruiker
      // meldingen/badges heeft toegestaan voor de Home Screen web app.
      try{
        const permissionOk=!('Notification' in window) || Notification.permission==='granted';
        if(permissionOk){
          if(openCount>0&&navigator.setAppBadge)await navigator.setAppBadge(openCount);
          else if(openCount===0&&navigator.clearAppBadge)await navigator.clearAppBadge();
        }
      }catch(err){
        console.warn('App-badge bijwerken:',err);
      }

      updateBadgePermissionButton();
      if(!active)await renderLatest();
    }catch(err){
      console.warn('Meldingenstatus:',err);
    }
  }

  // Globale route: zowel menu, Homeblok als fallback gebruiken exact deze functie.
  window.VappieOpenMeldingen=function(){
    openPage().catch(err=>console.error('Meldingen openen mislukt:',err));
    return false;
  };

  // v36: harde route op POINTERDOWN in capture-fase.
  // Deze draait vóór onclick/click-handlers van app.js en enhancements.js.
  const interceptMeldingen=(e)=>{
    const meld=e.target.closest?.('[data-meldingen-page]');
    if(!meld)return false;
    e.preventDefault();
    e.stopPropagation();
    window.VappieOpenMeldingen();
    return true;
  };

  document.addEventListener('pointerdown',e=>{
    interceptMeldingen(e);
  },true);

  document.addEventListener('click',e=>{
    if(interceptMeldingen(e))return;

    if(e.target.closest?.('.sidebar-nav [data-page], [data-v25-page="photoalbum"], .sidebar-brand[data-page="home"]')){
      active=false;
      delete document.body.dataset.meldingenActive;
    }
  },true);

  const observer=new MutationObserver(()=>{
    ensureNav();

    if(active){
      const main=document.querySelector('.workspace-main');
      if(main&&!main.querySelector('.meldingen-page')&&!restoring){
        restoring=true;
        openPage().finally(()=>restoring=false);
      }
    }else{
      ensureHome();
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  setTimeout(()=>{
    ensureNav();
    ensureHome();
    refreshState();
  },350);


  // Bij terugkeer naar Vappie direct het badgecijfer synchroniseren.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshState();
  });
  window.addEventListener('pageshow',()=>refreshState());

  setInterval(refreshState,60000);
})();