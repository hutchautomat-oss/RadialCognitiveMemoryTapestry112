#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Advisory only: nudges a trim pass if replit.md (always-loaded) outgrows its
# token budget. The script always exits 0; the `|| true` is belt-and-suspenders
# so a future change can never let this fail a merge under `set -e`.
pnpm --filter @workspace/scripts run check-replit-md || true
