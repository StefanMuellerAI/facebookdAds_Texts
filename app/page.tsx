"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdTabs from "@/components/AdTabs";
import AssetUploader from "@/components/AssetUploader";
import CopyButton from "@/components/CopyButton";
import VariantPanel from "@/components/VariantPanel";
import {
  DEFAULT_MEDIUM_PROMPT,
  DEFAULT_SHORT_PROMPT,
  MAX_ADS,
  createAdId,
  createEmptyAd,
  createEmptyCampaign,
  normalizeCampaign,
} from "@/lib/prompts";
import type { Ad, Campaign, GenerateRequest } from "@/lib/types";

const STORAGE_KEY = "fb-ads-texts:campaign";

const HEADLINE_PLACEHOLDERS = [
  "z. B. Jetzt 30 % sparen",
  "Variante für den A/B-Test",
  "Dritte Variante",
];

type Variant = "medium" | "short";

/** Schlüssel für Lade- und Fehlerzustand: eine Anzeige kann zwei Streams haben. */
function jobKey(adId: string, variant: Variant): string {
  return `${adId}:${variant}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "kampagne";
}

export default function Page() {
  const [campaign, setCampaign] = useState<Campaign>(createEmptyCampaign);
  const [activeAdId, setActiveAdId] = useState<string>("ad-1");
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(
    null,
  );

  const importRef = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Entwurf aus dem letzten Besuch wiederherstellen (migriert v1 automatisch).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const restored = normalizeCampaign(JSON.parse(stored));
        setCampaign(restored);
        setActiveAdId(restored.ads[0].id);
      }
    } catch {
      // Beschädigter Speicherstand: mit leerer Kampagne weitermachen.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
    } catch {
      // Quota überschritten (meist große Assets) – Autosave ist optional.
    }
  }, [campaign, hydrated]);

  useEffect(() => {
    const running = controllers.current;
    return () => {
      running.forEach((controller) => controller.abort());
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  const activeAd = useMemo(
    () => campaign.ads.find((ad) => ad.id === activeAdId) ?? campaign.ads[0],
    [campaign.ads, activeAdId],
  );

  const busyAdIds = useMemo(
    () =>
      Array.from(
        new Set(
          Object.entries(loading)
            .filter(([, isLoading]) => isLoading)
            .map(([key]) => key.split(":")[0]),
        ),
      ),
    [loading],
  );

  function updateCampaign<K extends keyof Campaign>(key: K, value: Campaign[K]) {
    setCampaign((current) => ({ ...current, [key]: value }));
  }

  /** Ändert genau eine Anzeige – immer über die ID, nie über den Index. */
  const patchAd = useCallback((adId: string, patch: Partial<Ad>) => {
    setCampaign((current) => ({
      ...current,
      ads: current.ads.map((ad) => (ad.id === adId ? { ...ad, ...patch } : ad)),
    }));
  }, []);

  function updateHeadline(index: number, value: string) {
    const headlines = [...activeAd.headlines] as Ad["headlines"];
    headlines[index] = value;
    patchAd(activeAd.id, { headlines });
  }

  function addAd() {
    if (campaign.ads.length >= MAX_ADS) return;
    const ad = createEmptyAd(`Anzeige ${campaign.ads.length + 1}`);
    setCampaign((current) => ({ ...current, ads: [...current.ads, ad] }));
    setActiveAdId(ad.id);
  }

  function duplicateAd(adId: string) {
    if (campaign.ads.length >= MAX_ADS) return;
    const source = campaign.ads.find((ad) => ad.id === adId);
    if (!source) return;
    const copy: Ad = { ...source, id: createAdId(), name: `${source.name} (Kopie)` };
    setCampaign((current) => {
      const index = current.ads.findIndex((ad) => ad.id === adId);
      const ads = [...current.ads];
      ads.splice(index + 1, 0, copy);
      return { ...current, ads };
    });
    setActiveAdId(copy.id);
  }

  function deleteAd(adId: string) {
    if (campaign.ads.length <= 1) return;
    const ad = campaign.ads.find((item) => item.id === adId);
    if (!window.confirm(`„${ad?.name ?? "Anzeige"}" wirklich löschen?`)) return;

    // Laufende Streams dieser Anzeige beenden, sonst schreiben sie ins Leere.
    (["medium", "short"] as Variant[]).forEach((variant) => {
      controllers.current.get(jobKey(adId, variant))?.abort();
      controllers.current.delete(jobKey(adId, variant));
    });

    setCampaign((current) => {
      const ads = current.ads.filter((item) => item.id !== adId);
      setActiveAdId((currentActive) =>
        currentActive === adId ? ads[0].id : currentActive,
      );
      return { ...current, ads };
    });
  }

  async function streamVariant(
    variant: Variant,
    ad: Ad,
    prompts: Pick<Campaign, "mediumPrompt" | "shortPrompt">,
  ) {
    const key = jobKey(ad.id, variant);
    const targetKey = variant === "medium" ? "mediumText" : "shortText";

    controllers.current.get(key)?.abort();
    const controller = new AbortController();
    controllers.current.set(key, controller);

    const body: GenerateRequest = {
      prompt: variant === "medium" ? prompts.mediumPrompt : prompts.shortPrompt,
      longText: ad.longText,
      headlines: ad.headlines,
      description: ad.description,
      cta: ad.cta,
      assetDataUrl: ad.asset?.dataUrl ?? null,
      variant: variant === "medium" ? "Mittel" : "Kurz",
    };

    setLoading((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: null }));
    patchAd(ad.id, { [targetKey]: "" });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = `Fehler ${response.status}`;
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // Antwort war kein JSON – generische Meldung reicht.
        }
        throw new Error(message);
      }
      if (!response.body) throw new Error("Keine Antwort vom Server erhalten.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        patchAd(ad.id, { [targetKey]: text });
      }
      text += decoder.decode();
      patchAd(ad.id, { [targetKey]: text.trim() });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      setErrors((current) => ({ ...current, [key]: message }));
    } finally {
      controllers.current.delete(key);
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  async function generateShorterVersions() {
    if (!activeAd.longText.trim()) {
      showToast("Bitte zuerst einen langen Werbetext schreiben.", true);
      return;
    }
    const snapshot = activeAd;
    const prompts = {
      mediumPrompt: campaign.mediumPrompt,
      shortPrompt: campaign.shortPrompt,
    };
    await Promise.all([
      streamVariant("medium", snapshot, prompts),
      streamVariant("short", snapshot, prompts),
    ]);
  }

  function cancelGeneration() {
    (["medium", "short"] as Variant[]).forEach((variant) => {
      const key = jobKey(activeAd.id, variant);
      controllers.current.get(key)?.abort();
      controllers.current.delete(key);
      setLoading((current) => ({ ...current, [key]: false }));
    });
  }

  function exportJson() {
    const payload: Campaign = {
      ...campaign,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(campaign.campaignName)}-${payload.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(
      `Kampagne mit ${campaign.ads.length} ${
        campaign.ads.length === 1 ? "Anzeige" : "Anzeigen"
      } exportiert.`,
    );
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const wasLegacy =
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray((parsed as Record<string, unknown>).ads);
        const next = normalizeCampaign(parsed);
        controllers.current.forEach((controller) => controller.abort());
        controllers.current.clear();
        setCampaign(next);
        setActiveAdId(next.ads[0].id);
        setErrors({});
        setLoading({});
        showToast(
          wasLegacy
            ? "Alte Einzelanzeigen-Datei geladen und in eine Kampagne überführt."
            : `Kampagne mit ${next.ads.length} ${
                next.ads.length === 1 ? "Anzeige" : "Anzeigen"
              } geladen.`,
        );
      } catch {
        showToast("Die Datei ist kein gültiges JSON.", true);
      }
    };
    reader.onerror = () => showToast("Datei konnte nicht gelesen werden.", true);
    reader.readAsText(file);
  }

  function resetCampaign() {
    if (!window.confirm("Alle Anzeigen verwerfen und neu anfangen?")) return;
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
    const next = createEmptyCampaign();
    setCampaign(next);
    setActiveAdId(next.ads[0].id);
    setErrors({});
    setLoading({});
    showToast("Neue Kampagne angelegt.");
  }

  const mediumKey = jobKey(activeAd.id, "medium");
  const shortKey = jobKey(activeAd.id, "short");
  const isGenerating = Boolean(loading[mediumKey] || loading[shortKey]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Facebook Ads Textgenerator</h1>
          <span className="model">Opus 5 · Effort Extra</span>
        </div>

        <input
          className="project-name"
          value={campaign.campaignName}
          onChange={(event) => updateCampaign("campaignName", event.target.value)}
          placeholder="Kampagnenname"
          aria-label="Kampagnenname"
        />

        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importJson(file);
            event.target.value = "";
          }}
        />

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => importRef.current?.click()}
          >
            JSON laden
          </button>
          <button type="button" className="btn" onClick={exportJson}>
            JSON exportieren
          </button>
          <button type="button" className="btn btn--ghost" onClick={resetCampaign}>
            Neu
          </button>
        </div>
      </header>

      <AdTabs
        ads={campaign.ads}
        activeId={activeAd.id}
        busyIds={busyAdIds}
        onSelect={setActiveAdId}
        onAdd={addAd}
        onDuplicate={duplicateAd}
        onDelete={deleteAd}
      />

      <main className="workspace">
        <section className="panel">
          <div className="panel-head">
            <h2>Anzeige</h2>
          </div>
          <div className="panel-body">
            <div className="field">
              <label htmlFor="ad-name">Name der Anzeige</label>
              <input
                id="ad-name"
                value={activeAd.name}
                onChange={(event) =>
                  patchAd(activeAd.id, { name: event.target.value })
                }
                placeholder="z. B. Retargeting Warenkorb"
              />
            </div>

            <AssetUploader
              asset={activeAd.asset}
              onChange={(asset) => patchAd(activeAd.id, { asset })}
              onError={(message) => showToast(message, true)}
            />

            {activeAd.headlines.map((headline, index) => (
              <div className="field" key={`headline-${index}`}>
                <label htmlFor={`headline-${index}`}>Überschrift {index + 1}</label>
                <input
                  id={`headline-${index}`}
                  value={headline}
                  onChange={(event) => updateHeadline(index, event.target.value)}
                  placeholder={HEADLINE_PLACEHOLDERS[index]}
                />
              </div>
            ))}

            <div className="field">
              <label htmlFor="description">Beschreibung</label>
              <textarea
                id="description"
                rows={3}
                value={activeAd.description}
                onChange={(event) =>
                  patchAd(activeAd.id, { description: event.target.value })
                }
                placeholder="Kurze Beschreibung unter der Überschrift"
              />
            </div>

            <div className="field">
              <label htmlFor="cta">Call to Action</label>
              <input
                id="cta"
                value={activeAd.cta}
                onChange={(event) =>
                  patchAd(activeAd.id, { cta: event.target.value })
                }
                placeholder="z. B. Mehr dazu"
              />
            </div>

            <div className="field">
              <label htmlFor="notes">Notizen für das Ads-Team</label>
              <textarea
                id="notes"
                rows={3}
                value={campaign.notes}
                onChange={(event) => updateCampaign("notes", event.target.value)}
                placeholder="Laufzeit, Zielgruppe, Budget, Besonderheiten – gilt für die ganze Kampagne"
              />
            </div>

            <p className="hint">
              Die Notizen und die beiden Prompts gelten für die ganze Kampagne, alles
              andere pro Anzeige. Der Entwurf wird automatisch im Browser gespeichert;
              für die Übergabe exportierst du die Kampagne als JSON – die Assets liegen
              darin base64-kodiert mit drin.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Lang</h2>
            <span className="count">{activeAd.longText.length} Zeichen</span>
            <CopyButton text={activeAd.longText} />
          </div>
          <div className="panel-body">
            <textarea
              className="text-area text-area--long"
              value={activeAd.longText}
              onChange={(event) =>
                patchAd(activeAd.id, { longText: event.target.value })
              }
              placeholder="Hier den langen Werbetext zum Asset schreiben …"
              aria-label="Langer Werbetext"
            />
            <button
              type="button"
              className="btn btn--primary btn--wide"
              onClick={generateShorterVersions}
              disabled={isGenerating || !activeAd.longText.trim()}
            >
              {isGenerating ? "Generiere …" : "Kürzere Versionen generieren"}
            </button>
            {isGenerating ? (
              <button type="button" className="btn btn--wide" onClick={cancelGeneration}>
                Abbrechen
              </button>
            ) : null}
          </div>
        </section>

        <VariantPanel
          title="Mittel"
          prompt={campaign.mediumPrompt}
          defaultPrompt={DEFAULT_MEDIUM_PROMPT}
          onPromptChange={(value) => updateCampaign("mediumPrompt", value)}
          text={activeAd.mediumText}
          onTextChange={(value) => patchAd(activeAd.id, { mediumText: value })}
          loading={Boolean(loading[mediumKey])}
          error={errors[mediumKey] ?? null}
        />

        <VariantPanel
          title="Kurz"
          prompt={campaign.shortPrompt}
          defaultPrompt={DEFAULT_SHORT_PROMPT}
          onPromptChange={(value) => updateCampaign("shortPrompt", value)}
          text={activeAd.shortText}
          onTextChange={(value) => patchAd(activeAd.id, { shortText: value })}
          loading={Boolean(loading[shortKey])}
          error={errors[shortKey] ?? null}
        />
      </main>

      {toast ? (
        <div className={`toast ${toast.isError ? "is-error" : ""}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
