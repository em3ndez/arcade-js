// SPDX-License-Identifier: GPL-3.0-only
/**
 * DISTANT-TAPE BUDGET, MAME-free. A tape's `distant_budget_px` (countdown-slot sets one) tightens the
 * distant-state window and the band in tools/distant_suite.py -- but only where MAME is installed,
 * and a dropped budget falls back to the default silently: the tape keeps passing with no teeth.
 * test/distant_budget_check.py drives the REAL distant_gate, and the REAL main() from its command
 * line, on synthetic dumps (see its docstring) and asserts the verdicts: the committed countdown-slot tape FAILS a 40px distant divergence on
 * both the distant window and the band, with 16 as the budget each verdict received; the same tape
 * with the key removed PASSES it under the default; identical frames PASS under 16.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { GAME_DIR } from "../tools/render-lib.js";

test("distant_budget_px reaches the distant-state and band verdicts (and its absence means the default)", () => {
  const r = spawnSync("python3", [join(GAME_DIR, "test", "distant_budget_check.py")], { encoding: "utf8" });
  assert.equal(r.status, 0, `distant_budget_check.py failed:\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /^distant_budget_check: PASS$/m);
});
