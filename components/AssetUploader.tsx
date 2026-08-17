"use client";

import { useRef, useState } from "react";
import type { AssetFile } from "@/lib/types";

type Props = {
  asset: AssetFile | null;
  onChange: (asset: AssetFile | null) => void;
  onError: (message: string) => void;
};

/**
 * 8 MB Rohgröße. Base64 bläht die Datei um ~33 % auf, und das Asset landet
 * vollständig in der JSON-Datei und im API-Request – darüber wird beides zäh.
 */
const MAX_BYTES = 8 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Schätzt die Originalgröße aus der Länge des base64-Teils einer Data-URL. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export default function AssetUploader({ asset, onChange, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function readFile(file: File) {
    if (file.size > MAX_BYTES) {
      onError(
        `Datei ist ${formatBytes(file.size)} groß – maximal ${formatBytes(MAX_BYTES)} sind erlaubt.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl.startsWith("data:")) {
        onError("Datei konnte nicht gelesen werden.");
        return;
      }
      onChange({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
    };
    reader.onerror = () => onError("Datei konnte nicht gelesen werden.");
    reader.readAsDataURL(file);
  }

  const isImage = asset?.mimeType.startsWith("image/") ?? false;

  return (
    <div className="field">
      <label htmlFor="asset-input">Asset</label>
      <input
        id="asset-input"
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readFile(file);
          // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
          event.target.value = "";
        }}
      />

      {asset ? (
        <div className="asset-preview">
          {isImage ? (
            // Data-URL: next/image würde hier nichts optimieren, nur Konfiguration kosten.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.dataUrl} alt={asset.name} />
          ) : (
            <div className="asset-nonimage">
              Vorschau nur für Bilder – die Datei wird trotzdem im JSON gespeichert.
            </div>
          )}
          <div className="asset-meta">
            <span className="name" title={asset.name}>
              {asset.name}
            </span>
            <span className="size">{formatBytes(dataUrlBytes(asset.dataUrl))}</span>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => inputRef.current?.click()}
            >
              Ersetzen
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => onChange(null)}
            >
              Entfernen
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`dropzone ${dragging ? "is-dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) readFile(file);
          }}
          role="button"
          tabIndex={0}
        >
          <strong>Asset hochladen</strong>
          <span>Bild hierher ziehen oder klicken · max. 8 MB</span>
        </div>
      )}
    </div>
  );
}
