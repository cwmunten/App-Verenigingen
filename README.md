# Vappie

Vappie is een statische webapp voor Team Verenigingen van het Zomerparkfeest.

## Belangrijk
Deze versie gebruikt **geen Next.js, React of npm-build**. De app bestaat alleen uit HTML, CSS en JavaScript en kan rechtstreeks op Vercel worden gepubliceerd.

## Bestanden
- `index.html` – startpagina
- `styles.css` – vormgeving
- `seedData.js` – startgegevens 2026
- `app.js` – alle functionaliteit
- `vercel.json` – Vercel routing

## Deployen op Vercel
1. Upload deze bestanden naar de **root** van je GitHub repository.
2. Importeer de repository in Vercel.
3. Zet bij **Framework Preset**: `Other`.
4. Laat **Build Command** leeg.
5. Laat **Output Directory** leeg.
6. Deploy.

Als je bestaande Vercel-project nog op Next.js staat: ga naar **Settings → Build and Deployment → Framework Preset** en kies `Other`, of maak een nieuw Vercel-project van dezelfde GitHub-repository.

## Opslag
Wijzigingen worden lokaal opgeslagen in `localStorage` van de browser. Gebruik **Data & back-up** in Vappie om een JSON-back-up te downloaden en later te importeren.


## Excel import en rapport-export
- In **Administratie** staan nu de knoppen **Excel importeren** en **Rapport exporteren**.
- De Excel-import leest `Verenigingen & Administratie` en `Werkschema` uit het ZPF-werkboek en kan administratie en/of planning vervangen voor het actieve festivaljaar.
- Het rapport toont de diensten per dag in aparte kolommen (woensdag t/m zondag) en kan als PDF/print of CSV voor Excel worden geëxporteerd.
- Voor Excel-import gebruikt Vappie SheetJS 0.20.3 via de officiële SheetJS CDN.

## Aanpassingen in deze versie
- Automatisch verversen iedere 2 minuten. Open bewerkvensters worden niet onderbroken.
- Planning kan nu ook op vereniging worden gefilterd.
- Zoekresultaten op Home tonen alle administratiegegevens, alle diensten en een financieel overzicht per vereniging.

## Nieuw: verenigingskaart vanuit Planning
Klik in Planning op de naam van een vereniging. Vappie opent dan direct het complete overzicht met administratie, contactgegevens, diensten en financiën. Vanuit die kaart kan ook direct naar Administratie wijzigen worden gegaan.

## Nieuw: Vappie als app installeren (PWA)
Vappie bevat nu een web app manifest, service worker en eigen Z-appiconen.

- Android / Chrome: gebruik **Installeer Vappie** in het menu (of de installatie-optie van Chrome).
- iPhone / iPad: open Vappie in Safari, kies **Delen** en daarna **Zet op beginscherm**.
- De app opent daarna standalone met het gele Z-logo.
- De lokale Vappie-cache blijft beschikbaar; Supabase-auth/databaseverkeer wordt bewust niet door de service worker gecachet.
