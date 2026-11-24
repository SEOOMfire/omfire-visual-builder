/** Disambiguate identical pixel sizes, for example both 1080x1920 formats. */
export function uniqueFormatLabels(formats: Array<{ id: string; pixel: string; channel: string }>): Map<string, string> {
  const counts = new Map<string, number>();
  for (const format of formats) counts.set(format.pixel, (counts.get(format.pixel) ?? 0) + 1);
  return new Map(formats.map((format) => [
    format.id,
    (counts.get(format.pixel) ?? 0) > 1 ? `${format.pixel} ${format.channel}` : format.pixel,
  ]));
}

export function markdownPreview(input: {
  intro: string;
  motifName: string;
  contactUrl: string;
  formats: Array<{ label: string; url: string }>;
  hints: string[];
  extra?: string;
}): string {
  const lines = [
    input.intro,
    `Motiv: ${input.motifName}`,
    `![Kontaktbogen](${input.contactUrl})`,
    input.formats.map((format) => `[${format.label}](${format.url})`).join(" "),
  ];
  if (input.hints.length) lines.push(`Hinweise: ${input.hints.join(" ")}`);
  if (input.extra) lines.push(input.extra);
  return lines.join("\n");
}
