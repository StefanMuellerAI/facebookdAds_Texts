import type { Ad, Campaign } from "./types";

/** Obergrenze an Anzeigen pro Kampagne. */
export const MAX_ADS = 4;

export const DEFAULT_MEDIUM_PROMPT = `Kürze den langen Werbetext zu einer Mittelversion für Facebook Ads.

Vorgaben:
- Ziellänge: ca. 400–600 Zeichen (rund 3–5 kurze Absätze)
- Kernnutzen und stärkstes Argument bleiben erhalten, Beispiele und Nebenschauplätze fliegen raus
- Erster Satz ist der Hook und funktioniert allein, bevor "Mehr anzeigen" geklickt wird
- Tonalität, Ansprache (Du/Sie) und Fachbegriffe exakt wie im Original übernehmen
- Endet mit einer klaren Handlungsaufforderung, die zum CTA-Button passt
- Keine Emojis erfinden – nur übernehmen, wenn sie im Original vorkommen`;

export const DEFAULT_SHORT_PROMPT = `Kürze den langen Werbetext zu einer Kurzversion für Facebook Ads.

Vorgaben:
- Ziellänge: maximal 150 Zeichen, ideal 90–125 Zeichen
- Genau ein Gedanke: das stärkste Verkaufsargument, sonst nichts
- Muss vollständig sichtbar sein, ohne dass "Mehr anzeigen" nötig wird
- Tonalität und Ansprache (Du/Sie) exakt wie im Original übernehmen
- Handlungsaufforderung knapp integrieren oder dem CTA-Button überlassen
- Keine Emojis erfinden – nur übernehmen, wenn sie im Original vorkommen`;

export const SYSTEM_PROMPT = `Du bist ein erfahrener Performance-Copywriter für Facebook- und Instagram-Ads im deutschsprachigen Raum.

Deine Aufgabe: Du bekommst einen langen Werbetext und eine Kürzungsanweisung. Du lieferst die gekürzte Fassung.

Regeln:
- Gib ausschließlich den fertigen Werbetext aus. Keine Vorrede, keine Erklärung, keine Überschrift, keine Anführungszeichen um den Text, keine Meta-Kommentare.
- Erfinde keine Fakten, Zahlen, Garantien oder Angebote, die nicht im Ausgangstext stehen.
- Halte dich an die Zeichenvorgaben der Anweisung.
- Übernimm Tonalität, Ansprache und Markensprache aus dem Ausgangstext.
- Vermeide Formulierungen, die gegen Metas Werberichtlinien verstoßen (keine persönlichen Zuschreibungen wie "Bist du übergewichtig?", keine Heils- oder Einkommensversprechen).
- Wenn ein Asset-Bild mitgeliefert wird, nutze es, damit Text und Bild zusammenpassen. Beschreibe das Bild aber nicht.`;

/**
 * IDs für neue Anzeigen. `crypto.randomUUID` läuft nur in Event-Handlern,
 * also nach der Hydration – der Startzustand nutzt feste IDs, damit Server-
 * und Client-Render identisch sind.
 */
export function createAdId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ad-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyAd(name: string, id: string = createAdId()): Ad {
  return {
    id,
    name,
    asset: null,
    headlines: ["", "", ""],
    description: "",
    cta: "",
    longText: "",
    mediumText: "",
    shortText: "",
  };
}

export function createEmptyCampaign(): Campaign {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    campaignName: "Neue Kampagne",
    notes: "",
    mediumPrompt: DEFAULT_MEDIUM_PROMPT,
    shortPrompt: DEFAULT_SHORT_PROMPT,
    // Feste ID: der Startzustand wird auch serverseitig gerendert.
    ads: [createEmptyAd("Anzeige 1", "ad-1")],
  };
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeAsset(value: unknown): Ad["asset"] {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const dataUrl = str(raw.dataUrl, "");
  if (!dataUrl.startsWith("data:")) return null;
  return {
    name: str(raw.name, "asset"),
    mimeType: str(raw.mimeType, "application/octet-stream"),
    dataUrl,
  };
}

function normalizeAd(value: unknown, index: number, usedIds: Set<string>): Ad {
  const raw =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  const rawHeadlines = Array.isArray(raw.headlines) ? raw.headlines : [];
  const headlines: Ad["headlines"] = [
    str(rawHeadlines[0], ""),
    str(rawHeadlines[1], ""),
    str(rawHeadlines[2], ""),
  ];

  // Doppelte oder fehlende IDs würden React-Keys und laufende Streams
  // durcheinanderbringen – deshalb hier hart eindeutig machen.
  let id = str(raw.id, "");
  if (!id || usedIds.has(id)) id = `ad-${index + 1}-${createAdId()}`;
  usedIds.add(id);

  return {
    id,
    name: str(raw.name, `Anzeige ${index + 1}`),
    asset: normalizeAsset(raw.asset),
    headlines,
    description: str(raw.description, ""),
    cta: str(raw.cta, ""),
    longText: str(raw.longText, ""),
    mediumText: str(raw.mediumText, ""),
    shortText: str(raw.shortText, ""),
  };
}

/**
 * Liest eine importierte JSON-Datei defensiv ein und migriert dabei das
 * v1-Format (eine Anzeige pro Datei) auf das aktuelle Kampagnen-Format.
 * Fehlende oder falsch typisierte Felder fallen auf Defaults zurück, statt
 * die App mit einem Laufzeitfehler abstürzen zu lassen.
 */
export function normalizeCampaign(input: unknown): Campaign {
  const base = createEmptyCampaign();
  if (typeof input !== "object" || input === null) return base;
  const raw = input as Record<string, unknown>;

  const usedIds = new Set<string>();

  // v1 erkennt man am fehlenden ads-Array: die Anzeige liegt flach in der Datei.
  const isLegacy = !Array.isArray(raw.ads);
  const rawAds = isLegacy ? [raw] : (raw.ads as unknown[]);

  const ads = rawAds
    .slice(0, MAX_ADS)
    .map((ad, index) => normalizeAd(ad, index, usedIds));
  if (ads.length === 0) ads.push(createEmptyAd("Anzeige 1"));

  // v1 kennt keinen Anzeigennamen – dort trägt der Projektname beides.
  const legacyName = str(raw.projectName, base.campaignName);
  if (isLegacy) ads[0].name = legacyName;

  return {
    version: 2,
    exportedAt: str(raw.exportedAt, base.exportedAt),
    campaignName: str(raw.campaignName, legacyName),
    notes: str(raw.notes, ""),
    mediumPrompt: str(raw.mediumPrompt, base.mediumPrompt),
    shortPrompt: str(raw.shortPrompt, base.shortPrompt),
    ads,
  };
}
