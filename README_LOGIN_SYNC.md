# Vappie – login en directe Supabase synchronisatie

Deze versie bouwt voort op de werkende Supabase-versie en behoudt `vappie-data-v2` in localStorage als lokale veiligheidsbuffer.

## Nieuw
- Startscherm met Supabase e-mail/wachtwoord wanneer nog geen sessie aanwezig is.
- Supabase `persistSession: true` en `autoRefreshToken: true`: op hetzelfde apparaat/browser opent Vappie na een eerdere login normaal direct.
- Eén login is tegelijk de login voor Vappie én Supabase.
- Bestaande gekoppelde status blijft op het apparaat behouden bij uitloggen; na opnieuw aanmelden kan de sync meteen hervatten.
- Wijzigingen worden eerst lokaal opgeslagen en vervolgens na een korte debounce (~450 ms) naar Supabase gestuurd.
- Headerstatus: Gesynchroniseerd / Synchroniseren… / Offline · lokaal.
- Centrale gegevens worden daarnaast elke 2 minuten opnieuw opgehaald.
- Bij een niet bereikbare Supabase kan de gebruiker expliciet 'Offline lokaal openen' kiezen.

## Bestaande werking behouden
- localStorage sleutel blijft `vappie-data-v2`.
- Excel-import, rapport-export, planning, financieel, bezetting en administratie blijven aanwezig.
- De bestaande Supabase tabel `vappie_state` en RLS-setup veranderen niet.
