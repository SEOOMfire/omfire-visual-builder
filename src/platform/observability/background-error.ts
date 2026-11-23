export function logBackgroundError(error: unknown, area: string): void {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "unbekannt";
  console.error(JSON.stringify({ area, name, message }));
}
