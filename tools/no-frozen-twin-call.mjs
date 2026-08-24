// SPDX-License-Identifier: GPL-3.0-only
//
// The frozen-twin invariant: no idiomatic MODULE may import + call the frozen translated copy of a
// routine that already has an idiomatic override (a ROUTINES entry). Such a call runs the FROZEN
// routine in the live game, bypassing the override — so the routine "runs as translated" even though
// every gate reads it as decompiled. It is invisible to idiomatic_gate (a static import is not
// m.call / a register / raw hex) AND to no-stale-mcall (it is not an m.call). Only a cross-file scan
// of the translated/ imports catches it. (Recorded 2026-08-24: runActorGroupStateHandler imported the
// frozen loc_6505/6566/6666 though spawnActorGroupRecords et al. exist — the three ran frozen live.)
//
// Test files (equivalence-<addr>.test.js) import `loc_<addr> as oracle` from translated/ on purpose —
// that is the comparison oracle, not a live call — so ONLY module files (the idiomatic dir top level,
// never its test/ subdir) are scanned.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** ROUTINES map for a game, from its idiomatic/names.js — the set of addresses with an override. */
async function loadTwins(idiomaticDir) {
  const namesPath = join(idiomaticDir, "names.js");
  // An ABSENT names.js is the front-loaded RAM-naming state (no ROUTINES yet) — nothing overrides, so
  // an empty twin set is correct. A PRESENT names.js that fails to import is a broken index: let it
  // THROW (fail closed) rather than silently disable the gate for that game.
  if (!existsSync(namesPath)) return new Set();
  const mod = await import(pathToFileURL(namesPath).href);
  const R = mod.ROUTINES ?? {};
  return new Set(Object.keys(R).map((k) => Number(k)));
}

// Detection is scoped to STATIC `from "…/translated/loc_XXXX.js"` imports of the flat idiomatic dir
// (re-exports + renamed/namespace imports are caught — the anchor is the `from` path, not the clause).
// A dynamic `await import(…)` of a frozen twin is out of scope (the repo does not use one on a live path).
const IMPORT_RE = /from\s+["'][^"']*\/translated\/loc_([0-9a-fA-F]+)\.js["']/g;

/**
 * Scan one game's idiomatic module files for a frozen import whose address has an idiomatic twin.
 * Returns { files, leaks:[{file, addr}] }.
 */
export async function findFrozenTwinCalls(idiomaticDir) {
  const twins = await loadTwins(idiomaticDir);
  const files = readdirSync(idiomaticDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".js") && e.name !== "names.js")
    .map((e) => e.name);
  const leaks = [];
  for (const f of files) {
    const src = readFileSync(join(idiomaticDir, f), "utf8");
    for (const m of src.matchAll(IMPORT_RE)) {
      const addr = parseInt(m[1], 16);
      if (twins.has(addr)) leaks.push({ file: f, addr });
    }
  }
  return { files, leaks };
}

export function formatFrozenLeaks(leaks) {
  return leaks
    .map((l) => `${l.file} imports the FROZEN translated/loc_${l.addr.toString(16)}.js though 0x${l.addr.toString(16)} has an idiomatic override`)
    .join("\n  ");
}
