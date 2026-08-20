// SPDX-License-Identifier: GPL-3.0-only
//
// The wiring invariant, for EVERY game at once. A decompile unit is not done when the module and
// its gate are green; it is done when the routine is DISPATCHED. The dispatch map is built by
// walking ROUTINES, so an unwired module is not overridden and every dispatch to its address runs
// the frozen oracle -- the rewrite is reached only by a sibling importing it directly, and for
// many by nothing but their own gate. Per-routine gates cannot see it: a gate imports its module
// rather than dispatching to it, so it passes either way.
//
// ★ READ ENTIRELY FROM THE INDEX -- modules, their text, and the registry -- so every check speaks
// about the same revision. A module still being written trips nothing; a STAGED one trips at once;
// a registry entry staged without its module trips too. Untracked modules are reported so a
// forming debt is visible, never failed on.
//
// ★ THIS TEST DISCOVERS ITS OWN GAMES, for the reason the dissolve invariant beside it does: a
// guard covering only what someone remembered to wire is the defect it is meant to prevent, one
// level up. It also refuses to report a clean scan when it inspected nothing.
//
// ★ COVERAGE IS NOT EXECUTION. This says every module is wired; it does not say the layer RUNS. A
// game can be fully wired and still switched off at `manifest.runtime`, which is where Time Pilot
// actually sat while its registry was clean.
//
// Per-game decisions and recorded debt live in tools/registry-coverage.config.mjs, outside the
// game trees. A game absent from that config is scanned strictly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findWiringGaps, loadRoutinesFromIndex, runtimeFromIndex, untrackedModules } from "../registry-coverage.mjs";
// One definition of "a game with an idiomatic layer", shared with the dissolve invariant.
import { gamesWithIdiomaticLayer } from "../no-stale-mcall.mjs";
import { UNWIRED, DEBT } from "../registry-coverage.config.mjs";

const GAMES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "games");

test("every game is scanned, and the scan reaches tracked modules", async () => {
  const games = gamesWithIdiomaticLayer(GAMES);
  assert.ok(games.length > 0, "no game has an idiomatic layer, so this guard measured nothing");
  let total = 0;
  for (const g of games) {
    const dir = join(GAMES, g, "idiomatic");
    const routines = await loadRoutinesFromIndex(dir);
    if (routines === null) {
      console.log(`  ${g}: no registry in the index yet, so there is nothing to check`);
      continue;
    }
    // A registry with named cells but NO ROUTINES entries yet is the front-loaded RAM-naming
    // state -- the understanding pass that names memory before any routine is decompiled. There is
    // no module to dispatch, so nothing to scan; this is coherent, not the scan going blind. (An
    // empty registry that ALSO has idiomatic module files is still caught: the per-game DISPATCHED
    // test below flags every undispatched module.)
    if (Object.keys(routines).length === 0) {
      console.log(`  ${g}: registry present but no routine entries yet (RAM-naming only), nothing to scan`);
      continue;
    }
    const { modules, support, unclassified } = findWiringGaps(dir, routines);
    total += modules.length;
    const cannot = unclassified.length ? `, EXPORT SHAPE UNREAD: ${unclassified.join(", ")}` : "";
    // A registry IN the index with no module in the index is incoherent, so a zero there is the
    // scan going blind rather than a game that has not landed yet.
    assert.ok(modules.length > 0, `${g}: its registry is tracked but the scan found no tracked module`);
    console.log(
      `  ${g}: ${modules.length} tracked module(s) in scope, support: ${support.join(", ") || "none"}${cannot}`,
    );
  }
  assert.ok(total > 0, "no game has a tracked idiomatic module, so this guard measured nothing");
});

for (const game of gamesWithIdiomaticLayer(GAMES)) {
  test(`${game}: every idiomatic module in the repository is DISPATCHED, or exempt with a reason`, async () => {
    const dir = join(GAMES, game, "idiomatic");
    const routines = await loadRoutinesFromIndex(dir);
    if (routines === null) return;
    const { unwired, unresolvable, unclassified } = findWiringGaps(dir, routines);

    // First, because the other two lists are only trustworthy once every module is on one of them.
    assert.equal(
      unclassified.length,
      0,
      `${game}: idiomatic module(s) whose export shape this scan cannot read, so it cannot say ` +
        `whether an entry could dispatch them -- and the resolver, which takes any export, may ` +
        `well reach them. Counting them as support would exempt them in silence. Use a plain ` +
        `export declaration, or teach tools/registry-coverage.mjs the shape:\n  ` +
        unclassified.join("\n  "),
    );

    const exempt = UNWIRED[game] ?? {};
    for (const [file, reason] of Object.entries(exempt)) {
      assert.ok(
        typeof reason === "string" && reason.trim().length > 0,
        `${game}: ${file} is listed UNWIRED with no reason, which is the silence this guard exists to break`,
      );
    }
    const debt = new Set(DEBT[game] ?? []);
    const fresh = unwired.filter((f) => !(f in exempt) && !debt.has(f));

    assert.equal(
      fresh.length,
      0,
      `${game}: idiomatic module(s) NO ROUTINES ENTRY NAMES, so nothing dispatches them and every ` +
        `dispatch to their address runs the oracle instead, however green their gates are. Add the ` +
        `address -> {name} entry, or record it in tools/registry-coverage.config.mjs -- UNWIRED ` +
        `with a reason, or DEBT:\n  ` + fresh.join("\n  "),
    );
    assert.equal(
      unresolvable.length,
      0,
      `${game}: ROUTINES entr(ies) the resolver cannot resolve, so building the dispatch map ` +
        `throws for this whole game:\n  ` + unresolvable.join("\n  "),
    );

    // Not a failure -- untracked work is not yet a claim about the repository -- but it is what
    // this test will say the moment those modules are staged, so say it now.
    const wired = new Set(Object.values(routines).map((r) => `${r.name}.js`));
    const coming = untrackedModules(dir).filter((f) => !wired.has(f) && !(f in exempt));
    const held = unwired.length - fresh.length;
    // The runtime rides on the verdict line deliberately: this is the line that reads as "all
    // good", and it is where "wired, but the player never runs it" has to be visible.
    const runtime = await runtimeFromIndex(join(GAMES, game));
    const live = runtime === "idiomatic" ? "" : " -- so the player runs no idiomatic module";
    console.log(
      `  ${game}: every tracked module dispatched${held ? ` (${held} held by config)` : ""}` +
        `; runtime: ${runtime ?? "unset"}${live}` +
        (coming.length ? `; ${coming.length} untracked module(s) will fail this on staging` : ""),
    );
  });
}
