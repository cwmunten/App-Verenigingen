VAPPIE DASHBOARD UPDATE v18
===========================

Deze ZIP is een updatepakket voor de bestaande repository:
cwmunten/App-Verenigingen

WAT IS NIEUW
------------
1. Laptop-dashboard:
   - prominente bestaande zoekfunctie blijft bovenaan;
   - 4 KPI's: verenigingen, diensten, ingeplande personen en totale vergoeding;
   - blok "Aandacht nodig";
   - compact festival/planning-overzicht;
   - lokaal logboek "Recente wijzigingen";
   - snelle acties.

2. Administratie op laptop:
   - permanente horizontale scrollbar onderin het scherm;
   - scrollbar loopt synchroon met de brede administratietabel;
   - blijft bereikbaar tijdens verticaal scrollen.

3. Smartphone:
   - extra dashboardblokken worden bewust niet getoond;
   - mobiele zoekervaring blijft eenvoudig.

4. Sync:
   - sync-fix blijft behouden;
   - Supabase-verkeer wordt niet gecachet;
   - app-code gebruikt network-first caching.

INSTALLEREN IN GITHUB
---------------------
Upload/vervang in de hoofdmap van App-Verenigingen:
- index.html                    (vervangen)
- service-worker.js            (vervangen)
- enhancements.js              (nieuw)
- enhancements.css             (nieuw)

Laat de bestaande bestanden staan:
- app.js
- styles.css
- seedData.js
- manifest.webmanifest
- icons/

Na commit zal Vercel normaal automatisch opnieuw deployen.

IPHONE/PWA
----------
Door de nieuwe cacheversie v6 zou de update automatisch moeten doorkomen.
Als de oude versie toch blijft staan:
1. open de site eenmaal rechtstreeks in Safari;
2. ververs de pagina;
3. sluit de beginscherm-app volledig en open opnieuw.

OPMERKING RECENTE WIJZIGINGEN
-----------------------------
Het logboek wordt lokaal per apparaat opgebouwd vanaf deze update.
Het is dus geen centraal Supabase-auditlog en pretendeert dat ook niet.

5. Klikbare controlepunten:
   - ieder punt onder 'Aandacht nodig' is nu klikbaar;
   - klik opent direct Administratie;
   - Vappie filtert meteen op de betreffende vereniging;
   - waar mogelijk wordt direct het bestaande bewerkscherm (potlood) geopend;
   - zo kun je telefoon, e-mail, barchef of certificaten meteen aanvullen.

6. Dashboard opgeschoond: het blok 'Festival / Planning in één oogopslag' is verwijderd. 'Aandacht nodig' gebruikt nu de volle breedte.

7. Home altijd vers: klik op Home herlaadt de app zodat de normale Supabase startsync opnieuw draait.
8. Dienst toevoegen: eerst keuze bestaande of nieuwe vereniging. Bij nieuw eerst Administratie; na opslaan automatisch naar Planning met de nieuwe vereniging geselecteerd.


9. Mail alle verenigingen
   - In Administratie staat een nieuwe knop: 'Mail alle verenigingen'.
   - Aan: verenigingen@zomerparkfeest.nl
   - Alle geldige, unieke e-mailadressen uit Administratie worden in BCC gezet.
   - Lege en dubbele adressen worden automatisch overgeslagen.
   - De afzender wordt door het standaard mailprogramma bepaald. Zorg dat
     verenigingen@zomerparkfeest.nl daar als verzendaccount/afzender beschikbaar is.

10. Layout v11: desktop uitgebreider en rustiger; Administratie compactere hiërarchie, Meer-menu, sticky tabelkop en subtielere spacing. Smartphone behoudt grote functionele knoppen en compacte inhoud.

11. Administratie acties v12:
    - Laptop: alleen '+ Vereniging toevoegen' en 'Meer ▾' zichtbaar.
    - Meer bevat: Mail alle verenigingen, Excel importeren, Rapport exporteren.
    - Smartphone: mail, import, export en Meer zijn volledig verborgen.
    - Smartphone toont alleen de functionele knop '+ Vereniging toevoegen'.

12. Meer-menu v13: alle opties links en gelijk uitgelijnd, consistente rijhoogte en spacing; aantalbadge achter 'Mail alle verenigingen' verwijderd.

13. Meer-menu v14: teller volledig verwijderd uit de bronknop én dropdown; vaste icoonkolom en tekstkolom voor exacte uitlijning van Mail, Import en Export.

14. Administratie v15: tekst met aantal verenigingen en festivaljaar onder de paginatitel verwijderd op laptop en smartphone.

15. Menuvolgorde v16: Home, Planning, Administratie, Financieel, Bezettingsoverzicht.

16. Navigatiefix v17:
    - menuvolgorde blijft Home, Planning, Administratie, Financieel, Bezettingsoverzicht;
    - herschikken gebeurt alleen nog wanneer de volgorde daadwerkelijk fout staat;
    - voorkomt een MutationObserver-lus die klikken op menu-items kon blokkeren;
    - originele navigatiehandlers uit app.js blijven leidend.

17. Dagdeelkleuren v18: Avond geel, Middag lichtgroen. Geldt voor de dagdeelbadges in Planning/overzichten.

Fotoalbum v25 toegevoegd.

