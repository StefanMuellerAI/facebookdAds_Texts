"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AssetUploader from "@/components/AssetUploader";
import CopyButton from "@/components/CopyButton";
import VariantPanel from "@/components/VariantPanel";
import {
  DEFAULT_MEDIUM_PROMPT,
  DEFAULT_SHORT_PROMPT,
  createEmptyProject,
  normalizeProject,
} from "@/lib/prompts";
import type { AdProject, GenerateRequest } from "@/lib/types";

const STORAGE_KEY = "fb-ads-texts:project";

const HEADLINE_PLACEHOLDERS = [
  "z. B. Jetzt 30 % sparen",
  "Variante für den A/B-Test",
  "Dritte Variante",
];

type Variant = "medium" | "short";

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
  const [project, setProject] = useState<AdProject>(createEmptyProject);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState<Record<Variant, boolean>>({
    medium: false,
    short: false,
  });
  const [errors, setErrors] = useState<Record<Variant, string | null>>({
    medium: null,
    short: null,
  });
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(
    null,
  );

  const importRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Entwurf aus dem letzten Besuch wiederherstellen.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setProject(normalizeProject(JSON.parse(stored)));
    } catch {
      // Beschädigter oder zu großer Speicherstand: mit leerem Projekt weitermachen.
    }
    setHydrated(true);
  }, []);

  // Danach bei jeder Änderung sichern, damit ein Reload nichts kostet.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // Quota überschritten (meist ein großes Asset) – Autosave ist optional.
    }
  }, [project, hydrated]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    },
    [],
  );

  function update<K extends keyof AdProject>(key: K, value: AdProject[K]) {
    setProject((current) => ({ ...current, [key]: value }));
  }

  function updateHeadline(index: number, value: string) {
    setProject((current) => {
      const headlines = [...current.headlines] as AdProject["headlines"];
      headlines[index] = value;
      return { ...current, headlines };
    });
  }

  async function streamVariant(
    variant: Variant,
    snapshot: AdProject,
    signal: AbortSignal,
  ) {
    const targetKey = variant === "medium" ? "mediumText" : "shortText";
    const body: GenerateRequest = {
      prompt: variant === "medium" ? snapshot.mediumPrompt : snapshot.shortPrompt,
      longText: snapshot.longText,
      headlines: snapshot.headlines,
      description: snapshot.description,
      cta: snapshot.cta,
      assetDataUrl: snapshot.asset?.dataUrl ?? null,
      variant: variant === "medium" ? "Mittel" : "Kurz",
    };

    setLoading((current) => ({ ...current, [variant]: true }));
    setErrors((current) => ({ ...current, [variant]: null }));
    setProject((current) => ({ ...current, [targetKey]: "" }));

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
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
        setProject((current) => ({ ...current, [targetKey]: text }));
      }
      text += decoder.decode();
      setProject((current) => ({ ...current, [targetKey]: text.trim() }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      setErrors((current) => ({ ...current, [variant]: message }));
    } finally {
      setLoading((current) => ({ ...current, [variant]: false }));
    }
  }

  async function generateShorterVersions() {
    if (!project.longText.trim()) {
      showToast("Bitte zuerst einen langen Werbetext schreiben.", true);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const snapshot = project;
    await Promise.all([
      streamVariant("medium", snapshot, controller.signal),
      streamVariant("short", snapshot, controller.signal),
    ]);
  }

  function cancelGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading({ medium: false, short: false });
  }

  function exportJson() {
    const payload: AdProject = { ...project, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = payload.exportedAt.slice(0, 10);
    link.href = url;
    link.download = `${slugify(project.projectName)}-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("JSON exportiert.");
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setProject(normalizeProject(parsed));
        setErrors({ medium: null, short: null });
        showToast("JSON geladen.");
      } catch {
        showToast("Die Datei ist kein gültiges JSON.", true);
      }
    };
    reader.onerror = () => showToast("Datei konnte nicht gelesen werden.", true);
    reader.readAsText(file);
  }

  function resetProject() {
    if (!window.confirm("Alle Eingaben verwerfen und neu anfangen?")) return;
    abortRef.current?.abort();
    setProject(createEmptyProject());
    setErrors({ medium: null, short: null });
    setLoading({ medium: false, short: false });
    showToast("Neues Projekt angelegt.");
  }

  const isGenerating = loading.medium || loading.short;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Facebook Ads Textgenerator</h1>
          <span className="model">Opus 5 · Effort Extra</span>
        </div>

        <input
          className="project-name"
          value={project.projectName}
          onChange={(event) => update("projectName", event.target.value)}
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
          <button type="button" className="btn btn--ghost" onClick={resetProject}>
            Neu
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="panel">
          <div className="panel-head">
            <h2>Anzeige</h2>
          </div>
          <div className="panel-body">
            <AssetUploader
              asset={project.asset}
              onChange={(asset) => update("asset", asset)}
              onError={(message) => showToast(message, true)}
            />

            {project.headlines.map((headline, index) => (
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
                value={project.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Kurze Beschreibung unter der Überschrift"
              />
            </div>

            <div className="field">
              <label htmlFor="cta">Call to Action</label>
              <input
                id="cta"
                value={project.cta}
                onChange={(event) => update("cta", event.target.value)}
                placeholder="z. B. Mehr dazu"
              />
            </div>

            <p className="hint">
              Der Entwurf wird automatisch im Browser gespeichert. Für die Übergabe
              oder ein Backup exportierst du ihn als JSON – das Asset liegt darin
              base64-kodiert mit drin.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Lang</h2>
            <span className="count">{project.longText.length} Zeichen</span>
            <CopyButton text={project.longText} />
          </div>
          <div className="panel-body">
            <textarea
              className="text-area text-area--long"
              value={project.longText}
              onChange={(event) => update("longText", event.target.value)}
              placeholder="Hier den langen Werbetext zum Asset schreiben …"
              aria-label="Langer Werbetext"
            />
            <button
              type="button"
              className="btn btn--primary btn--wide"
              onClick={generateShorterVersions}
              disabled={isGenerating || !project.longText.trim()}
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
          prompt={project.mediumPrompt}
          defaultPrompt={DEFAULT_MEDIUM_PROMPT}
          onPromptChange={(value) => update("mediumPrompt", value)}
          text={project.mediumText}
          onTextChange={(value) => update("mediumText", value)}
          loading={loading.medium}
          error={errors.medium}
        />

        <VariantPanel
          title="Kurz"
          prompt={project.shortPrompt}
          defaultPrompt={DEFAULT_SHORT_PROMPT}
          onPromptChange={(value) => update("shortPrompt", value)}
          text={project.shortText}
          onTextChange={(value) => update("shortText", value)}
          loading={loading.short}
          error={errors.short}
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
