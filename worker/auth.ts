export type AuthorEnv = { ADMIN_KEY?: string };

const AUTHOR_SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getSigningKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createAuthorToken(secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const expiresAt = nowSeconds + AUTHOR_SESSION_SECONDS;
  const payload = `author.${expiresAt}`;
  const key = await getSigningKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return {
    token: `${expiresAt}.${base64Url(signature)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export async function isAuthor(
  request: Request,
  env: AuthorEnv,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!env.ADMIN_KEY) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  const [expiresRaw, signatureRaw, extra] = token.split(".");
  if (!expiresRaw || !signatureRaw || extra) return false;
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt <= nowSeconds) return false;
  try {
    const key = await getSigningKey(env.ADMIN_KEY);
    return crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signatureRaw),
      encoder.encode(`author.${expiresAt}`),
    );
  } catch {
    return false;
  }
}
