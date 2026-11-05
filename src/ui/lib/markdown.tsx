// Handcrafted markdown renderer for agent messages (issue: rich message stream).
//
// Agent bubbles used to dump raw text — a wall of monospaced prose between the
// already-structured tool batches and decree tablets. This module parses the
// message content into markdown blocks and renders them in the pane's Norse
// visual style: headings, lists (nested), fenced code, tables, quotes, hr,
// inline bold/italic/strikethrough/code/links.
//
// Handcrafted, zero dependencies, BY DESIGN: the desktop plugin's runtime
// loader imports ONLY react + @hermes/plugin-sdk (issue #101), so no markdown
// package may be bundled. Output is React nodes built from typed tokens —
// no HTML string is ever produced, so agent text cannot inject markup.
//
// Parsing is two-stage:
//   parseMarkdown(text)  → MdBlock[]          (pure, exported for tests)
//   <Markdown text>     → React elements     (renders the blocks)
//
// Supported syntax (deliberately CommonMark-adjacent, not exhaustive):
//   # .. ###### headings          > quotes (nest by recursion)
//   ``` / ~~~ fenced code         | tables | with | pipes |
//   - * + bullets, 1. 1) numbers  - / * / _ horizontal rules
//   **bold**  *em*  _em_  ~~del~  `code`  [text](url)  bare http(s) autolinks
//   single newline inside a paragraph renders a <br> (chat convention)
//   backslash escapes for the markup characters

import React from "react";

// ── Inline tokens ───────────────────────────────────────────────────────────

export type MdInline =
  | { t: "text"; v: string }
  | { t: "br" }
  | { t: "code"; v: string }
  | { t: "strong"; c: MdInline[] }
  | { t: "em"; c: MdInline[] }
  | { t: "del"; c: MdInline[] }
  | { t: "link"; href: string; c: MdInline[] };

// ── Block tokens ────────────────────────────────────────────────────────────

export interface MdListItem {
  /** the item's own inline content */
  c: MdInline[];
  /** nested blocks (sub-lists, quotes) indented under this item */
  children: MdBlock[];
}

export type MdBlock =
  | { t: "heading"; level: number; c: MdInline[] }
  | { t: "paragraph"; c: MdInline[] }
  | { t: "code"; lang: string; v: string }
  | { t: "list"; ordered: boolean; items: MdListItem[] }
  | { t: "quote"; blocks: MdBlock[] }
  | { t: "hr" }
  | { t: "table"; align: MdAlign[]; header: MdInline[][]; rows: MdInline[][][] };

export type MdAlign = "left" | "center" | "right";

// ── Inline parsing ──────────────────────────────────────────────────────────

const MARKUP_CHARS = new Set(["*", "_", "~", "`", "[", "]", "\\", "|"]);

const BARE_URL_RE = /^https?:\/\/[^\s<>()]+/;
const LINK_RE = /^\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/;

/** index of the next occurrence of delim at or after from, -1 when absent */
function findClose(src: string, from: number, delim: string): number {
  for (let j = from; j + delim.length <= src.length; j++) {
    if (src.startsWith(delim, j)) return j;
  }
  return -1;
}

