# Facebook Ads Textgenerator

Web-App zum Schreiben von Facebook-Ads-Texten: Du verwaltest eine **Kampagne mit bis zu
vier Anzeigen**. Zu jeder Anzeige schreibst du einen langen Werbetext, und per Knopfdruck
entstehen daraus eine Mittel- und eine Kurzversion. Die komplette Kampagne lässt sich als
eine JSON-Datei exportieren und wieder laden – gedacht als **Single Point of Truth für das
Team, das die Anzeigen schaltet**.

Läuft auf Next.js (App Router) und der Claude API mit **Opus 5, Effort-Stufe `xhigh` ("Extra")**.

## Funktionen

- **Bis zu 4 Anzeigen pro Kampagne** – Tab-Leiste zum Wechseln, mit Anlegen, Duplizieren
  und Löschen. Jeder Tab zeigt an, wie viele der sieben Felder schon gefüllt sind.
- **Asset hochladen** – per Klick oder Drag & Drop, mit Vorschau. Das Bild wird beim
  Generieren an das Modell mitgeschickt, damit Text und Motiv zusammenpassen.
- Pro Anzeige: **langer Werbetext**, drei **Überschriften**, **Beschreibung** und **CTA**.
- **Ein Knopf** unter der Langbox erzeugt Mittel- und Kurzversion parallel. Die Texte
  streamen live in die Boxen und sind danach frei editierbar.
- **Eigene Prompts** je Version – aufklappbar über der jeweiligen Box, mit Zurücksetzen auf
  den Standard. Sie gelten für die ganze Kampagne, damit alle Anzeigen nach denselben
  Regeln gekürzt werden.
- **Notizfeld für das Ads-Team** – Laufzeit, Budget, Zielgruppe wandern mit in die Datei.
- **Kopieren** aus jeder Box in die Zwischenablage.
- **JSON-Export/-Import** inklusive base64-kodierter Assets. Alte Einzelanzeigen-Dateien
  (Schema v1) werden beim Laden automatisch in eine Kampagne überführt.
- **Autosave** im Browser (localStorage), damit ein Reload nichts kostet.

## Was liegt wo?

| Ebene | Felder |
|---|---|
| Kampagne | `campaignName`, `notes`, `mediumPrompt`, `shortPrompt` |
| Anzeige (1–4) | `name`, `asset`, `headlines`, `description`, `cta`, `longText`, `mediumText`, `shortText` |

Die Prompts liegen bewusst auf Kampagnen-Ebene: Die Kürzungsregeln sind eine
Kampagnen-Entscheidung, keine pro Anzeige. Sollen einzelne Anzeigen abweichen, ist die
Kampagne der falsche Container – dann lieber eine zweite JSON-Datei.

## Lokal starten

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY eintragen
npm run dev
```

App läuft auf http://localhost:3000

## Auf Vercel deployen

1. Repository auf Vercel importieren (Framework „Next.js" wird automatisch erkannt).
2. Unter **Settings → Environment Variables** eintragen:
   - `ANTHROPIC_API_KEY` = dein Anthropic API Key
3. Deploy.

Die Route `/api/generate` ist auf `maxDuration = 300` gesetzt. Opus 5 auf Effort `xhigh`
denkt teils über eine Minute – die Antwort wird gestreamt, die Verbindung bleibt also offen
und der Text erscheint schrittweise.

## Aufbau

```
app/
  page.tsx               Oberfläche, Kampagnen-State, Export/Import, Streaming-Client
  layout.tsx             Root-Layout
  globals.css            komplettes Styling (kein CSS-Framework)
  api/generate/route.ts  Claude-Aufruf, streamt Text als text/plain zurück
components/
  AdTabs.tsx             Tab-Leiste der Anzeigen inkl. Anlegen/Kopieren/Löschen
  AssetUploader.tsx      Upload, Drag & Drop, Vorschau, Größenlimit
  VariantPanel.tsx       Mittel-/Kurz-Box mit aufklappbarem Prompt
  CopyButton.tsx         Zwischenablage inkl. Fallback für unsichere Origins
lib/
  prompts.ts             System-Prompt, Standard-Prompts, MAX_ADS, JSON-Migration
  types.ts               Typen für Kampagne, Anzeige und API-Request
```

## Format der JSON-Datei (Schema v2)

```jsonc
{
  "version": 2,
  "exportedAt": "2026-08-17T10:00:00.000Z",
  "campaignName": "Frühjahrskampagne 2026",
  "notes": "Laufzeit 01.03.–31.03., Budget 4.000 EUR, Zielgruppe DACH 28–45.",
  "mediumPrompt": "...",          // Kürzungsregeln, gelten für alle Anzeigen
  "shortPrompt": "...",
  "ads": [                        // 1 bis 4 Einträge
    {
      "id": "ad-1",               // stabil, hält Tabs und Streams auseinander
      "name": "Retargeting Warenkorb",
      "asset": {
        "name": "motiv.png",
        "mimeType": "image/png",
        "dataUrl": "data:image/png;base64,..."   // Asset base64-kodiert
      },
      "headlines": ["", "", ""],
      "description": "",
      "cta": "",
      "longText": "",
      "mediumText": "",
      "shortText": ""
    }
  ]
}
```

### Import ist tolerant

- **Schema v1** (eine Anzeige flach in der Datei, ohne `ads`-Array) wird automatisch
  erkannt und zu einer Kampagne mit einer Anzeige migriert. Der alte `projectName` wird
  dabei sowohl Kampagnen- als auch Anzeigenname.
- Fehlende oder falsch typisierte Felder fallen auf Standardwerte zurück, statt die App
  abstürzen zu lassen.
- Fehlende oder doppelte `id`s werden beim Laden neu vergeben.
- Mehr als vier Anzeigen in der Datei werden auf die ersten vier gekürzt.

## Grenzen

- **Maximal 4 Anzeigen pro Kampagne.** Die Grenze steht in `lib/prompts.ts` als `MAX_ADS`
  und wird sowohl in der Oberfläche als auch beim Import durchgesetzt.
- Assets sind auf 8 MB je Anzeige begrenzt – base64 bläht sie um rund ein Drittel auf.
  Bei vier ausgereizten Assets wird die JSON-Datei entsprechend groß (Richtwert ~43 MB);
  wer sie per Mail weiterreicht, sollte kleinere Motive nutzen.
- An das Modell werden nur Bildformate weitergereicht, die die Claude API akzeptiert
  (JPEG, PNG, GIF, WebP). Andere Dateien landen zwar im JSON, werden aber beim Generieren
  ignoriert.
- Das Autosave nutzt localStorage (Browser-Quota meist 5–10 MB). Bei großen Assets greift
  es nicht mehr; dann bleibt der Export die verlässliche Sicherung.
- Generiert wird immer für die **aktive** Anzeige. Einen „alle vier auf einmal"-Knopf gibt
  es bewusst nicht: das wären acht parallele Opus-5-Läufe auf Effort `xhigh`, mit
  entsprechendem Rate-Limit- und Kostenrisiko.
