export type AssetFile = {
  /** Originaldateiname des hochgeladenen Assets */
  name: string;
  /** z. B. "image/png" */
  mimeType: string;
  /** vollständige Data-URL inkl. base64-Nutzdaten */
  dataUrl: string;
};

/** Eine einzelne Anzeige innerhalb einer Kampagne. */
export type Ad = {
  /** Stabile ID – hält Streams und Tabs auseinander, auch wenn umsortiert wird */
  id: string;
  /** Sprechender Name, erscheint im Tab und dient dem Ads-Team zur Orientierung */
  name: string;
  asset: AssetFile | null;
  headlines: [string, string, string];
  description: string;
  cta: string;
  longText: string;
  mediumText: string;
  shortText: string;
};

/**
 * Die exportierte JSON-Datei: eine Kampagne mit bis zu MAX_ADS Anzeigen.
 * Die beiden Prompts liegen bewusst auf Kampagnen-Ebene – die Kürzungsregeln
 * gelten für alle Anzeigen der Kampagne gleichermaßen.
 */
export type Campaign = {
  /** Schema-Version der JSON-Datei, damit ältere Formate migrierbar bleiben */
  version: 2;
  /** ISO-Zeitstempel des Exports */
  exportedAt: string;
  /** Name der Kampagne, erscheint im Dateinamen des Exports */
  campaignName: string;
  /** Freies Notizfeld für das Team, das die Anzeigen schaltet */
  notes: string;
  mediumPrompt: string;
  shortPrompt: string;
  ads: Ad[];
};

/** Version 1: eine einzelne Anzeige pro Datei. Wird beim Import migriert. */
export type AdProjectV1 = {
  version: 1;
  exportedAt: string;
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
