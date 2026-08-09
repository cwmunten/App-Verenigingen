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

v31 Meldingen:
- Nieuw menu-item Meldingen boven Fotoalbum.
- Velden: Naam, Datum, Tijd, Betreft, Melding.
- Laatste melding op Home direct onder zoekfunctie.
- Ongelezen teller in menu + PWA app badge waar ondersteund.
- Openen van Meldingen markeert ongelezen meldingen als gelezen.
- SUPABASE_MELDINGEN_SETUP.sql éénmalig uitvoeren.
