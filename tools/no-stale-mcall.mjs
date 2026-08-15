// SPDX-License-Identifier: GPL-3.0-only
// The dissolve invariant, game-agnostic: no idiomatic routine may m.call() an address already
// decompiled in the same game -- a stale m.call is memory-equivalent to a direct call, so only a
// cross-file scan catches it. A callee with no idiomatic file is a genuine oracle boundary.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ALLOWED, DEBT, SPINE } from "./no-stale-mcall.config.mjs";

/** Addresses with a committed idiomatic file, identified by their equivalence gate. */
export function decompiledAddresses(idiomaticDir) {
  const testDir = join(idiomaticDir, "test");
  const out = new Set();
  if (!existsSync(testDir)) return out;
  for (const t of readdirSync(testDir)) {
    // The gate filename is the one unambiguous signal; source prose false-positives on boundaries.
    const m = t.match(/^equivalence-([0-9a-f]{4})\.test\.js$/);
    if (m) out.add(parseInt(m[1], 16));
  }
  return out;
}

/**
 * Every stale m.call in one game's idiomatic layer. `allow` maps a caller file to m.call targets it
 * may keep (never-returning boundaries the harness stubs through the registry, which needs m.call).
 * REFUSES to score ungated files against an empty decompiled set -- that reads clean while seeing
 * nothing. The lone legit exception is the go-live foundation, whose only files are the coroutine
 * SPINE (no equivalence gate by design): excused from seeding the set, still scanned, so a spine
 * m.call to a later-decompiled leaf is still caught. `spine` overrides the config, for the selftest.
 */
export function findStaleMcalls(idiomaticDir, allow = new Map(), spine = null) {
  const decompiled = decompiledAddresses(idiomaticDir);
  const files = existsSync(idiomaticDir)
    ? readdirSync(idiomaticDir).filter((f) => f.endsWith(".js") && f !== "names.js")
    : [];
  const spineFiles = spine ?? new Set(SPINE[basename(dirname(idiomaticDir))] ?? []);
  const ungated = files.filter((f) => !spineFiles.has(f));
  if (ungated.length > 0 && decompiled.size === 0) {
    throw new Error(
      `${idiomaticDir}: ${ungated.length} non-spine idiomatic file(s) but no equivalence gate ` +
        "names an address, so no call can be recognised as stale. This is not a clean scan.",
    );
  }

  const leaks = [];
  for (const f of files) {
    const src = readFileSync(join(idiomaticDir, f), "utf8");
    // Resolve file-local `const NAME = 0x..;` aliases: m.call(NAME) else evades a literal-hex scan.
    // The leading `,` branch catches every declarator of a comma-separated `const A = 0x.., B = 0x..;`
    // (a `\bconst` anchor alone captured only the first, silently missing the rest).
    const alias = new Map();
    for (const c of src.matchAll(/(?:\bconst\s+|,\s*)([A-Za-z_$][\w$]*)\s*=\s*0x([0-9a-f]{2,4})\b/gi)) {
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

// Run as a command: DO the scan and exit non-zero. Without this the file was exports only, so
// `node <this>` exited 0 on any tree -- a check that always passes gets quoted as evidence.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const games = join(dirname(fileURLToPath(import.meta.url)), "..", "games");
  const scanned = gamesWithIdiomaticLayer(games);
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
