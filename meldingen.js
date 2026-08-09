(() => {
  'use strict';
  const TABLE='vappie_meldingen';
  const READ_TABLE='vappie_melding_reads';
  const SB_URL='https://ngijjzcizhwoeieaelgz.supabase.co';
  const SB_KEY='sb_publishable_fQFpxmC6XeNeJ0yOv52S7g_VIbs2jLg';
  let client=null, active=false, restoring=false;
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  async function getClient(){
    if(client)return client;
    if(!window.supabase?.createClient)throw new Error('Supabase is nog niet geladen.');
    client=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return client;
  }
  async function getSession(){
    const c=await getClient();
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw new Error('Je bent niet aangemeld bij Supabase.');
    return {c,session};
  }

  function ensureNav(){
    const nav=document.querySelector('.sidebar-nav');
    if(!nav)return;
    let btn=nav.querySelector('[data-meldingen-page]');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.setAttribute('data-meldingen-page','1');
      btn.innerHTML='<b>!</b><span>Meldingen</span><em class="meldingen-badge" hidden>0</em>';
    }
    const photo=nav.querySelector('[data-v25-page="photoalbum"]');
    if(photo) photo.insertAdjacentElement('beforebegin',btn);
    else nav.appendChild(btn);
  }

  function formHtml(){
    const now=new Date();
    return `<section class="meldingen-page">
      <div class="meldingen-head"><div><span class="eyebrow">TEAM VERENIGINGEN</span><h1>Meldingen</h1><p>Leg calamiteiten en bijzonderheden direct vast.</p></div><button type="button" class="primary" id="meldNew">＋ Nieuwe melding</button></div>
      <section class="meldingen-form" id="meldForm" hidden>
        <div class="meld-form-head"><h3>Nieuwe melding</h3><button type="button" id="meldClose">×</button></div>
        <div class="meld-grid">
          <label><span>Naam</span><input id="meldName" placeholder="Naam melder"></label>
          <label><span>Datum</span><input id="meldDate" type="date" value="${now.toISOString().slice(0,10)}"></label>
          <label><span>Tijd</span><input id="meldTime" type="time" value="${now.toTimeString().slice(0,5)}"></label>
          <label><span>Betreft</span><input id="meldSubject" placeholder="Waar gaat de melding over?"></label>
          <label class="full"><span>Melding</span><textarea id="meldMessage" rows="6" placeholder="Omschrijf de calamiteit zo duidelijk mogelijk..."></textarea></label>
        </div>
        <div class="meld-actions"><button type="button" class="secondary" id="meldCancel">Annuleren</button><button type="button" class="primary" id="meldSave">✓ Melding opslaan</button></div>
      </section>
      <div class="meld-list-head"><div><span>MELDINGENLOGBOEK</span><h3>Alle meldingen</h3></div><button type="button" class="secondary" id="meldRefresh">↻ Vernieuwen</button></div>
      <div id="meldStatus" class="meld-status">Meldingen laden…</div><div id="meldList" class="meld-list"></div>
    </section>`;
  }

  async function openPage(){
    active=true;
    document.body.dataset.meldingenActive='1';
    const main=document.querySelector('.workspace-main');
    if(!main)return;
    document.querySelectorAll('.sidebar-nav button').forEach(b=>b.classList.remove('active'));
    ensureNav();
    document.querySelector('[data-meldingen-page]')?.classList.add('active');
    document.getElementById('nav')?.classList.remove('open');
    main.className='workspace-main main';
    main.innerHTML=formHtml();
    bindPage();
    await loadList(true);
  }

  function bindPage(){
    const form=document.getElementById('meldForm');
    document.getElementById('meldNew').onclick=()=>{form.hidden=false;document.getElementById('meldName')?.focus()};
    document.getElementById('meldClose').onclick=()=>form.hidden=true;
    document.getElementById('meldCancel').onclick=()=>form.hidden=true;
    document.getElementById('meldSave').onclick=saveNotice;
    document.getElementById('meldRefresh').onclick=()=>loadList(false);
  }

  async function fetchNotices(limit=100){
    const {c}=await getSession();
    const {data,error}=await c.from(TABLE).select('*').order('created_at',{ascending:false}).limit(limit);
    if(error)throw error;
    return data||[];
  }
  async function readIds(){
    const {c,session}=await getSession();
    const {data,error}=await c.from(READ_TABLE).select('melding_id').eq('user_id',session.user.id);
    if(error)throw error;
    return new Set((data||[]).map(x=>String(x.melding_id)));
  }
  async function markRead(ids){
    if(!ids.length)return;
    const {c,session}=await getSession();
    const rows=[...new Set(ids.map(String))].map(id=>({user_id:session.user.id,melding_id:id,read_at:new Date().toISOString()}));
    const {error}=await c.from(READ_TABLE).upsert(rows,{onConflict:'user_id,melding_id'});
    if(error)throw error;
  }

  async function saveNotice(){
    const row={
      name:document.getElementById('meldName').value.trim(),
      notice_date:document.getElementById('meldDate').value,
      notice_time:document.getElementById('meldTime').value,
      subject:document.getElementById('meldSubject').value.trim(),
      message:document.getElementById('meldMessage').value.trim()
    };
    if(Object.values(row).some(v=>!v))return alert('Vul alle velden volledig in.');
    try{
      const {c,session}=await getSession();
      row.created_by=session.user.id;
      const {data,error}=await c.from(TABLE).insert(row).select().single();
      if(error)throw error;
      await markRead([data.id]);
      document.getElementById('meldForm').hidden=true;
      await loadList(false);
      await refreshState();
    }catch(err){alert(`Melding opslaan mislukt: ${err?.message||err}`)}
  }

  async function loadList(markAllRead){
    const status=document.getElementById('meldStatus'), list=document.getElementById('meldList');
    if(!status||!list)return;
    try{
      const notices=await fetchNotices(), reads=await readIds();
      status.textContent=`${notices.length} melding${notices.length===1?'':'en'}`;
      list.innerHTML='';
      for(const n of notices){
        const unread=!reads.has(String(n.id));
        const el=document.createElement('article');
        el.className=`meld-item${unread?' unread':''}`;
        el.innerHTML=`<div class="meld-item-head"><div><strong>${esc(n.subject)}</strong>${unread?'<span class="meld-new">Nieuw</span>':''}</div><small>${esc(n.notice_date)} · ${esc(String(n.notice_time).slice(0,5))} · ${esc(n.name)}</small></div><p>${esc(n.message)}</p>`;
        list.appendChild(el);
      }
      if(markAllRead){
        const ids=notices.filter(n=>!reads.has(String(n.id))).map(n=>n.id);
        if(ids.length)await markRead(ids);
        await refreshState();
      }
    }catch(err){status.textContent=`Meldingen niet beschikbaar: ${err?.message||err}`}
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
      block.innerHTML='<button type="button" class="meld-home-card empty"><span>!</span><div><small>MELDINGEN</small><strong>Nog geen meldingen</strong><em>Nieuwe calamiteitenmeldingen verschijnen hier.</em></div><b>Open →</b></button>';
      search.insertAdjacentElement('afterend',block);
      block.querySelector('button').onclick=openPage;
    }
    return block;
  }

  async function renderLatest(notices){
    const block=ensureHome();
    if(!block)return;
    const n=(notices||await fetchNotices(1))[0];
    if(!n){
      block.innerHTML='<button type="button" class="meld-home-card empty"><span>!</span><div><small>MELDINGEN</small><strong>Nog geen meldingen</strong><em>Nieuwe calamiteitenmeldingen verschijnen hier.</em></div><b>Open →</b></button>';
    }else{
      block.innerHTML=`<button type="button" class="meld-home-card"><span>!</span><div><small>LAATSTE MELDING</small><strong>${esc(n.subject)}</strong><em>${esc(n.notice_date)} · ${esc(String(n.notice_time).slice(0,5))} · ${esc(n.name)}</em><p>${esc(n.message)}</p></div><b>Bekijk →</b></button>`;
    }
    block.querySelector('button').onclick=openPage;
  }

  async function applyBadge(count){
    const n=Math.max(0,Number(count)||0), badge=document.querySelector('.meldingen-badge');
    if(badge){badge.hidden=n===0;badge.textContent=String(n)}
    try{
      if(n>0&&navigator.setAppBadge)await navigator.setAppBadge(n);
      else if(n===0&&navigator.clearAppBadge)await navigator.clearAppBadge();
    }catch{}
  }

  async function refreshState(){
    try{
      ensureNav();
      const notices=await fetchNotices(), reads=await readIds();
      await applyBadge(notices.filter(n=>!reads.has(String(n.id))).length);
      if(!active)await renderLatest(notices.slice(0,1));
    }catch(err){
      ensureHome();
      console.warn('Meldingenstatus:',err);
    }
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-meldingen-page]')){
      e.preventDefault();
      e.stopImmediatePropagation();
      openPage();
      return;
    }
    if(e.target.closest?.('.sidebar-nav [data-page], [data-v25-page="photoalbum"], .sidebar-brand[data-page="home"]')){
      active=false;
      delete document.body.dataset.meldingenActive;
    }
  },true);

  const obs=new MutationObserver(()=>{
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
  obs.observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('load',()=>{ensureNav();ensureHome();setTimeout(refreshState,800)});
  setTimeout(()=>{ensureNav();ensureHome();refreshState()},500);
  setInterval(refreshState,60000);
})();