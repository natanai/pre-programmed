import { describe, expect, it, vi } from "vitest";
import { generatedMediaContentStatement, getMediaContent, mediaContentKey } from "../worker/mediaContent";
import { mediaMutationValidator } from "../worker/features/mediaValidation";

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
        if (rows.has(contentKey)) throw new Error("UNIQUE constraint failed: media_text_content.content_key");
        rows.set(contentKey, { mime_type: mimeType, content_text: contentText, byte_length: byteLength });
        return { meta: { changes: 1 } };
      },
    }),
  }));
  return { db: { prepare } as unknown as D1Database, rows };
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect x="0" y="0" width="1" height="1" fill="#ffffff"/></svg>';

function generatedOperation(text = svg) {
  return {
    type: "mediaAsset.upsert",
    asset: {
      id: "generated-image",
      name: "generated.svg",
      kind: "image",
      mimeType: "image/svg+xml",
      contentKey: "content_01",
      byteLength: new TextEncoder().encode(text).byteLength,
      intrinsicWidth: 32,
      intrinsicHeight: 32,
      defaultPresentation: "inline",
      authoringMode: "vector-grid",
    },
    generatedContent: { mimeType: "image/svg+xml", text },
  };
}

describe("Media content storage", () => {
  it("parses only bounded stable content keys", () => {
    expect(mediaContentKey("/api/media/content/content_01", "/api/media/content/")).toBe("content_01");
    expect(mediaContentKey("/api/media/content/a/b", "/api/media/content/")).toBeNull();
    expect(mediaContentKey("/api/media/content/short", "/api/media/content/")).toBeNull();
  });

  it("stores and serves Author-generated SVG text through the Media-owned D1 statement", async () => {
    const { db } = mediaDatabase();
    const statement = generatedMediaContentStatement(db, "content_01", { mimeType: "image/svg+xml", text: svg });
    await statement.run();

    const fetched = await getMediaContent(db, "content_01");
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("content-type")).toContain("image/svg+xml");
    await expect(fetched.text()).resolves.toBe(svg);
  });

  it("keeps generated D1 content keys immutable", async () => {
    const { db } = mediaDatabase();
    await generatedMediaContentStatement(db, "content_01", { mimeType: "image/svg+xml", text: svg }).run();
    await expect(generatedMediaContentStatement(db, "content_01", { mimeType: "image/svg+xml", text: svg }).run())
      .rejects.toThrow("UNIQUE constraint");
  });

  it("validates generated SVG together with its Media definition", () => {
    expect(mediaMutationValidator.validate(generatedOperation())).toBeNull();
    const mismatched = generatedOperation();
    mismatched.asset.byteLength += 1;
    expect(mediaMutationValidator.validate(mismatched)).toContain("byte length");
  });

  it("rejects generated content attached to non-vector Media", () => {
    const operation = generatedOperation() as ReturnType<typeof generatedOperation> & { asset: Record<string, unknown> };
    operation.asset.authoringMode = "file";
    expect(mediaMutationValidator.validate(operation)).toContain("vector-grid SVG definition");
  });

  it("returns 404 when generated content is not present in D1", async () => {
    const { db } = mediaDatabase();
    const response = await getMediaContent(db, "content_01");
    expect(response.status).toBe(404);
  });
});
