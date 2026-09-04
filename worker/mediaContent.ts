import { MAX_GENERATED_MEDIA_BYTES, type GeneratedMediaContent } from "../src/features/media/mutations";
import { json } from "./http";

const CONTENT_KEY = /^[A-Za-z0-9_-]{8,128}$/;

type MediaContentDatabase = Pick<D1Database, "prepare">;
type TextContentRow = {
  mime_type: string;
  content_text: string;
  byte_length: number;
};

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
 * Build the D1 statement for immutable Author-generated Media content. The
 * owning mediaAsset.upsert mutation batches this with the matching metadata and
 * project revision so generated content never has an independent save path.
 */
export function generatedMediaContentStatement(
  db: MediaContentDatabase,
  contentKey: string,
  content: GeneratedMediaContent,
) {
  const byteLength = new TextEncoder().encode(content.text).byteLength;
  if (byteLength > MAX_GENERATED_MEDIA_BYTES) {
    throw new Error("Database-backed generated media must be no larger than 1 MB.");
  }
  return db.prepare(
    `INSERT INTO media_text_content (content_key, mime_type, content_text, byte_length)
     VALUES (?, ?, ?, ?)`,
  ).bind(contentKey, content.mimeType, content.text, byteLength);
}
