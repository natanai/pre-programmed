import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthorWorkspaceRenderer } from "../src/author/ui/AuthorWorkspaceRenderer";

describe("AuthorWorkspaceRenderer", () => {
  it("keeps the task action footer in the structured two-row workspace instead of the legacy header/body/footer frame", () => {
    const html = renderToStaticMarkup(
      <AuthorWorkspaceRenderer
        spec={{
          id: "test.workspace",
          title: "Test workspace",
          blocks: [{ type: "status", id: "body", text: "Body" }],
          actions: [{ id: "save", label: "SAVE", onAction: () => undefined }],
        }}
      />,
    );

    expect(html).toContain('class="author-panel author-ui-workspace"');
    expect(html).not.toContain("author-panel-frame");
    expect(html).toContain("author-ui-workspace-body");
    expect(html).toContain("author-ui-workspace-actions");
    expect(html).toContain("[SAVE]");
    expect(html.indexOf("author-ui-workspace-body")).toBeLessThan(html.indexOf("author-ui-workspace-actions"));
  });
  it("keeps editable field focus available when the shared save lock is active elsewhere", () => {
    const html = renderToStaticMarkup(
      <AuthorWorkspaceRenderer
        spec={{
          id: "test.fields",
          title: "Narration",
          blocks: [{
            type: "field",
            id: "narration",
            control: "textarea",
            label: "NARRATION",
            value: "you are born",
            onChange: () => undefined,
          }],
        }}
      />,
    );
    expect(html).toContain("<textarea");
    expect(html).not.toMatch(/<section[^>]*\\sinert(?:\\s|=|>)/);
  });

  it("temporarily locks its own inputs only while that workspace is explicitly saving", () => {
    const html = renderToStaticMarkup(
      <AuthorWorkspaceRenderer busy spec={{
        id: "test.saving",
        title: "Saving",
        blocks: [{ type: "field", id: "narration", control: "textarea", label: "NARRATION", value: "", onChange: () => undefined }],
      }} />,
    );
    expect(html).toMatch(/<section[^>]*\\sinert(?:\\s|=|>)/);
  });

});
