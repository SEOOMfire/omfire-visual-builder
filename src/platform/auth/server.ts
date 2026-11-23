import "server-only";

import { loadPrincipal } from "./session";

export async function createAuthProvider() {
  return { loadPrincipal };
}
