// SPDX-License-Identifier: GPL-3.0-only
//
// Guards the frozen-twin invariant for EVERY game at once: an idiomatic module that imports the
// frozen translated copy of a routine which already has an idiomatic override runs the frozen code
// live, bypassing the override — invisible to idiomatic_gate and no-stale-mcall alike. See
// tools/no-frozen-twin-call.mjs. Games are discovered, not enumerated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findFrozenTwinCalls, formatFrozenLeaks } from "../no-frozen-twin-call.mjs";
import { gamesWithIdiomaticLayer } from "../no-stale-mcall.mjs";
import { ALLOWED, DEBT, toAllowMap } from "../no-frozen-twin-call.config.mjs";

const GAMES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "games");

test("every game is scanned, and the scan reaches files", async () => {
  const games = gamesWithIdiomaticLayer(GAMES);
  assert.ok(games.length > 0, "no game has an idiomatic layer, so this guard measured nothing");
  let total = 0;
  for (const g of games) {
    const { files } = await findFrozenTwinCalls(join(GAMES, g, "idiomatic"));
    total += files.length;
  }
  assert.ok(total > 0, "no game had an idiomatic module file, so this guard measured nothing");
  console.log(`  SCANNED: ${games.join(", ")}`);
});

for (const game of gamesWithIdiomaticLayer(GAMES)) {
  test(`${game}: no idiomatic module imports+calls a frozen routine that has an idiomatic twin`, async () => {
    const { leaks } = await findFrozenTwinCalls(join(GAMES, game, "idiomatic"));
    const allowed = toAllowMap(ALLOWED[game]);
    const debt = toAllowMap(DEBT[game]);
    const fresh = leaks.filter(
      (l) => !allowed.get(l.file)?.has(l.addr) && !debt.get(l.file)?.has(l.addr),
    );
    assert.equal(
      fresh.length,
      0,
      `${game}: idiomatic module(s) call the FROZEN copy of a decompiled routine, so it runs ` +
        `translated in the live game, beyond anything recorded. Re-point the import + call to the ` +
        `idiomatic twin:\n  ` + formatFrozenLeaks(fresh),
    );
    const held = allowed.size || debt.size ? ` (${allowed.size + debt.size} file(s) hold recorded allowance)` : "";
    console.log(`  ${game}: no fresh frozen-twin calls${held}`);
  });
}

// -- Null-mutant + negative control on synthetic fixtures ---------------------

function fixture(namesSrc, files) {
  const root = mkdtempSync(join(tmpdir(), "frozentwin-"));
  const dir = join(root, "idiomatic");
  mkdirSync(dir);
  writeFileSync(join(dir, "names.js"), namesSrc);
  for (const [name, src] of Object.entries(files)) writeFileSync(join(dir, name), src);
  return { dir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const NAMES = "export const ROUTINES = { 0x6505: { name: 'spawnActorGroupRecords', cert: 'code' } };\n";

test("NULL-MUTANT: a module importing the frozen twin of an overridden address is CAUGHT", async () => {
  const { dir, cleanup } = fixture(NAMES, {
    "runActorGroupStateHandler.js":
      "import { loc_6505 } from '../translated/loc_6505.js';\nexport function h(m){ return loc_6505(m); }\n",
  });
  try {
    const { leaks } = await findFrozenTwinCalls(dir);
    assert.equal(leaks.length, 1, "a frozen import of an overridden address must be flagged");
    assert.equal(leaks[0].addr, 0x6505);
  } finally {
    cleanup();
  }
});

test("NEGATIVE: importing a frozen routine with NO override is allowed (generator fallback)", async () => {
  const { dir, cleanup } = fixture(NAMES, {
    "leaf.js": "import { loc_9999 } from '../translated/loc_9999.js';\nexport function leaf(m){ return loc_9999(m); }\n",
  });
  try {
    const { leaks } = await findFrozenTwinCalls(dir);
    assert.deepEqual(leaks, [], "a frozen call to an un-decompiled callee is the legitimate fallback");
  } finally {
    cleanup();
  }
});

test("FAIL-CLOSED: a present-but-broken names.js throws, it never passes vacuously", async () => {
  const { dir, cleanup } = fixture("this is not valid javascript {{{\n", {
    "m.js": "import { loc_6505 } from '../translated/loc_6505.js';\nexport function m(x){ return loc_6505(x); }\n",
  });
  try {
    await assert.rejects(
      () => findFrozenTwinCalls(dir),
      "a present names.js that fails to import must fail RED, not silently disable the gate",
    );
  } finally {
    cleanup();
  }
});

test("NEGATIVE: a test/ oracle import is NOT scanned (that is the comparison oracle)", async () => {
  const { dir, cleanup } = fixture(NAMES, {});
  mkdirSync(join(dir, "test"));
  writeFileSync(
    join(dir, "test", "equivalence-6505.test.js"),
    "import { loc_6505 as oracle } from '../../translated/loc_6505.js';\n",
  );
  try {
    const { leaks } = await findFrozenTwinCalls(dir);
    assert.deepEqual(leaks, [], "test-file oracle imports are legitimate and must not be flagged");
  } finally {
    cleanup();
  }
});
