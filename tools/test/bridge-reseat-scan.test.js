// SPDX-License-Identifier: GPL-3.0-only
/**
 * Standing test for the register-bridge re-seat CORPUS SCAN driver (tools/bridge_reseat_scan.mjs, R37).
 *
 * The primitive's own null-mutant (games/pooyan/idiomatic/test/bridge-reseat-tooth.test.js) proves the
 * TOOTH discriminates a missing re-seat. This proves the DRIVER around it: it enumerates the bridge corpus,
 * reaches routines under its scenarios, and its capture->tooth->report path REPORTS >0 on a known defect
 * (a scan that can never report a hit is worthless). ROM-guarded (skips without the BYO ROM).
 *
 * Run: node --test tools/test/bridge-reseat-scan.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scan } from "../bridge_reseat_scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HAVE_ROM = existsSync(join(HERE, "..", "..", "games/pooyan/rom/maincpu.bin"));

test("the corpus scan enumerates the bridge set and reaches routines under its scenarios", { skip: !HAVE_ROM }, async () => {
  const r = await scan("pooyan", { quiet: true });
  assert.ok(r.enumerated > 100, `enumerated only ${r.enumerated} bridge routines`);
  assert.ok(r.reached > 0, "reached 0 bridge routines — the capture path is dead");
  assert.ok(r.reached <= r.enumerated, "reached more than enumerated (impossible)");
  assert.ok(r.notReached.length > 0, "every routine reached — the coverage report can no longer surface a gap");
});

test("SELFCHECK: the driver flags an injected missing-re-seat mutant (it CAN report >0)", { skip: !HAVE_ROM }, async () => {
  const r = await scan("pooyan", { quiet: true, selfcheck: true });
  const caught = r.hits.some((h) => h.addr === 0x5733);
  assert.ok(caught, "the driver did NOT flag the injected loc_5733 missing-re-seat mutant — the report path is blind");
});
