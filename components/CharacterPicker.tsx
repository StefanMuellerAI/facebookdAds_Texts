"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHARACTER_GROUPS } from "@/lib/characters";

type Props = {
  /** Wird mit dem gewählten Zeichen aufgerufen; der Picker bleibt offen. */
  onInsert: (char: string) => void;
  /** Für die Beschriftung, z. B. "Lang" */
  target: string;
};

const RECENT_KEY = "fb-ads-texts:recent-chars";
const MAX_RECENT = 16;

function loadRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function CharacterPicker({ onInsert, target }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      searchRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [open]);

  // Klick außerhalb und Escape schließen den Picker.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = CHARACTER_GROUPS;
    if (!needle) return base;
    return base
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.keywords.includes(needle) ||
            item.char === needle ||
            group.label.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  function handleInsert(char: string) {
    onInsert(char);
    const next = [char, ...recent.filter((item) => item !== char)].slice(0, MAX_RECENT);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Zuletzt genutzt ist Komfort, kein Muss.
    }
  }

  return (
    <div className="picker" ref={wrapperRef}>
      <button
        type="button"
        className={`btn btn--small ${open ? "btn--active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Emoji oder Sonderzeichen in „${target}" einfügen`}
      >
        ☺ Zeichen
      </button>

      {open ? (
        <div className="picker-pop" role="dialog" aria-label={`Zeichen für ${target}`}>
          <input
            ref={searchRef}
            className="picker-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suchen: haken, pfeil, geld …"
            aria-label="Zeichen suchen"
          />

          <div className="picker-scroll">
            {!query && recent.length > 0 ? (
              <div className="picker-group">
                <h4>Zuletzt genutzt</h4>
                <div className="picker-grid">
                  {recent.map((char) => (
                    <button
                      key={`recent-${char}`}
                      type="button"
                      className="picker-char"
                      // Verhindert, dass das Textfeld den Fokus und damit die
                      // Cursorposition verliert.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleInsert(char)}
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {groups.map((group) => (
              <div className="picker-group" key={group.id}>
                <h4>{group.label}</h4>
                <div className="picker-grid">
                  {group.items.map((item) => (
                    <button
                      key={`${group.id}-${item.char}`}
                      type="button"
                      className="picker-char"
                      title={item.keywords.split(" ")[0]}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleInsert(item.char)}
                    >
                      {item.char}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {groups.length === 0 ? (
              <p className="picker-empty">Nichts gefunden für „{query}".</p>
            ) : null}
          </div>

          <p className="picker-hint">
            Wird an der Cursorposition eingefügt. Der Picker bleibt offen, du kannst
            mehrere Zeichen hintereinander setzen.
          </p>
        </div>
      ) : null}
    </div>
  );
}
