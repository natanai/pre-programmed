import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthorInlineDisclosure } from "../src/author/ui/AuthorInlineDisclosure";

describe("AuthorInlineDisclosure", () => {
  it("keeps primary label, compact summary, chevron, and body in one inline disclosure", () => {
    const html = renderToStaticMarkup(
      <AuthorInlineDisclosure label="WHEN" summary="Always" defaultOpen>
        <div>condition editor</div>
      </AuthorInlineDisclosure>,
    );

    expect(html).toContain("author-inline-disclosure");
    expect(html).toContain("author-inline-disclosure-label\">WHEN");
    expect(html).toContain("author-inline-disclosure-summary\">Always");
    expect(html).toContain("author-inline-disclosure-chevron");
    expect(html).toContain("condition editor");
    expect(html).toContain("open=\"\"");
  });
});
