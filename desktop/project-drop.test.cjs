const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { projectPathFromArguments } = require("./project-drop.cjs");

test("normal launch does not replace a project", () => {
  assert.equal(projectPathFromArguments(["Pre-Programmed.exe"]), null);
  assert.equal(projectPathFromArguments(["Pre-Programmed.exe", "--self-test"]), null);
  assert.equal(projectPathFromArguments(["Pre-Programmed.exe", "notes.txt"]), null);
});

test("a dropped .ppgame path can contain spaces and uppercase extensions", () => {
  const project = path.resolve("some folder", "My Game.PPGAME");
  assert.equal(projectPathFromArguments(["Pre-Programmed.exe", project]), project);
});

test("a relative dropped path uses the Windows launch directory", () => {
  const cwd = path.resolve("a temporary folder");
  assert.equal(
    projectPathFromArguments(["Pre-Programmed.exe", "--some-electron-switch", "saved.ppgame"], cwd),
    path.join(cwd, "saved.ppgame"),
  );
});
