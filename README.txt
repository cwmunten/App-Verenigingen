VAPPIE SYNC FIX v5
==================

Deze ZIP bevat alleen de 2 bestanden die je in de root van je GitHub repository hoeft te vervangen:

1. index.html
2. service-worker.js

Wat is aangepast:
- Supabase is bij een nieuwe start de bron van waarheid.
- Een oude lokale 'dirty' sync-vlag wordt bij de start verwijderd, zodat de iPhone niet eerst verouderde lokale data naar Supabase terugschrijft.
- Na >30 seconden op de achtergrond herlaadt de PWA bij terugkomst, zodat actuele Supabase-data opnieuw wordt opgehaald.
- app.js, styles.css, seedData.js en manifest.webmanifest gebruiken network-first caching.
- Nieuwe cacheversie v5 verwijdert de oude PWA-cache.
- Service worker controleert bij iedere start expliciet op een update.

UPLOAD NAAR GITHUB
------------------
Open de repository App-Verenigingen, upload deze twee bestanden naar de ROOT en kies voor Replace/Commit changes.
Vercel zal daarna automatisch opnieuw deployen als je repository eraan gekoppeld is.

IPHONE EERSTE KEER NA UPDATE
----------------------------
1. Open Vappie eerst één keer in Safari.
2. Wacht een paar seconden tot de nieuwe service worker actief is.
3. Sluit de Vappie-app volledig en open hem opnieuw vanaf het beginscherm.
4. Controleer dezelfde vereniging als op de laptop.

Als iOS toch nog de oude PWA vasthoudt, verwijder Vappie één keer van het beginscherm en voeg hem daarna opnieuw toe.
