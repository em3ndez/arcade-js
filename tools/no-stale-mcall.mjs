// SPDX-License-Identifier: GPL-3.0-only
//
// The dissolve invariant, as a game-agnostic scan: no idiomatic routine may m.call() an address
// already decompiled in the same game. A stale m.call and a direct call are memory-equivalent, so
// the per-routine gate and its reviewer both pass one; only a cross-file scan catches it. A callee
// with no idiomatic file is a genuine oracle boundary and stays m.call.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ALLOWED, DEBT } from "./no-stale-mcall.config.mjs";

/** Addresses with a committed idiomatic file, identified by their equivalence gate. */
export function decompiledAddresses(idiomaticDir) {
  const testDir = join(idiomaticDir, "test");
  const out = new Set();
  if (!existsSync(testDir)) return out;
  for (const t of readdirSync(testDir)) {
    // The gate filename is the one unambiguous signal; scanning sources for an address
    // false-positives on prose naming an oracle-boundary callee.
    const m = t.match(/^equivalence-([0-9a-f]{4})\.test\.js$/);
    if (m) out.add(parseInt(m[1], 16));
  }
  return out;
}

/**
 * Every stale m.call in one game's idiomatic layer.
 *
 * `allow` maps a caller filename to targets it may legitimately keep as m.call: never-returning
 * boundaries whose tails cannot be dissolved, because the harness stubs them through the registry
 * and that only works via m.call.
 *
 * ★ REFUSES TO JUDGE rather than reporting clean: an empty decompiled set makes every m.call
 * invisible, so a layer with routines but no gates would score zero leaks and read as a pass --
 * this lint's own disease. It takes EVERY routine ahead of every gate, not merely some, so a
 * batch landing mid-flight does not trip it; a layer with no gate at all breaches R12 anyway.
 */
export function findStaleMcalls(idiomaticDir, allow = new Map()) {
  const decompiled = decompiledAddresses(idiomaticDir);
  const files = existsSync(idiomaticDir)
    ? readdirSync(idiomaticDir).filter((f) => f.endsWith(".js") && f !== "names.js")
    : [];
  if (files.length > 0 && decompiled.size === 0) {
    throw new Error(
      `${idiomaticDir}: ${files.length} idiomatic file(s) but no equivalence gate names an ` +
        "address, so no call can be recognised as stale. This is not a clean scan.",
    );
  }

  const leaks = [];
  for (const f of files) {
    const src = readFileSync(join(idiomaticDir, f), "utf8");
    // Resolve file-local `const NAME = 0x....;` aliases first: otherwise `m.call(ACTOR_UPDATE)`
    // is a const-alias evasion invisible to a scan matching only literal hex.
    const alias = new Map();
    for (const c of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*0x([0-9a-f]{2,4})\b/gi)) {
      alias.set(c[1], parseInt(c[2], 16));
    }
    for (const mm of src.matchAll(/m\.call\(\s*(0x[0-9a-f]{2,4}|[A-Za-z_$][\w$]*)/gi)) {
      const tok = mm[1];
      const addr = /^0x/i.test(tok) ? parseInt(tok, 16) : alias.get(tok);
      if (addr === undefined) continue; // unresolved identifier: cannot prove it targets a callee
      if (!decompiled.has(addr)) continue;
      if (allow.get(f)?.has(addr)) continue;
      leaks.push({ file: f, addr, via: /^0x/i.test(tok) ? "" : ` (via const ${tok})` });
    }
  }
  return { leaks, files, decompiled };
}

/** One line per leak, for an assertion message. */
export function formatLeaks(leaks) {
  return leaks.map((l) => `${l.file} -> 0x${l.addr.toString(16)}${l.via}`).join("\n  ");
}

/** Every game with an idiomatic layer, discovered rather than listed. */
export function gamesWithIdiomaticLayer(gamesDir) {
  return readdirSync(gamesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(gamesDir, d.name, "idiomatic")))
    .map((d) => d.name)
    .sort();
}

/** `{file: [addrs]}` -> `Map<file, Set<addr>>`, the shape findStaleMcalls wants. */
export function toAllowMap(spec = {}) {
  return new Map(Object.entries(spec).map(([f, addrs]) => [f, new Set(addrs)]));
}

// ── running this file as a command ──────────────────────────────────────────────────────
//
// ★ WITHOUT THIS BLOCK, `node tools/no-stale-mcall.mjs` EXITED 0 ON ANY TREE. The file was
// exports only, so running it proved that it parses and nothing else -- and a command that
// returns success for every input gets quoted as evidence by whoever has not been caught by it
// yet. It was cited as a passing check for a whole session while the real gate,
// tools/test/no-stale-mcall.test.js, was the thing catching leaks. The trap does not announce
// itself, so the fix is to make the command DO the scan and exit NON-ZERO when it finds one.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const games = join(dirname(fileURLToPath(import.meta.url)), "..", "games");
  const scanned = gamesWithIdiomaticLayer(games);
  // ★ REFUSE TO REPORT SUCCESS HAVING MEASURED NOTHING -- the same disease, one corner in. An
  // empty game list, or a game whose idiomatic/ holds no files, would otherwise print a clean
  // line and exit 0. The test carries these two assertions; without them the command is LAXER
  // than the gate it stands in for, which is how the original defect got here.
  if (!scanned.length) {
    console.error(`no game under ${games} has an idiomatic layer: nothing was scanned`);
    process.exit(2);
  }
  let fresh = 0;
  for (const game of scanned) {
    const { leaks, files } = findStaleMcalls(join(games, game, "idiomatic"), toAllowMap(ALLOWED[game]));
    if (!files.length) {
      console.error(`${game}: idiomatic/ holds no files, so this scan reached nothing`);
      process.exit(2);
    }
    const debt = toAllowMap(DEBT[game]);
    const now = leaks.filter((l) => !debt.get(l.file)?.has(l.addr));
    fresh += now.length;
    console.log(now.length
      ? `${game}: STALE m.call(s) beyond anything recorded:\n  ${formatLeaks(now)}`
      : `${game}: no new leaks${debt.size ? ` (${debt.size} caller(s) carry recorded debt)` : ""}`);
  }
  process.exit(fresh ? 1 : 0);
}
