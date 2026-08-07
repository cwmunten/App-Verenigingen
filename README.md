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
