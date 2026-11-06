import type { LogEntry } from "../hooks/useLogStream";
import { batchSummary } from "./constants";

/**
 * Hermes-harness pretty log format.
 *
 * GKE agent-sandbox jobs can run under either harness. Claude Code sessions
 * stream JSONL (parseJsonlLine → processEvent); Hermes sessions print a
 * human-facing pretty format instead:
 *
 *   ────────────────────────────────────────     turn divider (U+2500 run)
 *   ☤ Hermes                                      assistant turn marker
 *   <assistant text until the next divider>       ← ☤ is OPTIONAL in the live
 *   ────────────────────────────────────────        format: any divider-
 *                                                  delimited prose segment
 *                                                  is an assistant turn
 *   ∴ Thought for 3s                              thinking marker (dim)
 *
 *   💻 $ git branch --show-current  1.1s          terminal call (ok)
 *   ✗ $ npm test  2.0s [exit 1]                   terminal call (failed)
 *   📖 Read web/content/projects/gwent.html       read_file
 *   ✍️ Write path/to/file                          write_file (│ diff lines follow)
 *   🔧 Patch path/to/file                         patch       (│ diff lines follow)
 *   🔎 Searching tools · <query>  0.1s            tool_search
 *   🔎 Grep <pattern>  0.4s                       grep (content search)
 *   ⚙️ Proc wait proc_xxxx  0.5s                  process wait
 *   📖 Reading tool details · 1 tool              tool_search (describe)
 *   📋 Plan 1/10 task(s) / Plan update 5/10 ✓     plan (todo ledger)
 *   [hermes] WARNING: …                           harness warning
 *   Query: <full echo of the task prompt>         duplicate of --- TASK PROMPT ---
 *
 * HermesLogParser is a line-oriented state machine. useLogStream feeds it
 * every non-JSON line (activation happens on the "=== Starting Hermes Agent
 * ===" entrypoint header, or self-activation on the first ☤ / Query: marker).
 * It returns HermesStep directives — entries to append plus an optional
 * replacement for an already-emitted entry (open tool-batch updates by id) —
 * so tool calls stream live into an open tool-batch, mirroring how the Claude
 * JSONL path batches tool_use events. Unknown lines fall back to `raw`
 * entries, the same dimmed rendering the Claude path uses.
 */

export interface HermesStep {
  /** entries to append to the log */
  append?: LogEntry[];
  /** replacement for an already-appended entry with the same id (open tool-batch updates) */
  update?: LogEntry;
}

const DIVIDER_RE = /^─{10,}$/;
const ASSISTANT_RE = /^☤/;
const QUERY_RE = /^Query: /;
const HERMES_WARN_RE = /^\[hermes\]\s*(?:WARNING|WARN):?\s*/i;
// NOTE the `u` flag on the emoji regexes: most tool glyphs are astral code
// points, and without it a character class like [💻✗] matches only the high
// surrogate, leaving the low one to break the \s*\$ anchor.
const TERMINAL_RE = /^[💻✗]\s*\$(.+)$/u;
const EXIT_RE = /\s*\[exit (\d+)\]\s*$/;
const DURATION_RE = /\s{2,}(?:\d+m\s*)?\d+(?:\.\d+)?s$/;
const READ_RE = /^📖\s*Read\s+(\S.*)$/u;
const TOOL_DETAILS_RE = /^📖\s*Reading tool details\s*·\s*(\S.*)$/u;
const TOOL_SEARCH_RE = /^🔎\s*Searching tools\s*·\s*(.+)$/u;
const GREP_RE = /^🔎\s*Grep\s+(\S.*)$/u;
// ⚙️ Proc wait proc_xxxx  0.5s — verb ("wait") + target id
const PROC_RE = /^⚙\uFE0F?\s*Proc\s+(\S+)\s+(\S.*?)\s*$/u;
// ∴ Thought for 3s — harness thinking marker, renders dim
const THOUGHT_RE = /^∴\s*Thought for\s+(\S.*)$/;
// Live-harness assistant turns carry no ☤ marker: prose between dividers is
// assistant text. Lines led by a printable-ASCII char open a prose block;
// unrecognized non-ASCII glyph lines (future harness shapes) stay raw.
const PROSE_LEAD_RE = /^[\x20-\x7E]/;
const WRITE_RE = /^✍\uFE0F?\s*Write\s+(\S.*)$/u;
const PATCH_RE = /^🔧\s*Patch\s+(\S.*)$/u;
const PLAN_RE = /^📋\s*Plan\s+(\S.*)$/u;
const DIFF_RE = /^│\s?(.*)$/;
const KV_RE = /^(Session|Title|Duration|Messages|Model|Branch|Working directory):\s*(.*)$/;
const RESUME_RE = /^(Resume this session with:|hermes (?:--resume|-c) )/;
const DECREE_RE = /᛭᛭᛭\s*DECREE COMPLETE/;
const VERDICT_RE = /VERDICT:\s*\**\s*([A-Za-z]+)/;

