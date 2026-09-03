import { json } from "./http";

export const MAX_DATABASE_TEXT_MEDIA_BYTES = 1_000_000;
const CONTENT_KEY = /^[A-Za-z0-9_-]{8,128}$/;
const DATABASE_TEXT_MEDIA_TYPES = new Set(["image/svg+xml"]);

type MediaContentDatabase = Pick<D1Database, "prepare">;
type TextContentRow = {
  mime_type: string;
  content_text: string;
  byte_length: number;
};

function normalizedContentType(request: Request) {
  return (request.headers.get("content-type") || "application/octet-stream")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

export function mediaContentKey(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  if (!encoded || encoded.includes("/")) return null;
  let contentKey = "";
  try { contentKey = decodeURIComponent(encoded); } catch { return null; }
  return CONTENT_KEY.test(contentKey) ? contentKey : null;
}

async function getDatabaseTextContent(db: MediaContentDatabase, contentKey: string) {
  return db.prepare(
    "SELECT mime_type, content_text, byte_length FROM media_text_content WHERE content_key = ?",
  ).bind(contentKey).first<TextContentRow>();
}

/** Public content endpoint for Author-generated textual Media stored in D1. */
export async function getMediaContent(db: MediaContentDatabase, contentKey: string) {
  const textContent = await getDatabaseTextContent(db, contentKey);
  if (!textContent) return json({ error: "Generated Media content not found." }, { status: 404 });

  return new Response(textContent.content_text, {
    headers: {
      "content-type": `${textContent.mime_type}; charset=utf-8`,
      "content-length": String(textContent.byte_length),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

/**
 * Store only engine-generated textual Media in D1. Binary file media belongs in
 * public/assets and is discovered by the generated repository manifest.
 */
export async function putMediaContent(db: MediaContentDatabase, contentKey: string, request: Request) {
  const contentType = normalizedContentType(request);
  if (!DATABASE_TEXT_MEDIA_TYPES.has(contentType)) {
    return json({
      error: "Only Author-generated SVG content is stored in D1. Add audio and other file media under public/assets with an .asset.json sidecar.",
    }, { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DATABASE_TEXT_MEDIA_BYTES) {
    return json({ error: "Database-backed generated media must be no larger than 1 MB." }, { status: 413 });
  }

  const content = await request.arrayBuffer();
  if (content.byteLength > MAX_DATABASE_TEXT_MEDIA_BYTES) {
    return json({ error: "Database-backed generated media must be no larger than 1 MB." }, { status: 413 });
  }

  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(content);
  } catch {
    return json({ error: "Generated text media must contain valid UTF-8." }, { status: 400 });
  }

  const result = await db.prepare(
    `INSERT INTO media_text_content (content_key, mime_type, content_text, byte_length)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(content_key) DO NOTHING`,
  ).bind(contentKey, contentType, text, content.byteLength).run();

  if (!result.meta.changes) return json({ error: "Media content key already exists." }, { status: 409 });
  return new Response(null, { status: 204 });
}