v26
- Laptop Home toont de twee laatst geüploade foto's.
- Klik op een Home-foto voor grote weergave.
- 'Bekijk album' opent het Fotoalbum.
- Foto's in de galerij hebben een verwijderknop met bevestiging.
- De Supabase SQL bevat nu ook een DELETE-policy.

v27: Lokaal logboek / Recente wijzigingen verwijderd van Home. Overige v26 functies behouden.

v28: Het blok 'Snelle acties' is verwijderd van de Homepagina. Overige functies uit v27 blijven behouden.

v29:
- Oorzaak van knipperende Home-foto's opgelost.
- Dashboard wordt niet meer iedere 5 seconden verwijderd en opnieuw opgebouwd.
- Mutaties binnen het fotoblok starten geen algemene refresh meer.
- Foto's laden één keer per Home-opbouw; upload/verwijderen kan ze nog bewust verversen.

v30:
- Home controleert iedere 90 seconden stil of de twee nieuwste foto's in Supabase veranderd zijn.
- Alleen bij een daadwerkelijk nieuwe/verwijderde foto worden de Home-afbeeldingen vervangen.
- Geen periodiek knipperen of onnodig opnieuw laden.

v33 SAFE Meldingen
- Teruggebouwd vanaf de bekende werkende v30-basis.
- Core bestanden app.js, seedData.js, styles.css en enhancements.js blijven op v30 en zijn inhoudelijk NIET gewijzigd.
- Meldingen is volledig geïsoleerd in meldingen.js en meldingen.css.
- Een fout in Meldingen kan daardoor de basisapp niet meer wit maken.
- Menu-item Meldingen staat boven Fotoalbum.
- Home toont het Meldingenblok direct onder de zoekfunctie.
- SUPABASE_MELDINGEN_SETUP.sql éénmalig uitvoeren.

v34
- Meldingen-knop gebruikt nu een rechtstreekse click-handler op de knop zelf.
- De document-level delegated Meldingen-click is verwijderd om conflicten met andere listeners te voorkomen.
- Extra fallback: window.VappieOpenMeldingen() en #meldingen hash.
- Bestaande v30 kernfunctionaliteit blijft ongewijzigd.

v35
- Meldingenknop heeft nu drie onafhankelijke routes: inline onclick, globale functie en capture fallback.
- Reacties per melding toegevoegd.
- Checkbox Afgehandeld toegevoegd.
- Tabs/mappen Open en Afgehandeld toegevoegd.
- SUPABASE_MELDINGEN_SETUP.sql opnieuw uitvoeren voor nieuwe kolommen/tabel/policies.

v36 HARD FIX
- Meldingen opent nu al op pointerdown in capture-fase, dus vóór andere Vappie click-handlers.
- De knop zelf heeft daarnaast pointerdown én click listeners.
- Home toont alleen de laatste OPEN melding.
- Zodra die melding Afgehandeld wordt en er geen andere open melding is, verdwijnt het Meldingenblok van Home.
- Reacties en tabs Open/Afgehandeld uit v35 blijven behouden.

v37
- Fotoalbum verwijderd uit menu en als pagina.
- Fotoalbum- en Home-foto-code verwijderd uit enhancements.js.
- Bij een melding kunnen maximaal 5 foto's worden toegevoegd.
- Foto's worden verkleind naar max. 1600 px en opgeslagen in private Supabase Storage bucket vappie-melding-fotos.
- Foto's worden bij de melding als miniaturen getoond en klikbaar vergroot.
- Reacties en Open/Afgehandeld blijven behouden.
- SUPABASE_MELDINGEN_SETUP.sql opnieuw uitvoeren voor de nieuwe Storage bucket/policies.

v38
- Menuvolgorde: Home, Planning, Administratie, Financieel, Bezettingsoverzicht, Meldingen.
- Eerdere meldingen kunnen via 'Bewerken' worden aangepast.
- Bij bewerken kunnen extra foto's worden toegevoegd zolang totaal max. 5 blijft.
- Foto's van de laatste OPEN melding worden ook op Home getoond.
- Afgehandelde meldingen verdwijnen van Home.

v39
- Badge bij menu-item Meldingen toont nu het aantal meldingen dat nog OPEN staat.
- Zodra een melding op Afgehandeld wordt gezet, daalt de badge direct.
- Bij 0 open meldingen verdwijnt de badge.
- PWA/app-badge volgt eveneens het aantal open meldingen.

v40
- Smartphone/PWA: eenmalige knop 'App-badge activeren' toegevoegd op pagina Meldingen.
- Op iPhone/iPad vereist Apple toestemming voor Meldingen voordat het rode badgecijfer op het Home Screen-icoon zichtbaar is.
- Na toestemming gebruikt Vappie het aantal OPEN meldingen voor navigator.setAppBadge().
- Bij terugkeer naar de app (pageshow/visibilitychange) wordt het badgecijfer direct opnieuw gesynchroniseerd.
- Bij 0 open meldingen wordt de app-badge verwijderd.
- Let op: zonder Web Push kan het badgecijfer niet worden vernieuwd terwijl Vappie volledig gesloten is; het wordt gesynchroniseerd zodra Vappie weer actief wordt.

v42
- Rol external_reporter via Supabase user_metadata.
- Externe melder ziet alleen eigen Meldingenportal.
- Beheerder kan switchen via Externe weergave / Terug naar beheer.
- Externe portal bevat melding, max 5 foto's, eigen meldingen, status en reacties.
- Extra RLS voor eigen meldingen/reacties en blokkade van vappie_state.