export function parseInline(src: string): MdInline[] {
  const out: MdInline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      out.push({ t: "text", v: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;

    // escaped markup character → literal
    if (ch === "\\" && i + 1 < src.length && MARKUP_CHARS.has(src[i + 1]!)) {
      buf += src[i + 1]!;
      i += 2;
      continue;
    }

    // soft break → <br> (chat convention: single newline is a hard break)
    if (ch === "\n") {
      flush();
      out.push({ t: "br" });
      i += 1;
      continue;
    }

    // `code span` — no newline inside
    if (ch === "`") {
      const close = src.indexOf("`", i + 1);
      if (close > i + 1 && !src.slice(i + 1, close).includes("\n")) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    // **strong** / __strong__ (check before single-char em)
    if (src.startsWith("**", i) || src.startsWith("__", i)) {
      const delim = src.slice(i, i + 2);
      const close = findClose(src, i + 2, delim);
      if (close > i + 2 && !src.slice(i + 2, close).includes("\n")) {
        flush();
        out.push({ t: "strong", c: parseInline(src.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    // ~~strikethrough~~
    if (src.startsWith("~~", i)) {
      const close = findClose(src, i + 2, "~~");
      if (close > i + 2 && !src.slice(i + 2, close).includes("\n")) {
        flush();
        out.push({ t: "del", c: parseInline(src.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    // *em* / _em_
    if ((ch === "*" || ch === "_") && !src.startsWith(ch + ch, i)) {
      const close = findClose(src, i + 1, ch);
      // word-internal underscores stay literal (snake_case identifiers)
      const isUnderscoreInternal = ch === "_" && i > 0 && /\w/.test(src[i - 1]!);
      if (close > i + 1 && !src.slice(i + 1, close).includes("\n") && !isUnderscoreInternal) {
        flush();
        out.push({ t: "em", c: parseInline(src.slice(i + 1, close)) });
        i = close + 1;
        continue;
      }
    }

    // [text](url) link
    if (ch === "[") {
      const m = LINK_RE.exec(src.slice(i));
      if (m) {
        flush();
        out.push({
          t: "link",
          href: m[2]!,
          c: parseInline(m[1] ?? ""),
        });
        i += m[0].length;
        continue;
      }
    }

    // bare http(s) URL autolink (not already part of a markdown link)
    if ((ch === "h" || ch === "H") && (i === 0 || /[\s(<]/.test(src[i - 1]!))) {
      const m = BARE_URL_RE.exec(src.slice(i));
      if (m) {
        flush();
        out.push({ t: "link", href: m[0], c: [{ t: "text", v: m[0] }] });
        i += m[0].length;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

// ── Block parsing ───────────────────────────────────────────────────────────

const FENCE_RE = /^\s*(```|~~~)\s*(\S*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE_RE = /^\s*>/;
const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{1,}:?\s*(?:\|\s*:?-{1,}:?\s*)*\|?\s*$/;
const INDENT_UNIT = 2;

function isTableLine(line: string): boolean {
  return /^\s*\|.*\|/.test(line) || /^\s*\|/.test(line);
}

function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function tableAlign(sepLine: string): MdAlign[] {
  return splitTableRow(sepLine).map((cell) => {
    const l = cell.startsWith(":");
    const r = cell.endsWith(":");
    if (l && r) return "center";
    if (r) return "right";
    return "left";
  });
}

/** lines that terminate an open paragraph (a new block is starting) */
function startsNewBlock(line: string): boolean {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    isTableLine(line)
  );
}

function parseBlocks(lines: string[], i: number, len: number): [MdBlock[], number] {
  const blocks: MdBlock[] = [];

  while (i < len) {
    const line = lines[i]!;

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // fenced code
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const delim = fence[1]!;
      const lang = fence[2] ?? "";
      const body: string[] = [];
      i += 1;
      while (i < len && !new RegExp(`^\\s*${delim}\\s*$`).test(lines[i]!)) {
        body.push(lines[i]!);
        i += 1;
      }
      i += 1; // past the closing fence (or EOF)
      blocks.push({ t: "code", lang, v: body.join("\n") });
      continue;
    }

    // horizontal rule
    if (HR_RE.test(line)) {
      blocks.push({ t: "hr" });
      i += 1;
      continue;
    }

    // heading
    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({
        t: "heading",
        level: heading[1]!.length,
        c: parseInline(heading[2] ?? ""),
      });
      i += 1;
      continue;
    }

    // blockquote — strip the marker and recurse
    if (QUOTE_RE.test(line)) {
      const inner: string[] = [];
      while (i < len && QUOTE_RE.test(lines[i]!)) {
        inner.push(lines[i]!.replace(/^\s*>?\s?/, ""));
        i += 1;
      }
      const [sub] = parseBlocks(inner, 0, inner.length);
      blocks.push({ t: "quote", blocks: sub });
      continue;
    }

    // list
    if (LIST_RE.test(line)) {
      const [list, next] = parseList(lines, i, len);
      blocks.push(list);
      i = next;
      continue;
    }

    // table — header row followed by a |---|---| separator
    if (isTableLine(line) && i + 1 < len && TABLE_SEP_RE.test(lines[i + 1]!)) {
      const header = splitTableRow(line).map(parseInline);
      const align = tableAlign(lines[i + 1]!);
      i += 2;
      const rows: MdInline[][][] = [];
      while (i < len && lines[i]!.trim() !== "" && isTableLine(lines[i]!)) {
        rows.push(splitTableRow(lines[i]!).map(parseInline));
        i += 1;
      }
      blocks.push({ t: "table", align, header, rows });
      continue;
    }

    // paragraph — until a blank line or a line that starts another block
    const para: string[] = [line];
    i += 1;
    while (i < len && lines[i]!.trim() !== "" && !startsNewBlock(lines[i]!)) {
      para.push(lines[i]!);
      i += 1;
    }
    blocks.push({ t: "paragraph", c: parseInline(para.join("\n")) });
  }

  return [blocks, i];
}

function parseList(lines: string[], i: number, len: number): [MdBlock, number] {
  const first = LIST_RE.exec(lines[i]!)!;
  const baseIndent = first[1]!.length;
  const ordered = /\d/.test(first[2]!);
  const items: MdListItem[] = [];
  let current: MdListItem | null = null;

  while (i < len) {
    const line = lines[i]!;
    const m = LIST_RE.exec(line);

    if (m) {
      const indent = m[1]!.length;
      const markerOrdered = /\d/.test(m[2]!);
      if (indent < baseIndent) break;
      if (indent === baseIndent && markerOrdered !== ordered) break;

      if (indent >= baseIndent + INDENT_UNIT) {
        // deeper item — nested list, attached under the current item
        const [nested, next] = parseList(lines, i, len);
        if (current) current.children.push(nested);
        else items.push({ c: [], children: [nested] });
        i = next;
        continue;
      }

      current = { c: parseInline(m[3] ?? ""), children: [] };
      items.push(current);
      i += 1;
      continue;
    }

    // lazy continuation / indented content belonging to the current item
    if (line.trim() !== "" && current && /^\s{2,}/.test(line) && !startsNewBlock(line)) {
      current.c = [...current.c, ...parseInline("\n" + line.trim())];
      i += 1;
      continue;
    }

    break;
  }

  return [{ t: "list", ordered, items }, i];
}

/** Parse markdown text into typed blocks. Pure — the test seam for this module. */
export function parseMarkdown(text: string): MdBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const [blocks] = parseBlocks(lines, 0, lines.length);
  return blocks;
}

// ── Rendering ───────────────────────────────────────────────────────────────

function renderInline(nodes: MdInline[], key: string): React.ReactNode {
  return nodes.map((n, i) => {
    const k = `${key}-${i}`;
    switch (n.t) {
      case "text":
        return n.v;
      case "br":
        return <br key={k} />;
      case "code":
        return (
          <code key={k} className="agent-md-code">
            {n.v}
          </code>
        );
      case "strong":
        return <strong key={k}>{renderInline(n.c, k)}</strong>;
      case "em":
        return <em key={k}>{renderInline(n.c, k)}</em>;
      case "del":
        return <del key={k}>{renderInline(n.c, k)}</del>;
      case "link":
        return (
          <a key={k} className="agent-md-link" href={n.href} target="_blank" rel="noopener noreferrer">
            {renderInline(n.c, k)}
          </a>
        );
      default:
        return null;
    }
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "agent-md-h1",
  2: "agent-md-h2",
  3: "agent-md-h3",
  4: "agent-md-h3",
  5: "agent-md-h3",
  6: "agent-md-h3",
};

function renderBlock(block: MdBlock, key: React.Key): React.ReactNode {
  switch (block.t) {
    case "heading":
      return (
        <div key={key} className={`agent-md-heading ${HEADING_CLASS[block.level] ?? "agent-md-h3"}`} role="heading" aria-level={block.level}>
          {renderInline(block.c, String(key))}
        </div>
      );
    case "paragraph":
      return (
        <p key={key} className="agent-md-p">
          {renderInline(block.c, String(key))}
        </p>
      );
    case "code":
      return (
        <pre key={key} className="agent-md-pre">
          <code className={block.lang ? `language-${block.lang}` : undefined}>{block.v}</code>
        </pre>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag key={key} className={`agent-md-list${block.ordered ? " agent-md-list--ordered" : ""}`}>
          {block.items.map((item, i) => (
            <li key={`${key}-li-${i}`}>
              {renderInline(item.c, `${key}-li-${i}`)}
              {item.children.map((child, j) => renderBlock(child, `${key}-li-${i}-sub-${j}`))}
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote key={key} className="agent-md-quote">
          {block.blocks.map((b, i) => renderBlock(b, `${key}-q-${i}`))}
        </blockquote>
      );
    case "hr":
      return <hr key={key} className="agent-md-hr" />;
    case "table":
      return (
        <div key={key} className="agent-md-table-wrap">
          <table className="agent-md-table">
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th key={`${key}-th-${i}`} style={{ textAlign: block.align[i] ?? "left" }}>
                    {renderInline(cell, `${key}-th-${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={`${key}-tr-${r}`}>
                  {row.map((cell, c) => (
                    <td key={`${key}-td-${r}-${c}`} style={{ textAlign: block.align[c] ?? "left" }}>
                      {renderInline(cell, `${key}-td-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export interface MarkdownProps {
  text: string;
  /** outer class — defaults to agent-md; the thinking variant dims everything */
  className?: string;
}

/** Render markdown text as styled React nodes inside the log terminal. */
export function Markdown({ text, className = "agent-md" }: MarkdownProps): React.ReactElement {
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);
  return <div className={className}>{blocks.map((b, i) => renderBlock(b, `b-${i}`))}</div>;
}
