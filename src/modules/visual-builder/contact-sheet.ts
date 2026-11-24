/** Longest edge of the contact sheet. Larger sheets are slow in chat. */
export const CONTACT_MAX_EDGE = 2000;

export function contactScale(rawWidth: number, rawHeight: number): number {
  const longest = Math.max(rawWidth, rawHeight, 1);
  return longest <= CONTACT_MAX_EDGE ? 1 : CONTACT_MAX_EDGE / longest;
}
