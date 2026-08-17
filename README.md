# Facebook Ads Textgenerator

Web-App zum Schreiben von Facebook-Ads-Texten: Du schreibst zu einem Asset-Bild einen
langen Werbetext, und per Knopfdruck entstehen daraus eine Mittel- und eine Kurzversion.
Prompts, Eingabefelder und Ergebnisse lassen sich als JSON exportieren und wieder laden.

Läuft auf Next.js (App Router) und der Claude API mit **Opus 5, Effort-Stufe `xhigh` ("Extra")**.

## Funktionen

- **Asset hochladen** – per Klick oder Drag & Drop, mit Vorschau. Das Bild wird beim
  Generieren an das Modell mitgeschickt, damit Text und Motiv zusammenpassen.
- **Lange Version** schreiben, drei **Überschriften**, eine **Beschreibung** und einen **CTA** erfassen.
- **Ein Knopf** unter der Langbox erzeugt Mittel- und Kurzversion parallel. Die Texte
  streamen live in die Boxen und sind danach frei editierbar.
- **Eigene Prompts** je Version – aufklappbar über der jeweiligen Box, mit Zurücksetzen auf den Standard.
- **Kopieren** aus jeder Box in die Zwischenablage.
- **JSON-Export/-Import** inklusive base64-kodiertem Asset. Ein Klick auf „Neu" startet leer.
- **Autosave** im Browser (localStorage), damit ein Reload nichts kostet.

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
  page.tsx               Oberfläche, State, Export/Import, Streaming-Client
  layout.tsx             Root-Layout
  globals.css            komplettes Styling (kein CSS-Framework)
  api/generate/route.ts  Claude-Aufruf, streamt Text als text/plain zurück
components/
  AssetUploader.tsx      Upload, Drag & Drop, Vorschau, Größenlimit
  VariantPanel.tsx       Mittel-/Kurz-Box mit aufklappbarem Prompt
  CopyButton.tsx         Zwischenablage inkl. Fallback für unsichere Origins
lib/
  prompts.ts             System-Prompt, Standard-Prompts, JSON-Normalisierung
  types.ts               Typen für Projekt und API-Request
```

## Format der JSON-Datei

```jsonc
{
  "version": 1,
  "exportedAt": "2026-08-17T10:00:00.000Z",
  "projectName": "Neue Kampagne",
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
  "shortText": "",
  "mediumPrompt": "...",                      // eigene Prompts reisen mit
  "shortPrompt": "..."
}
```

Beim Import werden fehlende oder kaputte Felder durch Standardwerte ersetzt, statt die
App abstürzen zu lassen.

## Grenzen

- Assets sind auf 8 MB begrenzt – base64 bläht die Datei um rund ein Drittel auf, und sie
  landet vollständig in der JSON-Datei und im API-Request.
- An das Modell werden nur Bildformate weitergereicht, die die Claude API akzeptiert
  (JPEG, PNG, GIF, WebP). Andere Dateien landen zwar im JSON, werden aber beim Generieren
  ignoriert.
- Das Autosave nutzt localStorage. Bei einem großen Asset kann das Browser-Quota greifen;
  dann bleibt der Export die verlässliche Sicherung.
