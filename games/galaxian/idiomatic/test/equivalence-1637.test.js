// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1637 — crafted-entry memory-equivalence vs the frozen per-tick handler.
 * It writes only work RAM (flag block, formation anchor, stage selector, command queue, request slots),
 * so ramDiff is the whole live-out (return-stack window masked). The seed arms the enable flag and sets
 * the countdown to 1 so the zero-tick body runs, seeds the selector low byte at 3, and posts a 2-count
 * request. Positive control: the handler disarms the enable, advances the selector 3->4, and drains the
 * request. Teeth: no-op, a stuck enable, and a corrupted selector each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { advanceStageAndReseedFormation as cand } from "../advanceStageAndReseedFormation.js";
import { loc_1637 as oracle } from "../../translated/loc_1637.js";

const ENABLE = 0x4222, COUNTDOWN = 0x4223, SELECTOR = 0x421b, REQUEST = 0x421e;
const SLOT1 = 0x4177, SLOT2 = 0x4178;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// Arm the enable, countdown=1 (fires the zero-tick body), selector low=3, request count=2; lay the ret.
const entry = () => craft((mem, mm) => {
  mem[ENABLE] = 1;
  mem[COUNTDOWN] = 1;
  mem[SELECTOR] = 3; mem[SELECTOR + 1] = 0;
  mem[REQUEST] = 2;
  mm.push16(0x9999);
});

test("EQUAL (crafted): loc_1637 == oracle on the zero-tick body", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "the per-tick handler diverged");
  // non-vacuous: the handler really disarms the enable, advances the selector, and drains the request.
  const a = entry(); oracle(a);
  assert.equal(a.mem8[ENABLE], 0, "positive control: enable not disarmed");
  assert.equal(a.mem8[SELECTOR], 4, "positive control: selector not advanced 3->4");
  assert.equal(a.mem8[SLOT1], 1, "positive control: first request slot not raised");
  assert.equal(a.mem8[SLOT2], 1, "positive control: second request slot not raised");
  assert.equal(a.mem8[REQUEST], 0, "positive control: request not drained");
  console.log("  EQUAL: loc_1637 == oracle; enable disarmed, selector 3->4, request drained");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const stuckEnable = (m) => { cand(m); m.mem8[ENABLE] = 1; };
  const wrongSelector = (m) => { cand(m); m.mem8[SELECTOR] = 0; };
  assert.ok(ramDiff(oracle, noOp, entry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, stuckEnable, entry()), "stuck-enable twin escaped");
  assert.ok(ramDiff(oracle, wrongSelector, entry()), "wrong-selector twin escaped");
  console.log("  TEETH: no-op, stuck-enable, wrong-selector all caught");
});
