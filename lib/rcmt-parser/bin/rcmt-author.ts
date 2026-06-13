#!/usr/bin/env tsx
/**
 * rcmt-author — standalone CLI for authoring .rcmt binary files.
 *
 * The reverse direction of rcmt-parse: takes a JSON array of
 * `{ nodeIndex, intentId?, phrase?, scale?, lwwStamp? }` records, computes
 * each slot's lattice position via `latticePosition()`, and emits a
 * concatenated 28-byte-per-record `.rcmt` binary.
 *
 * Usage:
 *   rcmt-author [--out <file.rcmt>] <input.json | ->
 *
 * Input:
 *   A JSON array of records. Only `nodeIndex` is required:
 *     [{ "nodeIndex": 0, "phrase": "the sky is blue" }, ...]
 *   - `intentId` defaults to the tier (1=Fact..5=Dream) implied by nodeIndex.
 *   - `scale` defaults to a value derived from `phrase` length (clamped).
 *   - `lwwStamp` defaults to the current time (ms since epoch).
 *
 * Output:
 *   --out <file.rcmt>  Write the binary to a file
 *   (default)          Write the binary to stdout
 *
 * Source argument:
 *   <input.json>  Path to a JSON file
 *   -             Read JSON from stdin
 *
 * Exit codes:
 *   0  Encoding succeeded
 *   1  Encoding failed or bad arguments
 *
 * Examples:
 *   rcmt-author --out corpus.rcmt slots.json
 *   echo '[{"nodeIndex":0,"phrase":"hello"}]' | rcmt-author - > corpus.rcmt
 */

import { readFileSync, writeFileSync } from "node:fs";
import { encodeRcmtFile, type AuthorInput } from "../src/author.js";

// ── Argument parsing ───────────────────────────────────────────────────────

const args = process.argv.slice(2);

let outPath: string | undefined;
let sourceArg: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case "--out":
      outPath = args[++i];
      if (outPath === undefined) die("--out requires a file path");
      break;
    case "--help": case "-h":
      printUsage();
      process.exit(0);
    default:
      if (arg.startsWith("-") && arg !== "-") {
        die(`Unknown flag: ${arg}. Run with --help for usage.`);
      }
      if (sourceArg !== undefined) {
        die(`Unexpected extra argument: ${arg}`);
      }
      sourceArg = arg;
  }
}

if (sourceArg === undefined) {
  printUsage();
  die("No source specified. Provide a JSON file path or - for stdin.");
}

// ── Read + parse JSON source ────────────────────────────────────────────────

let raw: string;
try {
  raw = readFileSync(sourceArg === "-" ? "/dev/stdin" : sourceArg, "utf8");
} catch (err: unknown) {
  die(`Cannot read source: ${(err as NodeJS.ErrnoException).message}`);
}

let inputs: AuthorInput[];
try {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    die("Input JSON must be an array of records.");
  }
  inputs = parsed as AuthorInput[];
} catch (err: unknown) {
  die(`Invalid JSON: ${(err as Error).message}`);
}

// ── Encode ─────────────────────────────────────────────────────────────────

let bytes: Uint8Array;
try {
  bytes = encodeRcmtFile(inputs);
} catch (err: unknown) {
  die(`Encoding failed: ${(err as Error).message}`);
}

// ── Write ──────────────────────────────────────────────────────────────────

if (outPath) {
  writeFileSync(outPath, bytes);
} else {
  process.stdout.write(bytes);
}

process.exit(0);

// ── Helpers ────────────────────────────────────────────────────────────────

function die(message: string): never {
  process.stderr.write(`rcmt-author: ${message}\n`);
  process.exit(1);
}

function printUsage(): void {
  process.stdout.write(`
rcmt-author — encode a .rcmt binary file from JSON

Usage:
  rcmt-author [--out <file.rcmt>] <input.json | ->

Input:
  A JSON array of records. Only "nodeIndex" is required:
    [{ "nodeIndex": 0, "phrase": "the sky is blue" }, ...]
  - "intentId" defaults to the tier (1=Fact..5=Dream) implied by nodeIndex.
  - "scale" defaults to a value derived from "phrase" length (clamped).
  - "lwwStamp" defaults to the current time (ms since epoch).

Output:
  --out <file.rcmt>  Write the binary to a file
  (default)          Write the binary to stdout

Source:
  <input.json>  Path to a JSON file
  -             Read JSON from stdin

Exit codes: 0 = success, 1 = error
`.trim() + "\n");
}
