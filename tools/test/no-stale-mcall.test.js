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
