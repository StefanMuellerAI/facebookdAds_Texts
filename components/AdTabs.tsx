"use client";

import { MAX_ADS } from "@/lib/prompts";
import type { Ad } from "@/lib/types";

type Props = {
  ads: Ad[];
  activeId: string;
  busyIds: string[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

/** Grob: hat die Anzeige alles, was zum Schalten gebraucht wird? */
function completeness(ad: Ad): { done: number; total: number } {
  const checks = [
    Boolean(ad.asset),
    ad.headlines.some((headline) => headline.trim().length > 0),
    ad.description.trim().length > 0,
    ad.cta.trim().length > 0,
    ad.longText.trim().length > 0,
    ad.mediumText.trim().length > 0,
    ad.shortText.trim().length > 0,
  ];
  return { done: checks.filter(Boolean).length, total: checks.length };
}

export default function AdTabs({
  ads,
  activeId,
  busyIds,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: Props) {
  return (
    <div className="adtabs" role="tablist" aria-label="Anzeigen der Kampagne">
      {ads.map((ad, index) => {
        const isActive = ad.id === activeId;
        const busy = busyIds.includes(ad.id);
        const { done, total } = completeness(ad);
        return (
          <div
            key={ad.id}
            className={`adtab ${isActive ? "is-active" : ""}`}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            onClick={() => onSelect(ad.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(ad.id);
              }
            }}
          >
            <span className="adtab-index">{index + 1}</span>
            <span className="adtab-name" title={ad.name}>
              {ad.name || `Anzeige ${index + 1}`}
            </span>
            {busy ? (
              <span className="spinner" aria-label="generiert gerade" />
            ) : (
              <span
                className={`adtab-progress ${done === total ? "is-complete" : ""}`}
                title={`${done} von ${total} Feldern gefüllt`}
              >
                {done}/{total}
              </span>
            )}
            {isActive ? (
              <span className="adtab-actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  title="Anzeige duplizieren"
                  disabled={ads.length >= MAX_ADS}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicate(ad.id);
                  }}
                >
                  Kopie
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  title="Anzeige löschen"
                  disabled={ads.length <= 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(ad.id);
                  }}
                >
                  Löschen
                </button>
              </span>
            ) : null}
          </div>
        );
      })}

      <button
        type="button"
        className="btn btn--small adtab-add"
        onClick={onAdd}
        disabled={ads.length >= MAX_ADS}
        title={
          ads.length >= MAX_ADS
            ? `Maximal ${MAX_ADS} Anzeigen pro Kampagne`
            : "Weitere Anzeige anlegen"
        }
      >
        + Anzeige
      </button>

      <span className="adtabs-count">
        {ads.length}/{MAX_ADS}
      </span>
    </div>
  );
}
