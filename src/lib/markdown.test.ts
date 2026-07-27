import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("escapes HTML so raw tags cannot be injected (XSS)", () => {
    const out = renderMarkdown('<script>alert(1)</script>');
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("renders bold and italic", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
    expect(renderMarkdown("_italic_")).toContain("<em>italic</em>");
  });

  it("renders safe links but never builds an anchor for dangerous schemes", () => {
    expect(renderMarkdown("[ok](https://example.com)")).toContain('href="https://example.com"');
    const js = renderMarkdown("[x](javascript:alert(1))");
    // The dangerous scheme must never become a real link/href…
    expect(js).not.toContain("<a ");
    expect(js).not.toContain('href="javascript');
    // …it stays inert as escaped literal text, which is safe.
    expect(js).toContain("[x](javascript:alert(1))");
  });

  it("adds rel/nofollow and target to links", () => {
    const out = renderMarkdown("[a](https://a.com)");
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it("renders unordered and ordered lists", () => {
    expect(renderMarkdown("- one\n- two")).toContain("<ul>");
    expect(renderMarkdown("1. a\n2. b")).toContain("<ol>");
  });

  it("renders headings and inline code", () => {
    expect(renderMarkdown("# Title")).toContain("<h1>Title</h1>");
    expect(renderMarkdown("`code`")).toContain("<code>code</code>");
  });

  it("renders fenced code blocks without interpreting markup inside", () => {
    const out = renderMarkdown("```\n**not bold**\n```");
    expect(out).toContain("<pre><code>");
    expect(out).toContain("**not bold**");
    expect(out).not.toContain("<strong>");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});