/** Cap on the │ diff text collected under a write_file / patch tool (matches the visual truncation in ToolBlock) */
const DIFF_MAX = 1200;
/** Cap on toolInput JSON (Claude path uses 500; terminal commands can be longer) */
const INPUT_MAX = 800;

function mergeSteps(a: HermesStep, b: HermesStep): HermesStep {
  return {
    ...(a.update || b.update ? { update: a.update ?? b.update } : {}),
    ...(a.append || b.append ? { append: [...(a.append ?? []), ...(b.append ?? [])] } : {}),
  };
}

export class HermesLogParser {
  private active = false;
  private inEcho = false;
  private sawDivider = false;
  private assistant: string[] | null = null;
  private batchId: string | null = null;
  private batchChildren: LogEntry[] = [];
  private batchComplete = false;
  /** the most recent tool accepts │ diff continuation lines (write_file / patch) */
  private lastDiffable = false;

  constructor(private readonly allocId: () => string) {}

  reset(): void {
    this.active = false;
    this.inEcho = false;
    this.sawDivider = false;
    this.assistant = null;
    this.batchId = null;
    this.batchChildren = [];
    this.batchComplete = false;
    this.lastDiffable = false;
  }

  /** Activate (and reset) for a Hermes-harness session. */
  activate(): void {
    this.reset();
    this.active = true;
  }

  isActive(): boolean {
    return this.active;
  }

