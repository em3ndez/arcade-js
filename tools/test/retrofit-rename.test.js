// SPDX-License-Identifier: GPL-3.0-only
/**
 * Positive control for renameFileText (tools/retrofit_rename.mjs, the understanding-pass name retrofit).
 * The translated-binding guard must: (1) leave a BARE translated import's body usages as loc_ (the
 * regression that renamed frozen-oracle usages into ReferenceErrors), (2) NOT block a legit idiomatic
 * rename that merely sits beside an `as oracle` translated import (the eq-test pattern), (3) still rename a
 * genuine idiomatic usage. Run: node --test tools/test/retrofit-rename.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renameFileText } from "../retrofit_rename.mjs";

test("a bare translated import's body usage is NOT renamed", () => {
  const src = `import { loc_771d } from "../translated/loc_771d.js";\nswitch (x) { case 0: return loc_771d(m); }`;
  const { text, subs } = renameFileText(src, [["771d", { name: "armObjectFromSpawnRing" }]]);
  assert.equal(subs, 0, "a bare translated import's usage must not be renamed");
  assert.ok(text.includes("return loc_771d(m)"), "body usage stayed loc_771d");
  assert.ok(!text.includes("armObjectFromSpawnRing"), "descriptive name never introduced");
});

test("an `as oracle` translated import does NOT block the idiomatic rename beside it", () => {
  const src =
    `import { loc_5733 as oracle } from "../../translated/loc_5733.js";\n` +
    `import { loc_5733 } from "../loc_5733.js";\n` +
    `loc_5733(m);`;
  const { text } = renameFileText(src, [["5733", { name: "spawnActorSlot" }]]);
  assert.ok(text.includes('translated/loc_5733.js"'), "the translated oracle import stayed loc_");
  assert.ok(text.includes("spawnActorSlot(m)"), "the idiomatic usage was renamed");
  assert.ok(text.includes('from "../spawnActorSlot.js"'), "the idiomatic import path was renamed");
});

test("a genuine idiomatic usage (no translated binding) IS renamed", () => {
  const src = `import { loc_3d8f } from "./loc_3d8f.js";\nloc_3d8f(m, rec);`;
  const { text, subs } = renameFileText(src, [["3d8f", { name: "stepObjectState10" }]]);
  assert.ok(subs >= 2, "path + usage renamed");
  assert.ok(text.includes("stepObjectState10(m, rec)"), "idiomatic usage renamed");
});
