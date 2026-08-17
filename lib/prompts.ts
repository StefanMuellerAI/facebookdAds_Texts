import type { AdProject } from "./types";

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

export function createEmptyProject(): AdProject {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projectName: "Neue Kampagne",
    asset: null,
    headlines: ["", "", ""],
    description: "",
    cta: "",
    longText: "",
    mediumText: "",
    shortText: "",
    mediumPrompt: DEFAULT_MEDIUM_PROMPT,
    shortPrompt: DEFAULT_SHORT_PROMPT,
  };
}

/**
 * Liest eine importierte JSON-Datei defensiv ein: fehlende oder falsch typisierte
 * Felder werden durch die Defaults eines leeren Projekts ersetzt, statt die App
 * mit einem Laufzeitfehler abstürzen zu lassen.
 */
export function normalizeProject(input: unknown): AdProject {
  const base = createEmptyProject();
  if (typeof input !== "object" || input === null) return base;
  const raw = input as Record<string, unknown>;

  const str = (value: unknown, fallback: string) =>
    typeof value === "string" ? value : fallback;

  const rawHeadlines = Array.isArray(raw.headlines) ? raw.headlines : [];
  const headlines: [string, string, string] = [
    str(rawHeadlines[0], ""),
    str(rawHeadlines[1], ""),
    str(rawHeadlines[2], ""),
  ];

  let asset: AdProject["asset"] = null;
  if (typeof raw.asset === "object" && raw.asset !== null) {
    const rawAsset = raw.asset as Record<string, unknown>;
    const dataUrl = str(rawAsset.dataUrl, "");
    if (dataUrl.startsWith("data:")) {
      asset = {
        name: str(rawAsset.name, "asset"),
        mimeType: str(rawAsset.mimeType, "application/octet-stream"),
        dataUrl,
      };
    }
  }

  return {
    version: 1,
    exportedAt: str(raw.exportedAt, base.exportedAt),
    projectName: str(raw.projectName, base.projectName),
    asset,
    headlines,
    description: str(raw.description, ""),
    cta: str(raw.cta, ""),
    longText: str(raw.longText, ""),
    mediumText: str(raw.mediumText, ""),
    shortText: str(raw.shortText, ""),
    mediumPrompt: str(raw.mediumPrompt, base.mediumPrompt),
    shortPrompt: str(raw.shortPrompt, base.shortPrompt),
  };
}
