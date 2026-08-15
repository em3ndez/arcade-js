// SPDX-License-Identifier: GPL-3.0-only
//
// The dissolve invariant, for EVERY game at once. No idiomatic routine may m.call() an address
// that is already decompiled in the same game: a stale m.call and a direct call are memory-
// equivalent, so the per-routine gate and its reviewer both pass one. Only a cross-file scan
// catches it.
//
// ★ THIS TEST DISCOVERS ITS OWN GAMES, and that is the point. The Pit has its own copy of this
// invariant, still live and still passing beside this one -- but it is scoped to its own
// directory, so for every OTHER game it had never run, and "never provoked" reads exactly like
// "passed". A guard covering only what someone remembered to wire is the defect it is meant to
// prevent, one level up. Adding a game to this repo now enrols it automatically.
//
// Per-game allowlists and recorded debt live in tools/no-stale-mcall.config.mjs, outside the game
// trees, so a finished port can be governed without its directory being touched. A game absent
// from that config is scanned strictly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findStaleMcalls, formatLeaks, gamesWithIdiomaticLayer, toAllowMap } from "../no-stale-mcall.mjs";
import { ALLOWED, DEBT } from "../no-stale-mcall.config.mjs";

const GAMES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "games");

test("every game is scanned, and the scan reaches files", () => {
  const games = gamesWithIdiomaticLayer(GAMES);
  assert.ok(games.length > 0, "no game has an idiomatic layer, so this guard measured nothing");
  for (const g of games) {
    const { files } = findStaleMcalls(join(GAMES, g, "idiomatic"));
    assert.ok(files.length > 0, `${g}: the scan inspected no files, which is not a pass`);
  }
  console.log(`  SCANNED: ${games.join(", ")}`);
});

for (const game of gamesWithIdiomaticLayer(GAMES)) {
  test(`${game}: no NEW idiomatic routine m.call()s an already-decompiled callee`, () => {
    const { leaks } = findStaleMcalls(join(GAMES, game, "idiomatic"), toAllowMap(ALLOWED[game]));
    const debt = toAllowMap(DEBT[game]);
    const fresh = leaks.filter((l) => !debt.get(l.file)?.has(l.addr));
    assert.equal(
      fresh.length,
      0,
      `${game}: stale m.call(s) to an already-decompiled callee, beyond anything recorded. ` +
        `Dissolve them to direct idiomatic calls:\n  ${formatLeaks(fresh)}`,
    );
    const carried = debt.size ? ` (${debt.size} caller(s) carry recorded debt, not counted)` : "";
    console.log(`  ${game}: no new leaks${carried}`);
  });
}

// The SPINE exemption, on synthetic fixtures so it does not ride real game state. A go-live spine
// layer names no gate legitimately; the exemption must stay NARROW and must not blind the leak scan.
function fixture(files, gates = []) {
  const root = mkdtempSync(join(tmpdir(), "stalemcall-"));
  const dir = join(root, "idiomatic");
  mkdirSync(dir);
  for (const [name, src] of Object.entries(files)) writeFileSync(join(dir, name), src);
  if (gates.length) {
    mkdirSync(join(dir, "test"));
    for (const a of gates) writeFileSync(join(dir, "test", `equivalence-${a}.test.js`), "");
  }
  return { dir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("SPINE: a spine-only layer names no decompiled address and is NOT refused", () => {
  const spine = new Set(["driveSpine.js"]);
  const { dir, cleanup } = fixture({ "driveSpine.js": "export function* driveSpine(m){ m.call(0x0d11); }" });
  try {
    const { leaks, files } = findStaleMcalls(dir, new Map(), spine);
    assert.deepEqual(leaks, [], "a spine call to an un-decompiled oracle boundary is not a leak");
    assert.equal(files.length, 1, "the spine file is still among the files scanned");
  } finally {
    cleanup();
  }
});

test("SPINE: a NON-spine file with no gate STILL refuses -- the exemption is narrow", () => {
  const spine = new Set(["driveSpine.js"]);
  const { dir, cleanup } = fixture({
    "driveSpine.js": "export function* driveSpine(){}",
    "someLeaf.js": "export function someLeaf(m){ m.call(0x1234); }",
  });
  try {
    assert.throws(() => findStaleMcalls(dir, new Map(), spine), /no equivalence gate/);
  } finally {
    cleanup();
  }
});

test("SPINE: a spine file's m.call to a DECOMPILED leaf is still caught", () => {
  const spine = new Set(["driveSpine.js"]);
  const { dir, cleanup } = fixture(
    { "driveSpine.js": "export function* driveSpine(m){ m.call(0x1234); }" },
    ["1234"],
  );
  try {
    const { leaks } = findStaleMcalls(dir, new Map(), spine);
    assert.equal(leaks.length, 1, "a spine's stale m.call to a decompiled leaf must be flagged");
    assert.equal(leaks[0].addr, 0x1234);
  } finally {
    cleanup();
  }
});

// A comma-separated `const A = 0x.., B = 0x..;` must resolve EVERY declarator, not just the first --
// a real leak (drainForeground's m.call to loc_0x223d via the 2nd declarator) hid behind this once.
test("a m.call via the 2nd alias of a comma-separated const is resolved, not missed", () => {
  const { dir, cleanup } = fixture(
    { "leaf.js": "const A = 0x07e6, B = 0x1234;\nexport function leaf(m){ m.call(A); m.call(B); }" },
    ["1234"], // 0x1234 is decompiled (has a gate); 0x07e6 is not
  );
  try {
    const { leaks } = findStaleMcalls(dir, new Map());
    assert.equal(leaks.length, 1, "the 2nd comma-declarator alias (B) must be resolved and its stale m.call flagged");
    assert.equal(leaks[0].addr, 0x1234, "B resolves to 0x1234");
    assert.match(leaks[0].via, /const B/, "the leak is attributed to the B alias");
  } finally {
    cleanup();
  }
});
