import { describe, expect, it, vi } from "vitest";
import { getMediaContent, mediaContentKey, putMediaContent } from "../worker/mediaContent";

type StoredText = { mime_type: string; content_text: string; byte_length: number };

function mediaDatabase() {
  const rows = new Map<string, StoredText>();
  const prepare = vi.fn((sql: string) => ({
    bind: (...values: unknown[]) => ({
      async first<T>() {
        const contentKey = String(values[0]);
        if (!sql.includes("FROM media_text_content")) return null;
        return (rows.get(contentKey) ?? null) as T | null;
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
  return { db: { prepare } as unknown as D1Database, rows };
}

describe("Media content storage", () => {
  it("parses only bounded stable content keys", () => {
    expect(mediaContentKey("/api/media/content/content_01", "/api/media/content/")).toBe("content_01");
    expect(mediaContentKey("/api/media/content/a/b", "/api/media/content/")).toBeNull();
    expect(mediaContentKey("/api/media/content/short", "/api/media/content/")).toBeNull();
  });

  it("stores and serves Author-generated SVG text through D1", async () => {
    const { db } = mediaDatabase();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="1" height="1"/></svg>';
    const request = new Request("https://example.test/api/author/media/content/content_01", {
      method: "PUT",
      headers: { "Content-Type": "image/svg+xml" },
      body: svg,
    });

    const stored = await putMediaContent(db, "content_01", request);
    expect(stored.status).toBe(204);

    const fetched = await getMediaContent(db, "content_01");
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("content-type")).toContain("image/svg+xml");
    await expect(fetched.text()).resolves.toBe(svg);
  });

  it("keeps generated D1 content immutable", async () => {
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

    expect((await putMediaContent(db, "content_01", first)).status).toBe(204);
    expect((await putMediaContent(db, "content_01", second)).status).toBe(409);
  });

  it("rejects binary file uploads instead of advertising a missing blob provider", async () => {
    const { db } = mediaDatabase();
    const request = new Request("https://example.test/api/author/media/content/content_01", {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: "media bytes",
    });

    const response = await putMediaContent(db, "content_01", request);
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("public/assets"),
    });
  });

  it("returns 404 when generated content is not present in D1", async () => {
    const { db } = mediaDatabase();
    const response = await getMediaContent(db, "content_01");
    expect(response.status).toBe(404);
  });
});
