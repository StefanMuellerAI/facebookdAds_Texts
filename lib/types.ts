export type AssetFile = {
  /** Originaldateiname des hochgeladenen Assets */
  name: string;
  /** z. B. "image/png" */
  mimeType: string;
  /** vollständige Data-URL inkl. base64-Nutzdaten */
  dataUrl: string;
};

export type AdProject = {
  /** Schema-Version der JSON-Datei, damit spätere Formate migrierbar bleiben */
  version: 1;
  /** ISO-Zeitstempel des Exports */
  exportedAt: string;
  /** Freier Projektname, erscheint im Dateinamen des Exports */
  projectName: string;
  asset: AssetFile | null;
  headlines: [string, string, string];
  description: string;
  cta: string;
  longText: string;
  mediumText: string;
  shortText: string;
  mediumPrompt: string;
  shortPrompt: string;
};

/** Request-Body von POST /api/generate */
export type GenerateRequest = {
  /** Der frei editierbare Prompt für die Mittel- bzw. Kurzversion */
  prompt: string;
  /** Der lange Werbetext, der gekürzt werden soll */
  longText: string;
  /** Optionaler Kontext aus den Eingabefeldern */
  headlines?: string[];
  description?: string;
  cta?: string;
  /** Data-URL des Assets – wird als Bild mitgeschickt, wenn vorhanden */
  assetDataUrl?: string | null;
  /** Label nur für Logging/Fehlermeldungen: "Mittel" | "Kurz" */
  variant?: string;
};
