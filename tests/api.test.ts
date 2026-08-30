import { describe, expect, it, vi } from "vitest";
import { readJson, waitForProjectSnapshot } from "../src/data/api";
import { project } from "./fixtures";

describe("API synchronization", () => {
  it("rejects an old static-host response even when it has a 200 status", async () => {
    const response = new Response("<!doctype html><title>old client</title>", {
      headers: { "content-type": "text/html" },
    });
    await expect(readJson(response)).rejects.toThrow("expected JSON");
  });

  it("retries snapshot synchronization deterministically until the API is ready", async () => {
    const snapshot = project();
    const fetchSnapshot = vi.fn()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockRejectedValueOnce(new Error("deployment in progress"))
      .mockResolvedValue(snapshot);
    const onAttemptFailure = vi.fn();

    await expect(waitForProjectSnapshot({
      fetchSnapshot,
      onAttemptFailure,
      retryDelaysMs: [0],
    })).resolves.toBe(snapshot);
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
    expect(onAttemptFailure).toHaveBeenNthCalledWith(1, expect.any(TypeError), 1);
    expect(onAttemptFailure).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
  });
});
