import { json } from "./http";

export const MAX_MEDIA_BYTES = 20_000_000;
export const MAX_DATABASE_TEXT_MEDIA_BYTES = 1_000_000;
const CONTENT_KEY = /^[A-Za-z0-9_-]{8,128}$/;
const DATABASE_TEXT_MEDIA_TYPES = new Set(["image/svg+xml"]);

type MediaContentDatabase = Pick<D1Database, "prepare">;
type TextContentRow = {
  mime_type: string;
  content_text: string;
  byte_length: number;
};

function objectKey(contentKey: string) {
  return `media/${contentKey}`;
}

function normalizedContentType(request: Request) {
  return (request.headers.get("content-type") || "application/octet-stream")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

function isDatabaseTextMedia(contentType: string) {
  return DATABASE_TEXT_MEDIA_TYPES.has(contentType);
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

async function hasDatabaseTextContent(db: MediaContentDatabase, contentKey: string) {
  return Boolean(await db.prepare(
    "SELECT content_key FROM media_text_content WHERE content_key = ?",
  ).bind(contentKey).first<{ content_key: string }>());
}

export async function getMediaContent(db: MediaContentDatabase, bucket: R2Bucket | undefined, contentKey: string) {
  const textContent = await getDatabaseTextContent(db, contentKey);
  if (textContent) {
    return new Response(textContent.content_text, {
      headers: {
        "content-type": `${textContent.mime_type}; charset=utf-8`,
        "content-length": String(textContent.byte_length),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (!bucket) {
    const referenced = await db.prepare(
      "SELECT mime_type FROM media_assets WHERE content_key = ? LIMIT 1",
    ).bind(contentKey).first<{ mime_type: string }>();
    if (referenced) {
      return json({
        error: `Binary media storage is not configured for ${referenced.mime_type}. Repository media and D1-backed SVG are still available.`,
      }, { status: 503 });
    }
    return json({ error: "Media content not found." }, { status: 404 });
  }

  const object = await bucket.get(objectKey(contentKey));
  if (!object) return json({ error: "Media content not found." }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

async function putDatabaseTextContent(db: MediaContentDatabase, bucket: R2Bucket | undefined, contentKey: string, request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DATABASE_TEXT_MEDIA_BYTES) {
    return json({ error: "Database-backed text media must be no larger than 1 MB." }, { status: 413 });
  }

  if (bucket && await bucket.head(objectKey(contentKey))) {
    return json({ error: "Media content key already exists." }, { status: 409 });
  }

  const content = await request.arrayBuffer();
  if (content.byteLength > MAX_DATABASE_TEXT_MEDIA_BYTES) {
    return json({ error: "Database-backed text media must be no larger than 1 MB." }, { status: 413 });
  }

  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    return json({ error: "Text media must contain valid UTF-8." }, { status: 400 });
  }

  const result = await db.prepare(
    `INSERT INTO media_text_content (content_key, mime_type, content_text, byte_length)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(content_key) DO NOTHING`,
  ).bind(contentKey, normalizedContentType(request), text, content.byteLength).run();

  if (!result.meta.changes) return json({ error: "Media content key already exists." }, { status: 409 });
  return new Response(null, { status: 204 });
}

async function putBlobContent(db: MediaContentDatabase, bucket: R2Bucket | undefined, contentKey: string, request: Request) {
  if (await hasDatabaseTextContent(db, contentKey)) {
    return json({ error: "Media content key already exists." }, { status: 409 });
  }
  if (!bucket) {
    return json({
      error: "Binary media storage is not configured. Configure an optional blob-storage provider or promote the file into repository media.",
    }, { status: 503 });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MEDIA_BYTES) {
    return json({ error: "Media content must be no larger than 20 MB." }, { status: 413 });
  }
  const content = await request.arrayBuffer();
  if (content.byteLength > MAX_MEDIA_BYTES) return json({ error: "Media content must be no larger than 20 MB." }, { status: 413 });

  // Content keys are versions, not mutable filenames. Refuse replacement so a
  // revision that points to an older key can always recover the same bytes.
  const stored = await bucket.put(objectKey(contentKey), content, {
    onlyIf: new Headers({ "If-None-Match": "*" }),
    httpMetadata: {
      contentType: normalizedContentType(request),
    },
  });
  if (!stored) return json({ error: "Media content key already exists." }, { status: 409 });
  return new Response(null, { status: 204 });
}

export async function putMediaContent(db: MediaContentDatabase, bucket: R2Bucket | undefined, contentKey: string, request: Request) {
  const contentType = normalizedContentType(request);
  return isDatabaseTextMedia(contentType)
    ? putDatabaseTextContent(db, bucket, contentKey, request)
    : putBlobContent(db, bucket, contentKey, request);
}
