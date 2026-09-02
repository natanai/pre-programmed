import { json } from "./http";

export const MAX_MEDIA_BYTES = 20_000_000;
const CONTENT_KEY = /^[A-Za-z0-9_-]{8,128}$/;

function objectKey(contentKey: string) {
  return `media/${contentKey}`;
}

export function mediaContentKey(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  if (!encoded || encoded.includes("/")) return null;
  let contentKey = "";
  try { contentKey = decodeURIComponent(encoded); } catch { return null; }
  return CONTENT_KEY.test(contentKey) ? contentKey : null;
}

export async function getMediaContent(bucket: R2Bucket | undefined, contentKey: string) {
  if (!bucket) return json({ error: "Media content storage is not configured." }, { status: 503 });
  const object = await bucket.get(objectKey(contentKey));
  if (!object) return json({ error: "Media content not found." }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

export async function putMediaContent(bucket: R2Bucket | undefined, contentKey: string, request: Request) {
  if (!bucket) return json({ error: "Media content storage is not configured." }, { status: 503 });
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
      contentType: request.headers.get("content-type") || "application/octet-stream",
    },
  });
  if (!stored) return json({ error: "Media content key already exists." }, { status: 409 });
  return new Response(null, { status: 204 });
}
