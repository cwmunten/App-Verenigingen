# Vappie + Supabase (project vooraf ingesteld)

Deze versie is vooraf gekoppeld aan Supabase-project:
`https://ngijjzcizhwoeieaelgz.supabase.co`

De Publishable key staat in de browsercode. Dat is toegestaan voor een Supabase Publishable key; toegang tot data wordt beveiligd met Supabase Auth + Row Level Security (RLS). Gebruik NOOIT een secret/service_role key in browsercode.

## Veiligheidsprincipe
Vappie blijft altijd eerst lokaal opslaan in dezelfde localStorage key: `vappie-data-v2`.
Als Supabase niet bereikbaar is, blijft de app lokaal bruikbaar. Synchronisatie wordt pas actief nadat je bent ingelogd én bewust een eerste synchronisatierichting kiest.

## Eenmalig in Supabase
1. Open Supabase > SQL Editor.
2. Voer `supabase_setup.sql` volledig uit.
3. Ga naar Authentication > Users.
4. Maak minimaal één gebruiker aan met e-mailadres + wachtwoord.

## Eerste koppeling in Vappie
1. Open Vappie.
2. Klik rechtsboven op Data/back-up.
3. Meld je aan met de Supabase-gebruiker.
4. Vappie test direct of `vappie_state` en RLS bereikbaar zijn.
5. Kies op je bestaande, gevulde Vappie: **Lokale Vappie → Supabase**.
6. Open daarna eventueel een tweede browser/apparaat, log in en kies **Supabase → deze Vappie**.

## Synchronisatie
- Iedere wijziging wordt direct lokaal opgeslagen.
- Als Supabase gekoppeld is, wordt de wijziging kort daarna naar Supabase gestuurd.
- Iedere 2 minuten haalt Vappie centrale gegevens opnieuw op.
- Bij een storing blijft lokale data staan.
- Gebruik voor belangrijke wijzigingen ook de ingebouwde JSON-back-up.
