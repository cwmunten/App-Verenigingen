# Vappie – module Enquêtes

## Eenmalige installatie

1. Open het gekoppelde Supabase-project.
2. Ga naar **SQL Editor**.
3. Open `SUPABASE_ENQUETES_SETUP.sql`, plak de volledige inhoud en voer deze uit.
4. Publiceer daarna alle bestanden van deze projectmap opnieuw op Vercel.
5. Ververs Vappie één keer volledig. In de navigatie verschijnt **Enquêtes**.

## Werkwijze

1. Open **Enquêtes** en kies **Markdown importeren** of **Nieuwe enquête**.
2. Voeg titel, introductie, secties en vragen toe.
3. Zet de status op **Gepubliceerd** wanneer het formulier ingevuld mag worden.
4. Open **Ontvangers**, selecteer de verenigingen en sla de selectie op.
5. Bij één ontvanger opent Vappie direct een persoonlijk e-mailconcept.
6. Bij meerdere ontvangers downloadt Vappie een mailingbestand met unieke links voor Afdruk samenvoegen in Word/Outlook.
7. Onder **Resultaten** zie je wie heeft gereageerd en exporteer je alles naar Excel.

## Markdown importeren

Gebruik `#` voor de titel, `##` voor een sectie en `###` voor een vraag. Zet onder iedere vraag het vraagtype en of de vraag verplicht is. Bij keuzevragen zet je elke antwoordoptie op een eigen regel.

```markdown
# Evaluatie Barchefs 2026

Korte introductietekst voor de ontvanger.

## Planning

### Hoe tevreden ben je over de planning?
Vraagtype: lineaire schaal van 1 tot en met 5
Verplicht: ja

### Wat kunnen we verbeteren?
Vraagtype: lange tekst
Verplicht: nee

### Is jouw vereniging volgend jaar weer aanwezig?
Vraagtype: meerkeuze, één antwoord mogelijk
Verplicht: ja

- Ja, zeker!
- Misschien
- Nee
```

De import wordt altijd als concept opgeslagen. Controleer de vragen en zet de enquête daarna op **Gepubliceerd**.

## Beveiliging

- Iedere vereniging krijgt een lange, unieke invultoken.
- De publieke pagina kan uitsluitend de bij die token horende gepubliceerde enquête ophalen.
- E-mailadressen en tokens worden niet teruggestuurd naar de publieke pagina.
- Een uitnodiging kan maar één keer worden ingevuld.
- Alleen ingelogde Vappie-gebruikers kunnen enquêtes, uitnodigingen en antwoorden beheren.

## Ondersteunde vraagtypen

- Korte tekst
- Lange tekst
- Eén keuze
- Meerdere keuzes
- Schaal 1–5
- Rapportcijfer 1–10

## Mailverzending

Deze statische versie bewaart geen geheime mailwachtwoorden in de browser. Voor volledig automatisch bulkmailen vanuit één knop is later een beveiligde serverfunctie met een mailprovider nodig. De huidige versie ondersteunt rechtstreeks mailen per ontvanger en een veilig samenvoegbestand voor bulkmail.
