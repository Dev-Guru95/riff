// Tiny, dependency-free, XSS-safe markdown → HTML renderer for card
// descriptions and comments. Strategy: HTML-escape the ENTIRE input first, then
// apply a small set of inline/block transforms over the already-escaped text.
// Because escaping happens before any transform, no user input can inject tags,
// and link hrefs are scheme-validated. Supports: headings, bold, italic, inline
// code, fenced code, links, unordered/ordered lists, and paragraphs/line breaks.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only allow safe link schemes; anything else renders as plain text.
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h; // already escaped upstream
  return null;
}

function inline(text: string): string {
  let out = text;
  // Links: [label](url) — label may contain formatting, url is scheme-checked.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeHref(url);
    if (!href) return m;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  });
  // Inline code (before bold/italic so * inside code is literal).
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold then italic.
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_\s][^_]*)_/g, "$1<em>$2</em>");
  return out;
}

export function renderMarkdown(src: string): string {
  if (!src) return "";
  const escaped = escapeHtml(src);
  const lines = escaped.replace(/\r\n/g, "\n").split("\n");

  const html: string[] = [];
  let i = 0;
  let listType: "ul" | "ol" | null = null;
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (/^```/.test(line)) {
      closeList();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      html.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      continue;
    }

    // Headings.
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const level = h[1].length;
      html.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // Unordered list.
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== "ul") { closeList(); html.push("<ul>"); listType = "ul"; }
      html.push(`<li>${inline(ul[1])}</li>`);
      i++;
      continue;
    }

    // Ordered list.
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== "ol") { closeList(); html.push("<ol>"); listType = "ol"; }
      html.push(`<li>${inline(ol[1])}</li>`);
      i++;
      continue;
    }

    // Blank line ends a list / paragraph.
    if (line.trim() === "") { closeList(); i++; continue; }

    // Paragraph (collect consecutive non-special lines).
    closeList();
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,3})\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    html.push(`<p>${inline(para.join("<br/>"))}</p>`);
  }
  closeList();
  return html.join("\n");
}
