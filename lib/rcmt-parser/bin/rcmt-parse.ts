#!/usr/bin/env tsx
/**
 * rcmt-parse — standalone CLI for decoding .rcmt binary files.
 *
 * Usage:
 *   rcmt-parse [--json | --ts | --py | --summary | --svg | --bin] [--relations] <file.rcmt | ->
 *
 * Format flags (mutually exclusive, default: --summary):
 *   --json      Emit structured JSON
 *   --ts        Emit TypeScript export block
 *   --py        Emit Python assignment block
 *   --summary   Emit human-readable summary (default)
 *   --svg       Emit an SVG render of the lattice (top-down projection)
 *   --bin       Re-emit a raw CRVM binary stream (occupied slots only)
 *
 * Modifier flags:
 *   --relations  Include angular-relation graph (only meaningful with --json)
 *
 * Source argument:
 *   <file.rcmt>  Path to a .rcmt binary file
 *   -            Read from stdin
 *
 * Exit codes:
 *   0  Parse succeeded
 *   1  Parse failed or bad arguments
 *
 * Examples:
 *   rcmt-parse corpus.rcmt
 *   rcmt-parse --json --relations corpus.rcmt
 *   cat corpus.rcmt | rcmt-parse --ts -
 *   rcmt-parse --svg corpus.rcmt > corpus.svg
 */

import { readFileSync } from "node:fs";
import { parse, toJSON, toTypeScript, toPython, toSummary, toSVG, toBinary } from "../src/index.js";

// ── Argument parsing ───────────────────────────────────────────────────────

const args = process.argv.slice(2);

type Format = "json" | "ts" | "py" | "summary" | "svg" | "bin";

let format: Format = "summary";
let includeRelations = false;
let sourceArg: string | undefined;

for (const arg of args) {
  switch (arg) {
    case "--json":    format = "json";    break;
    case "--ts":      format = "ts";      break;
    case "--py":      format = "py";      break;
    case "--summary": format = "summary"; break;
    case "--svg":     format = "svg";     break;
    case "--bin":     format = "bin";     break;
    case "--relations": includeRelations = true; break;
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
  die("No source specified. Provide a .rcmt file path or - for stdin.");
}

// ── Read source ────────────────────────────────────────────────────────────

let rawBytes: Buffer;
try {
  if (sourceArg === "-") {
    rawBytes = readFileSync("/dev/stdin");
  } else {
    rawBytes = readFileSync(sourceArg);
  }
} catch (err: unknown) {
  die(`Cannot read source: ${(err as NodeJS.ErrnoException).message}`);
}

// Buffer → ArrayBuffer (zero-copy slice)
const buf: ArrayBuffer = rawBytes.buffer.slice(
  rawBytes.byteOffset,
  rawBytes.byteOffset + rawBytes.byteLength,
) as ArrayBuffer;

// ── Parse ──────────────────────────────────────────────────────────────────

const result = parse(buf);

if ("ok" in result && result.ok === false) {
  die(`Parse failed: ${result.message}`);
}

// ── Emit ───────────────────────────────────────────────────────────────────

switch (format) {
  case "json":
    process.stdout.write(toJSON(result, includeRelations) + "\n");
    break;
  case "ts":
    process.stdout.write(toTypeScript(result) + "\n");
    break;
  case "py":
    process.stdout.write(toPython(result) + "\n");
    break;
  case "summary":
    process.stdout.write(toSummary(result) + "\n");
    break;
  case "svg":
    process.stdout.write(toSVG(result) + "\n");
    break;
  case "bin":
    process.stdout.write(toBinary(result));
    break;
}

process.exit(0);

// ── Helpers ────────────────────────────────────────────────────────────────

function die(message: string): never {
  process.stderr.write(`rcmt-parse: ${message}\n`);
  process.exit(1);
}

function printUsage(): void {
  process.stdout.write(`
rcmt-parse — decode a .rcmt binary file

Usage:
  rcmt-parse [--json | --ts | --py | --summary | --svg | --bin] [--relations] <file.rcmt | ->

Format flags (default: --summary):
  --json      Structured JSON
  --ts        TypeScript export block
  --py        Python assignment block
  --summary   Human-readable summary
  --svg       SVG render of the lattice (top-down projection)
  --bin       Raw CRVM binary stream (occupied slots only)

Modifier flags:
  --relations  Include angular-relation graph (meaningful with --json)

Source:
  <file.rcmt>  Path to a .rcmt binary file
  -            Read from stdin

Exit codes: 0 = success, 1 = error
`.trim() + "\n");
}