  /**
   * Feed one raw (timestamp-stripped) log line.
   * Returns null when the parser is not active and the line holds no Hermes
   * activation marker — caller falls back to its own handling.
   */
  processLine(line: string): HermesStep | null {
    if (!this.active) {
      // Self-activation for logs whose entrypoint header never named the harness.
      if (ASSISTANT_RE.test(line) || QUERY_RE.test(line) || THOUGHT_RE.test(line)) this.active = true;
      else return null;
    }

    // Hermes re-prints the full task prompt as a `Query:` echo right after
    // --- END PROMPT ---. It duplicates the entrypoint-task tablet, so
    // suppress everything until the first turn divider.
    if (this.inEcho) {
      if (DIVIDER_RE.test(line)) this.inEcho = false;
      else return {};
    }

    if (DIVIDER_RE.test(line)) {
      this.sawDivider = true;
      this.lastDiffable = false;
      if (this.assistant !== null) return this.flushAssistant();
      return {};
    }

    if (ASSISTANT_RE.test(line)) {
      // New assistant turn — text completes the currently open tool-batch,
      // exactly like an assistant message does on the Claude JSONL path.
      const step = this.assistant !== null ? this.flushAssistant() : this.completeBatch();
      this.assistant = [];
      return step;
    }

    if (this.assistant !== null) {
      this.assistant.push(line);
      return {};
    }

    // ∴ Thought for Ns — dim thinking marker; completes the open tool-batch
    // like any other turn boundary and never renders as raw text.
    const thought = THOUGHT_RE.exec(line);
    if (thought) {
      const step = this.assistant !== null ? this.flushAssistant() : this.completeBatch();
      return mergeSteps(step, {
        append: [{ id: this.allocId(), type: "assistant-text", text: `Thought for ${thought[1]!.trim()}`, detail: "thinking" }],
      });
    }

    if (QUERY_RE.test(line)) {
      this.inEcho = true;
      return {};
    }

    if (line.trim() === "") return {};

    if (HERMES_WARN_RE.test(line)) {
      return { append: [{ id: this.allocId(), type: "warning", message: line }] };
    }

    // │ diff continuation lines attach to the last write_file / patch tool.
    const diff = DIFF_RE.exec(line);
    if (diff && this.lastDiffable && this.batchChildren.length > 0) {
      return this.appendDiff(diff[1] ?? "");
    }

    const term = TERMINAL_RE.exec(line);
    if (term) {
      const failed = line.startsWith("✗");
      let cmd = term[1] ?? "";
      let toolResult: string | undefined;
      const em = EXIT_RE.exec(cmd);
      if (em) {
        toolResult = `exit ${em[1]}`;
        cmd = cmd.slice(0, em.index);
      }
      cmd = cmd.replace(DURATION_RE, "").trim();
      return this.pushTool({
        toolName: "terminal",
        toolInput: JSON.stringify({ command: cmd }).slice(0, INPUT_MAX),
        toolIsError: failed,
        ...(toolResult !== undefined ? { toolResult } : {}),
      });
    }

    const read = READ_RE.exec(line);
    if (read) {
      return this.pushTool({
        toolName: "read_file",
        toolInput: JSON.stringify({ file_path: read[1]!.trim() }).slice(0, INPUT_MAX),
      });
    }

    const details = TOOL_DETAILS_RE.exec(line);
    if (details) {
      return this.pushTool({
        toolName: "tool_search",
        toolInput: JSON.stringify({ pattern: `tool details · ${details[1]!.trim()}` }).slice(0, INPUT_MAX),
      });
    }

    const search = TOOL_SEARCH_RE.exec(line);
    if (search) {
      const q = (search[1] ?? "").replace(DURATION_RE, "").trim();
      return this.pushTool({
        toolName: "tool_search",
        toolInput: JSON.stringify({ pattern: q }).slice(0, INPUT_MAX),
      });
    }

    const write = WRITE_RE.exec(line);
    if (write) {
      return this.pushTool({
        toolName: "write_file",
        toolInput: JSON.stringify({ file_path: write[1]!.trim() }).slice(0, INPUT_MAX),
        diffable: true,
      });
    }

    const patch = PATCH_RE.exec(line);
    if (patch) {
      return this.pushTool({
        toolName: "patch",
        toolInput: JSON.stringify({ file_path: patch[1]!.trim() }).slice(0, INPUT_MAX),
        diffable: true,
      });
    }

    const grep = GREP_RE.exec(line);
    if (grep) {
      const pattern = (grep[1] ?? "").replace(DURATION_RE, "").trim();
      return this.pushTool({
        toolName: "grep",
        toolInput: JSON.stringify({ pattern }).slice(0, INPUT_MAX),
      });
    }

    const proc = PROC_RE.exec(line);
    if (proc) {
      const procId = (proc[2] ?? "").replace(DURATION_RE, "").trim();
      return this.pushTool({
        toolName: "proc",
        toolInput: JSON.stringify({ op: proc[1]!.trim(), id: procId }).slice(0, INPUT_MAX),
      });
    }

    const plan = PLAN_RE.exec(line);
    if (plan) {
      return this.pushTool({
        toolName: "plan",
        toolInput: JSON.stringify({ plan: plan[1]!.trim() }).slice(0, INPUT_MAX),
      });
    }

    // Session-summary footer ("Resume this session with:" etc.) — flush any
    // dangling assistant turn, then render dimmed.
    if (RESUME_RE.test(line)) {
      const step = this.assistant !== null ? this.flushAssistant() : {};
      return mergeSteps(step, { append: [this.raw(line)] });
    }

    const kv = KV_RE.exec(line);
    if (kv) {
      // Startup KV lines (Model:/Session: right after the harness header) stay
      // raw so LogViewer's StartupBlock groups them under the header; the
      // trailing Session/Title/Duration summary renders as info rows.
      if (!this.sawDivider) return { append: [this.raw(line)] };
      return {
        append: [{ id: this.allocId(), type: "entrypoint-info", detail: kv[1]!, text: kv[2]!.trim() }],
      };
    }

    // Live harness: most assistant turns carry no ☤ Hermes marker — any
    // divider-delimited segment of prose IS the assistant turn. Open a prose
    // block on the first printable-ASCII-led line; it flushes as a rich
    // markdown agent bubble at the next divider. Lines led by any other
    // (non-ASCII) glyph are unknown harness shapes and degrade to raw.
    if (this.sawDivider && PROSE_LEAD_RE.test(line)) {
      this.assistant = [line];
      return {};
    }

    return { append: [this.raw(line)] };
  }

