// SPDX-License-Identifier: GPL-3.0-only
/**
 * The generated static registry (translated/_registry.generated.js, which the web
 * player builds the dispatch table from) must stay in sync with the translated/
 * directory. If a translated routine is added or removed without regenerating, the
 * browser would dispatch through a stale table. This re-runs the fs discovery and
 * asserts it matches the generated entries exactly — so staleness fails a test, loudly,
 * with the command to fix it.
 *
 * Run: node --test games/timeplt/test/registry-sync.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { discover } from "../../../tools/gen-registry.mjs";
import { ROUTINE_ENTRIES } from "../translated/_registry.generated.js";

const hx = (a) => "0x" + a.toString(16).padStart(4, "0");

test("generated registry matches translated/ (fix: node tools/gen-registry.mjs timeplt)", async () => {
  const perFile = await discover("timeplt");
  const expected = new Map();
  for (const { names } of perFile) {
    for (const n of names) expected.set(parseInt(n.slice(4), 16), n);
  }
  const actual = new Map(ROUTINE_ENTRIES);

  const missing = [...expected.keys()].filter((a) => !actual.has(a)).sort((a, b) => a - b);
  assert.equal(
    missing.length, 0,
    `generated registry is STALE — missing ${missing.map(hx).join(", ")}. Run: node tools/gen-registry.mjs timeplt`,
  );

  const extra = [...actual.keys()].filter((a) => !expected.has(a)).sort((a, b) => a - b);
  assert.equal(
    extra.length, 0,
    `generated registry has routines no longer in translated/: ${extra.map(hx).join(", ")}. Run: node tools/gen-registry.mjs timeplt`,
  );

  assert.equal(actual.size, expected.size, "registry size mismatch");
  assert.equal(ROUTINE_ENTRIES.length, actual.size, "duplicate address in ROUTINE_ENTRIES");
  assert.ok(actual.has(0x0000), "reset vector 0x0000 present");
  assert.ok(actual.has(0x0066), "NMI vector 0x0066 present");
  for (const [addr, fn] of actual) {
    assert.equal(typeof fn, "function", `${hx(addr)} is not a function`);
    // Each address must bind ITS OWN routine, not just some function — otherwise a
    // value-swap (right key, wrong fn) would slip through. The oracle exports are all
    // `loc_<addr>`, so the bound function's name must equal the discovered name.
    assert.equal(
      fn.name, expected.get(addr),
      `${hx(addr)} binds ${fn.name}, expected ${expected.get(addr)} — a value-swap in the generated registry`,
    );
  }
});
