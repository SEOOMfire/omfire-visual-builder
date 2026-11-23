const algorithm = "PBKDF2";
const digest = "SHA-256";
const iterations = 310_000;
const byteLength = 32;

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, rounds: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    algorithm,
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: algorithm, hash: digest, salt: salt as BufferSource, iterations: rounds },
    material,
    byteLength * 8,
  );
  return new Uint8Array(bits);
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2_sha256$${iterations}$${encode(salt)}$${encode(hash)}`;
}

export async function verifyPassword(password: string, encodedHash: string | null): Promise<boolean> {
  const parts = encodedHash?.split("$") ?? [];
  const validShape = parts.length === 4 && parts[0] === "pbkdf2_sha256" && /^\d+$/.test(parts[1]);
  const rounds = validShape ? Number(parts[1]) : iterations;
  const salt = validShape ? decode(parts[2]) : crypto.getRandomValues(new Uint8Array(16));
  const expected = validShape ? decode(parts[3]) : crypto.getRandomValues(new Uint8Array(byteLength));
  const actual = await derive(password, salt, rounds);
  return validShape && rounds >= iterations && equal(actual, expected);
}

export async function hashSessionToken(token: string): Promise<string> {
  const digestBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return encode(new Uint8Array(digestBytes));
}

export function createSessionToken(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}
