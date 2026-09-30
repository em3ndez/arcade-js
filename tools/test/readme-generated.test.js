// SPDX-License-Identifier: GPL-3.0-only
//
// README.md's GENERATED blocks (the quoted glitterJewels.js listing, the game status table) must match
// what tools/gen_readme.mjs would write now: an edit to the quoted file, a manifest, the registry or a
// DONE.md that is not regenerated into the front page fails here. Fix: node tools/gen_readme.mjs --write
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO, render } from "../gen_readme.mjs";

const readme = readFileSync(join(REPO, "README.md"), "utf8");

test("README.md generated blocks are current", async () => {
  const { stale } = await render(readme);
  assert.deepEqual(stale, [], `README.md is stale in: ${stale.join(", ")} -- run node tools/gen_readme.mjs --write`);
});

test("both block kinds are present, so the check above is not vacuous", () => {
  assert.match(readme, /<!-- BEGIN GENERATED: listing games\/thepit\/idiomatic\/glitterJewels\.js -->/);
  assert.match(readme, /<!-- BEGIN GENERATED: game status -->/);
});

test("positive control: a one-line edit inside a generated block is reported stale", async () => {
  const tampered = readme.replace("export function glitterJewels(m) {", "export function glitterJewels(m) { // x");
  assert.notEqual(tampered, readme, "control edit did not apply -- the listing no longer holds that line");
  const { stale } = await render(tampered);
  assert.deepEqual(stale, ["listing games/thepit/idiomatic/glitterJewels.js"]);
});