  private raw(line: string): LogEntry {
    return { id: this.allocId(), type: "raw", text: line };
  }

  private pushTool(tool: {
    toolName: string;
    toolInput: string;
    toolIsError?: boolean;
    toolResult?: string;
    diffable?: boolean;
  }): HermesStep {
    const entry: LogEntry = {
      id: this.allocId(),
      type: "tool-use",
      toolId: "",
      toolName: tool.toolName,
      toolInput: tool.toolInput,
      ...(tool.toolIsError !== undefined ? { toolIsError: tool.toolIsError } : {}),
      ...(tool.toolResult !== undefined ? { toolResult: tool.toolResult } : {}),
    };
    this.lastDiffable = tool.diffable === true;

    if (this.batchId !== null && !this.batchComplete) {
      this.batchChildren = [...this.batchChildren, entry];
      return { update: this.batchEntry() };
    }
    this.batchId = this.allocId();
    this.batchChildren = [entry];
    this.batchComplete = false;
    return { append: [this.batchEntry()] };
  }

  private appendDiff(line: string): HermesStep {
    const last = this.batchChildren[this.batchChildren.length - 1]!;
    const cur = last.toolResult ?? "";
    if (cur.length >= DIFF_MAX) return {};
    let next = cur ? `${cur}\n${line}` : line;
    if (next.length > DIFF_MAX) next = `${next.slice(0, DIFF_MAX)}\n…(truncated)`;
    const nextTool: LogEntry = { ...last, toolResult: next };
    this.batchChildren = [...this.batchChildren.slice(0, -1), nextTool];
    return { update: this.batchEntry() };
  }

  private completeBatch(): HermesStep {
    if (this.batchId === null || this.batchComplete) return {};
    this.batchComplete = true;
    this.lastDiffable = false;
    return { update: this.batchEntry() };
  }

  private batchEntry(): LogEntry {
    return {
      id: this.batchId ?? "",
      type: "tool-batch",
      text: batchSummary(this.batchChildren.filter((c) => c.type === "tool-use")),
      children: this.batchChildren,
      ...(this.batchComplete ? { complete: true } : {}),
    };
  }

  /** Close the open assistant turn: complete the open batch, emit the text, and a verdict if it is a decree. */
  private flushAssistant(): HermesStep {
    const lines = this.assistant ?? [];
    this.assistant = null;
    this.lastDiffable = false;
    const text = lines.join("\n").replace(/^\n+|\n+$/g, "");
    if (!text) return this.completeBatch();

    const append: LogEntry[] = [{ id: this.allocId(), type: "assistant-text", text }];
    if (DECREE_RE.test(text)) {
      const vm = VERDICT_RE.exec(text);
      if (vm) {
        const v = vm[1]!.toUpperCase();
        append.push({
          id: this.allocId(),
          type: "verdict",
          verdictResult: /^FAIL|^FINDINGS/.test(v) ? "FAIL" : "PASS",
        });
      }
    }
    return mergeSteps(this.completeBatch(), { append });
  }
}
