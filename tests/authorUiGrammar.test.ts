import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS } from "../src/author/features/registry";
import type { AuthorWorkspaceSpec } from "../src/author/ui/types";
import { validateAuthorWorkspaceSpec } from "../src/author/ui/validation";

function inert() {}

describe("Author UI grammar", () => {
  it("accepts one semantic choice without manufacturing nested heading levels", () => {
    const spec: AuthorWorkspaceSpec = {
      id: "response",
      title: "Response 1",
      blocks: [{
        type: "choice",
        id: "after",
        label: "After",
        value: "create",
        onChange: inert,
        presentation: "segmented",
        options: [
          { value: "stay", label: "Stay here" },
          {
            value: "create",
            label: "Create new",
            content: [{
              type: "field",
              id: "destination-text",
              label: "Destination text",
              labelMode: "sr-only",
              control: "textarea",
              value: "",
              onChange: inert,
            }],
          },
          { value: "existing", label: "Link existing" },
        ],
      }],
    };

    expect(validateAuthorWorkspaceSpec(spec)).toEqual([]);
  });

  it("rejects nested sections that recreate navigation hierarchy inside one task", () => {
    const spec: AuthorWorkspaceSpec = {
      id: "bad-hierarchy",
      title: "Task",
      blocks: [{
        type: "section",
        id: "outer",
        label: "Destination",
        children: [{
          type: "section",
          id: "inner",
          label: "Create new node",
          children: [],
        }],
      }],
    };

    expect(validateAuthorWorkspaceSpec(spec).join("\n")).toContain("nests a section inside another section");
  });

  it("rejects visually repeated parent and field labels unless the field label is accessibility-only", () => {
    const spec: AuthorWorkspaceSpec = {
      id: "repeated-label",
      title: "Task",
      blocks: [{
        type: "choice",
        id: "mode",
        label: "Destination",
        value: "create",
        onChange: inert,
        options: [{
          value: "create",
          label: "Create new",
          content: [{
            type: "field",
            id: "field",
            label: "Create new",
            value: "",
            onChange: inert,
          }],
        }],
      }],
    };

    expect(validateAuthorWorkspaceSpec(spec).join("\n")).toContain("repeats its parent label");
  });

  it("does not let a newly added feature silently expand unrestricted workspace rendering", () => {
    const featureRoot = join(process.cwd(), "src", "features");
    const featureDirectories = readdirSync(featureRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());

    for (const feature of featureDirectories) {
      const authorDirectory = join(featureRoot, feature.name, "author");
      let authorFiles: string[] = [];
      try {
        authorFiles = readdirSync(authorDirectory).filter((name) => /\.(ts|tsx)$/.test(name));
      } catch {
        continue;
      }
      const usesLegacyWorkspace = authorFiles.some((file) =>
        readFileSync(join(authorDirectory, file), "utf8").includes("renderWorkspace"));
      if (!usesLegacyWorkspace) continue;

      expect(
        LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS.has(feature.name),
        `${feature.name} added unrestricted Author workspace markup. Use feature.workspaces + AuthorWorkspaceSpec instead.`,
      ).toBe(true);
    }
  });
});
