(() => {
  'use strict';

  const TABLE='vappie_meldingen';
  const READ_TABLE='vappie_melding_reads';
  const REACTION_TABLE='vappie_melding_reacties';
  const SB_URL='https://ngijjzcizhwoeieaelgz.supabase.co';
  const SB_KEY='sb_publishable_fQFpxmC6XeNeJ0yOv52S7g_VIbs2jLg';

  let client=null;
  let active=false;
  let restoring=false;
  let tab='open';

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

    const photo=nav.querySelector('[data-v25-page="photoalbum"]');
    if(photo){
      if(photo.previousElementSibling!==btn)photo.insertAdjacentElement('beforebegin',btn);
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
        <button type="button" class="primary" id="meldNew">＋ Nieuwe melding</button>
      </div>

      <section class="meldingen-form" id="meldForm" hidden>
        <div class="meld-form-head"><h3>Nieuwe melding</h3><button type="button" id="meldClose">×</button></div>
        <div class="meld-grid">
          <label><span>Naam</span><input id="meldName" placeholder="Naam melder"></label>
          <label><span>Datum</span><input id="meldDate" type="date" value="${now.toISOString().slice(0,10)}"></label>
          <label><span>Tijd</span><input id="meldTime" type="time" value="${now.toTimeString().slice(0,5)}"></label>
          <label><span>Betreft</span><input id="meldSubject" placeholder="Waar gaat de melding over?"></label>
          <label class="full"><span>Melding</span><textarea id="meldMessage" rows="5" placeholder="Omschrijf de calamiteit zo duidelijk mogelijk..."></textarea></label>
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

  async function saveNotice(){
    const row={
      name:document.getElementById('meldName')?.value.trim(),
      notice_date:document.getElementById('meldDate')?.value,
      notice_time:document.getElementById('meldTime')?.value,
      subject:document.getElementById('meldSubject')?.value.trim(),
      message:document.getElementById('meldMessage')?.value.trim(),
      handled:false
    };

    if(!row.name||!row.notice_date||!row.notice_time||!row.subject||!row.message){
      alert('Vul alle velden volledig in.');
      return;
    }

    const btn=document.getElementById('meldSave');
    if(btn){btn.disabled=true;btn.textContent='Opslaan…';}

    try{
      const {c,session:s}=await session();
      row.created_by=s.user.id;
      const {data,error}=await c.from(TABLE).insert(row).select().single();
      if(error)throw error;
      await markRead([data.id]);

      document.getElementById('meldForm').hidden=true;
      tab='open';
      syncTabs();
      await loadList(true);
      await refreshState();
    }catch(err){
      alert(`Melding opslaan mislukt: ${err?.message||err}`);
    }finally{
      if(btn){btn.disabled=false;btn.textContent='✓ Melding opslaan';}
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
            <small>${esc(n.notice_date)} · ${esc(String(n.notice_time).slice(0,5))} · ${esc(n.name)}</small>
          </div>
          <p class="meld-message">${esc(n.message)}</p>

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

        card.querySelector('[data-handled]').addEventListener('change',e=>setHandled(n.id,e.target.checked));
        card.querySelector('[data-reaction-send]').addEventListener('click',()=>addReaction(n.id,card));
        card.querySelector('[data-reaction-input]').addEventListener('keydown',e=>{
          if(e.key==='Enter'){
            e.preventDefault();
            addReaction(n.id,card);
          }
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

  function bindPage(){
    const form=document.getElementById('meldForm');
    if(!form)return;

    document.getElementById('meldNew').onclick=()=>{
      form.hidden=false;
      document.getElementById('meldName')?.focus();
    };
    document.getElementById('meldClose').onclick=()=>form.hidden=true;
    document.getElementById('meldCancel').onclick=()=>form.hidden=true;
    document.getElementById('meldSave').onclick=saveNotice;
    document.getElementById('meldRefresh').onclick=()=>loadList(false);

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

      // Home toont uitsluitend de laatste OPEN melding.
      // Zodra alles is afgehandeld verdwijnt het blok volledig.
      if(!n){
        block.remove();
        return;
      }

      block.innerHTML=`<button type="button" class="meld-home-card"><span>!</span><div><small>LAATSTE OPEN MELDING</small><strong>${esc(n.subject)}</strong><em>${esc(n.notice_date)} · ${esc(String(n.notice_time).slice(0,5))} · ${esc(n.name)}</em><p>${esc(n.message)}</p></div><b>Bekijk →</b></button>`;

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
      const reads=await readIds();
      const unread=notices.filter(n=>!reads.has(String(n.id))).length;

      const badge=ensureNav()?.querySelector('.meldingen-badge');
      if(badge){
        badge.hidden=unread===0;
        badge.textContent=String(unread);
      }

      try{
        if(unread>0&&navigator.setAppBadge)await navigator.setAppBadge(unread);
        else if(unread===0&&navigator.clearAppBadge)await navigator.clearAppBadge();
      }catch{}

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

  setInterval(refreshState,60000);
})();