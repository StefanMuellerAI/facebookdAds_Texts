"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

type Props = {
  title: string;
  prompt: string;
  defaultPrompt: string;
  onPromptChange: (value: string) => void;
  text: string;
  onTextChange: (value: string) => void;
  loading: boolean;
  error: string | null;
};

export default function VariantPanel({
  title,
  prompt,
  defaultPrompt,
  onPromptChange,
  text,
  onTextChange,
  loading,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const promptId = `prompt-${title.toLowerCase()}`;
  const isModified = prompt.trim() !== defaultPrompt.trim();

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <span className="count">{text.length} Zeichen</span>
        <CopyButton text={text} />
      </div>

      <div className="panel-body">
        <div className="prompt-box">
          <button
            type="button"
            className="prompt-toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={promptId}
          >
            <span className={`chevron ${open ? "open" : ""}`}>▶</span>
            Prompt{isModified ? " (angepasst)" : ""}
            {open && isModified ? (
              <span
                className="btn btn--ghost btn--small reset"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onPromptChange(defaultPrompt);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onPromptChange(defaultPrompt);
                  }
                }}
              >
                Zurücksetzen
              </span>
            ) : null}
          </button>

          {open ? (
            <div className="prompt-body" id={promptId}>
              <textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                spellCheck={false}
                aria-label={`Prompt für die Version ${title}`}
              />
              <p className="hint">
                Der lange Werbetext, die Überschriften, die Beschreibung, der CTA und
                das Asset werden automatisch mitgeschickt.
              </p>
            </div>
          ) : null}
        </div>

        <textarea
          className="text-area text-area--result"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={`${title}-Version erscheint hier – danach frei editierbar.`}
          aria-label={`${title}-Version`}
        />

        <div className={`status ${error ? "is-error" : ""}`}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" />
              <span>Wird generiert …</span>
            </>
          ) : error ? (
            <span>{error}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
