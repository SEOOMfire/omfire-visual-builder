"use client";

import type { ReactNode } from "react";

export type AssetTile = { id: string; label: string; preview: ReactNode };

/** Choice of logos, buttons, badges or stickers as small previews instead of a name list. */
export function AssetTiles({
  tiles,
  value,
  onSelect,
  noneLabel,
  label,
}: {
  tiles: readonly AssetTile[];
  /** Selected id; `undefined` for pickers that only add (badges, stickers). */
  value?: string | null;
  onSelect: (id: string | null) => void;
  /** Adds a "none" tile when set. */
  noneLabel?: string;
  label: string;
}) {
  return (
    <div className="vb-tiles" role="group" aria-label={label}>
      {noneLabel && (
        <button type="button" className={`vb-tile vb-tile-none${value === null ? " is-active" : ""}`} aria-pressed={value === null} title={noneLabel} onClick={() => onSelect(null)}>
          <span>{noneLabel}</span>
        </button>
      )}
      {tiles.map((tile) => (
        <button key={tile.id} type="button" className={`vb-tile${value === tile.id ? " is-active" : ""}`} aria-pressed={value === undefined ? undefined : value === tile.id}
          title={tile.label} aria-label={tile.label} onClick={() => onSelect(tile.id)}>
          <span className="vb-tile-preview">{tile.preview}</span>
          <small>{tile.label}</small>
        </button>
      ))}
    </div>
  );
}
