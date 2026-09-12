/* Vappie v40.16 - herstel ontbrekende statusrenderer voor Data/back-up */
window.supabaseStatusHtml = function supabaseStatusHtml(){
  let configured = false;
  let linked = false;
  let dirty = false;
  try {
    configured = !!localStorage.getItem('vappie-supabase-config-v1') || true;
    linked = localStorage.getItem('vappie-supabase-linked-v1') === '1';
    dirty = localStorage.getItem('vappie-supabase-dirty-v1') === '1';
  } catch (_) {}

  let title = 'Supabase: geconfigureerd';
  let text = 'Lokale opslag blijft altijd actief.';
  let cls = 'neutral';

  if (linked && dirty) {
    title = 'Supabase: synchroniseren…';
    text = 'Er staan lokale wijzigingen klaar voor synchronisatie.';
    cls = 'busy';
  } else if (linked) {
    title = 'Supabase: gekoppeld';
    text = 'Centrale synchronisatie is actief. Lokale opslag blijft de veiligheidsbasis.';
    cls = 'ok';
  } else if (configured) {
    title = 'Supabase: geconfigureerd';
    text = 'Meld je aan of kies de eerste synchronisatie om de centrale koppeling te activeren.';
  }

  return `<div class="supabase-status-card ${cls}"><span class="status-dot"></span><div><strong>${title}</strong><p>${text}</p></div></div>`;
};
