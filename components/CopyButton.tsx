"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  label?: string;
  className?: string;
};

/** Fallback für Browser/Kontexte ohne navigator.clipboard (z. B. unsicherer Origin). */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export default function CopyButton({ text, label = "Kopieren", className }: Props) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  async function handleCopy() {
    if (!text) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = legacyCopy(text);
    }
    if (!ok) return;
    setCopied(true);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className={`btn btn--small ${copied ? "btn--copied" : ""} ${className ?? ""}`}
      title="Text in die Zwischenablage kopieren"
    >
      {copied ? "✓ Kopiert" : label}
    </button>
  );
}
