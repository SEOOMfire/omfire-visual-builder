export const OPENROUTER_MAX_MODELS = 3;

export function openRouterModelChain(model: string, fallbacks: readonly string[]): string[] {
  return [...new Set([model, ...fallbacks])].slice(0, OPENROUTER_MAX_MODELS);
}
