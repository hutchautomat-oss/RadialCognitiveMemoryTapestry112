/**
 * Advisory size guard for ./replit.md.
 *
 * replit.md is always loaded into the agent's system prompt, so its size is a
 * recurring tax on every turn. This check nudges a trim-and-demote pass when the
 * file regrows past its budget. It is intentionally ADVISORY: it never exits
 * non-zero, so it can be wired into post-merge / validation without ever
 * blocking a merge. See the "Maintenance" section of replit.md for the
 * budget rationale and the demote-vs-keep rules.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Budget in estimated tokens. We approximate tokens as chars / CHARS_PER_TOKEN.
// CHARS_PER_TOKEN is deliberately conservative: a real BPE tokenizer on this
// file runs ~3.5 chars/token, so chars/4 slightly UNDER-counts. The budget is
// set with that bias in mind — staying under it keeps the real token count near
// ~6k. Bump the budget only with a deliberate decision recorded in replit.md.
const TOKEN_BUDGET = 6000;
const CHARS_PER_TOKEN = 4;

const here = dirname(fileURLToPath(import.meta.url));
const replitMdPath = resolve(here, "..", "..", "replit.md");

let text: string;
try {
  text = readFileSync(replitMdPath, "utf8");
} catch {
  console.warn(`[replit.md size] could not read ${replitMdPath} — skipping advisory check.`);
  process.exit(0);
}

const chars = text.length;
const estTokens = Math.round(chars / CHARS_PER_TOKEN);
const pct = Math.round((estTokens / TOKEN_BUDGET) * 100);

if (estTokens > TOKEN_BUDGET) {
  console.warn(
    `[replit.md size] ADVISORY: ${chars} chars ≈ ${estTokens} est-tokens — OVER the ${TOKEN_BUDGET}-token budget (${pct}%).`,
  );
  console.warn(
    "[replit.md size] Consider a trim/demote pass: move safely-extractable detail into a focused docs/ file and leave an index+pointer. See replit.md → Maintenance for keep-vs-demote rules. (advisory only — not failing)",
  );
} else {
  console.log(
    `[replit.md size] OK: ${chars} chars ≈ ${estTokens} est-tokens — within the ${TOKEN_BUDGET}-token budget (${pct}%).`,
  );
}

process.exit(0);
