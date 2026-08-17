"use client";

import { useEffect, useRef } from "react";
import CharacterPicker from "./CharacterPicker";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  /** Beschriftung für den Picker-Tooltip, z. B. "Lang" */
  target: string;
  className?: string;
};

/**
 * Textfeld mit Zeichen-Picker. Das Einfügen passiert an der Cursorposition –
 * inklusive Ersetzen einer bestehenden Auswahl – und der Cursor landet danach
 * hinter dem eingefügten Zeichen, damit man weiterschreiben kann.
 */
export default function TextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  target,
  className,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Letzte bekannte Cursorposition, falls das Feld gerade nicht fokussiert ist. */
  const lastCaret = useRef<{ start: number; end: number } | null>(null);
  /** Position, die nach dem Re-Render gesetzt werden soll. */
  const pendingCaret = useRef<number | null>(null);

  function rememberCaret() {
    const el = textareaRef.current;
    if (!el) return;
    lastCaret.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  // React rendert den neuen Wert erst nach dem Insert – Cursor danach setzen.
  useEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
    lastCaret.current = { start: caret, end: caret };
  }, [value]);

  function insert(char: string) {
    const el = textareaRef.current;
    // Ohne Cursorposition (Feld nie fokussiert) hinten anhängen.
    const fallback = { start: value.length, end: value.length };
    const { start, end } =
      el && document.activeElement === el
        ? { start: el.selectionStart, end: el.selectionEnd }
        : (lastCaret.current ?? fallback);

    const next = value.slice(0, start) + char + value.slice(end);
    pendingCaret.current = start + char.length;
    onChange(next);
  }

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <CharacterPicker onInsert={insert} target={target} />
      </div>
      <textarea
        ref={textareaRef}
        className={`text-area ${className ?? ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onSelect={rememberCaret}
        onKeyUp={rememberCaret}
        onClick={rememberCaret}
        onBlur={rememberCaret}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
}
