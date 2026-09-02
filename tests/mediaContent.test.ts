import { describe, expect, it, vi } from "vitest";
import { getMediaContent, mediaContentKey, putMediaContent } from "../worker/mediaContent";

type StoredText = { mime_type: string; content_text: string; byte_length: number };

function mediaDatabase() {
  const rows = new Map<string, StoredText>();
  const referencedMime = new Map<string, string>();
  const prepare = vi.fn((sql: string) => ({
    bind: (...values: unknown[]) => ({
      async first<T>() {
        const contentKey = String(values[0]);
        if (sql.includes("FROM media_text_content")) {
          const row = rows.get(contentKey);
          if (!row) return null;
          if (sql.includes("SELECT content_key")) return { content_key: contentKey } as T;
          return row as T;
        }
        if (sql.includes("FROM media_assets")) {
          const mime_type = referencedMime.get(contentKey);
          return mime_type ? { mime_type } as T : null;
        }
        return null;
      },
      async run() {
        if (!sql.includes("INSERT INTO media_text_content")) return { meta: { changes: 0 } };
        const [contentKey, mimeType, contentText, byteLength] = values as [string, string, string, number];
        if (rows.has(contentKey)) return { meta: { changes: 0 } };
        rows.set(contentKey, { mime_type: mimeType, content_text: contentText, byte_length: byteLength });
        return { meta: { changes: 1 } };
      },
    }),
  }));
  return {
    db: { prepare } as unknown as D1Database,
    rows,
    referencedMime,
  };
}

describe("Media content storage", () => {
  it("parses only bounded stable content keys", () => {
    expect(mediaContentKey("/api/media/content/content_01", "/api/media/content/")).toBe("content_01");
    expect(mediaContentKey("/api/media/content/a/b", "/api/media/content/")).toBeNull();
    expect(mediaContentKey("/api/media/content/short", "/api/media/content/")).toBeNull();
  });

  it("stores and serves SVG text through D1 without an R2 binding", async () => {
    const { db } = mediaDatabase();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="1" height="1"/></svg>';
    const request = new Request("https://example.test/api/author/media/content/content_01", {
      method: "PUT",
      headers: { "Content-Type": "image/svg+xml" },
      body: svg,
    });

    const stored = await putMediaContent(db, undefined, "content_01", request);
    expect(stored.status).toBe(204);

    const fetched = await getMediaContent(db, undefined, "content_01");
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("content-type")).toContain("image/svg+xml");
    await expect(fetched.text()).resolves.toBe(svg);
  });

  it("keeps D1 text content immutable", async () => {
    const { db } = mediaDatabase();
    const first = new Request("https://example.test", {
      method: "PUT",
      headers: { "Content-Type": "image/svg+xml" },
      body: "<svg></svg>",
    });
    const second = new Request("https://example.test", {
      method: "PUT",
      headers: { "Content-Type": "image/svg+xml" },
      body: "<svg><rect/></svg>",
    });

    expect((await putMediaContent(db, undefined, "content_01", first)).status).toBe(204);
    expect((await putMediaContent(db, undefined, "content_01", second)).status).toBe(409);
  });

  it("reports binary storage as optional when no blob provider is configured", async () => {
    const { db } = mediaDatabase();
    const request = new Request("https://example.test/api/author/media/content/content_01", {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: "media bytes",
    });

    const response = await putMediaContent(db, undefined, "content_01", request);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("Binary media storage is not configured") });
  });

  it("writes immutable binary content to R2 when the optional provider exists", async () => {
    const { db } = mediaDatabase();
    const put = vi.fn().mockResolvedValue(null);
    const bucket = { put } as unknown as R2Bucket;
    const request = new Request("https://example.test/api/author/media/content/content_01", {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: "media bytes",
    });

    const response = await putMediaContent(db, bucket, "content_01", request);

    expect(response.status).toBe(409);
    expect(put).toHaveBeenCalledTimes(1);
    const [key, _content, options] = put.mock.calls[0] as [string, ArrayBuffer, { onlyIf?: Headers; httpMetadata?: { contentType?: string } }];
    expect(key).toBe("media/content_01");
    expect(options.onlyIf).toBeInstanceOf(Headers);
    expect(options.onlyIf?.get("If-None-Match")).toBe("*");
    expect(options.httpMetadata?.contentType).toBe("audio/wav");
  });
});
