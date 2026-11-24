export type CustomerFormat = {
  id: string;
  channel: "PMAX" | "Meta" | "Tiktok";
  w: number;
  h: number;
  /** How the size is written in the file name. */
  token: string;
};

export const OTELO_FORMATS: readonly CustomerFormat[] = [
  { id: "pmax-1200x1200", channel: "PMAX", w: 1200, h: 1200, token: "1200x1200" },
  { id: "pmax-1200x628", channel: "PMAX", w: 1200, h: 628, token: "1200x628" },
  { id: "pmax-960x1200", channel: "PMAX", w: 960, h: 1200, token: "960x1200" },
  { id: "meta-1x1", channel: "Meta", w: 1080, h: 1080, token: "1x1" },
  { id: "meta-9x16", channel: "Meta", w: 1080, h: 1920, token: "9x16" },
  { id: "tiktok-9x16", channel: "Tiktok", w: 1080, h: 1920, token: "9x16" },
];

export function oteloFormat(id: string): CustomerFormat | undefined {
  return OTELO_FORMATS.find((format) => format.id === id || format.token === id);
}
