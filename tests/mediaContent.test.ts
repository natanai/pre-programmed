import { describe, expect, it, vi } from "vitest";
import { mediaContentKey, putMediaContent } from "../worker/mediaContent";

describe("Media content storage", () => {
  it("parses only bounded stable content keys", () => {
    expect(mediaContentKey("/api/media/content/content_01", "/api/media/content/")).toBe("content_01");
    expect(mediaContentKey("/api/media/content/a/b", "/api/media/content/")).toBeNull();
    expect(mediaContentKey("/api/media/content/short", "/api/media/content/")).toBeNull();
  });

  it("writes immutable R2 content and rejects an existing content key", async () => {
    const put = vi.fn().mockResolvedValue(null);
    const bucket = { put } as unknown as R2Bucket;
    const request = new Request("https://example.test/api/author/media/content/content_01", {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: "media bytes",
    });

    const response = await putMediaContent(bucket, "content_01", request);

    expect(response.status).toBe(409);
    expect(put).toHaveBeenCalledTimes(1);
    const [key, _content, options] = put.mock.calls[0] as [string, ArrayBuffer, { onlyIf?: Headers; httpMetadata?: { contentType?: string } }];
    expect(key).toBe("media/content_01");
    expect(options.onlyIf).toBeInstanceOf(Headers);
    expect(options.onlyIf?.get("If-None-Match")).toBe("*");
    expect(options.httpMetadata?.contentType).toBe("audio/wav");
  });
});
