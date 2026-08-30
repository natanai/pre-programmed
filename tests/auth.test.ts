import { describe, expect, it } from "vitest";
import { handleApi } from "../worker/index";

const db = {} as D1Database;

function login(key: string, adminKey?: string) {
  return handleApi(new Request("https://example.test/api/author/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }), { DB: db, ADMIN_KEY: adminKey });
}

describe("author authentication readiness", () => {
  it("reports whether the author secret is configured without exposing it", async () => {
    const missing = await handleApi(new Request("https://example.test/api/health"), { DB: db });
    const configured = await handleApi(new Request("https://example.test/api/health"), {
      DB: db,
      ADMIN_KEY: "private",
    });

    await expect(missing.json()).resolves.toMatchObject({ authorConfigured: false });
    await expect(configured.json()).resolves.toMatchObject({ authorConfigured: true });
  });

  it("returns a configuration error before comparing keys when the secret is missing", async () => {
    const response = await login("anything");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Author access has not been configured." });
  });

  it("distinguishes an incorrect key from a configured key", async () => {
    const rejected = await login("wrong", "expected");
    const accepted = await login("expected", "expected");

    expect(rejected.status).toBe(401);
    await expect(rejected.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({ token: expect.any(String) });
  });
});
