const test = require("node:test");
const assert = require("node:assert/strict");
const { selectRelease, isNewerVersion } = require("./updater.cjs");
const base = {
  tag_name: "v0.1.12",
  draft: false,
  prerelease: false,
  assets: [{
    name: "Pre-Programmed-v0.1.12-windows-x64.zip",
    size: 213516081,
    digest: "sha256:" + "a".repeat(64),
    browser_download_url: "https://github.com/natanai/pre-programmed/releases/download/v0.1.12/Pre-Programmed-v0.1.12-windows-x64.zip",
  }],
};
test("only strictly newer stable versions update", () => {
  assert.equal(isNewerVersion("v0.1.12", "0.1.11"), true);
  assert.equal(isNewerVersion("v0.1.10", "0.1.11"), false);
  assert.equal(isNewerVersion("v0.1.11", "0.1.11"), false);
  assert.equal(isNewerVersion("v0.2.0", "0.1.99"), true);
  assert.equal(isNewerVersion("v0.1.12-rc.1", "0.1.11"), false);
});
test("only official Windows ZIP with verified digest is accepted", () => {
  assert.equal(selectRelease(base, "0.1.11").version, "0.1.12");
  assert.equal(selectRelease(base, "0.1.12"), null);
  assert.equal(selectRelease({ ...base, prerelease: true }, "0.1.11"), null);
  assert.throws(() => selectRelease({ ...base, assets: [{ ...base.assets[0], digest: null }] }, "0.1.11"), /digest/);
  assert.throws(() => selectRelease({ ...base, assets: [{ ...base.assets[0], browser_download_url: "https://evil.invalid/file.zip" }] }, "0.1.11"), /official/);
});
