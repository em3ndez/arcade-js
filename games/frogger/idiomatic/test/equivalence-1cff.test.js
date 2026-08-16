// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectHomeBayGoalHandler — memory-equivalent to the frozen oracle loc_1cff, the frog-X home-bay
 * column dispatcher. Both sides keep the m.call into the still-translated handlers, so a correct
 * dispatch runs the identical handler; gates cleared and frog Y below 0x2a make each bay AWARD its
 * own gate/count/tiles and each gap HOLD, so a mis-dispatch shows in RAM. Teeth: always-reject and
 * wrong-bay twins; positive control the bay-2 gate flips 0->1.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_X, FROG_Y } from "./_frogHop.js";
import { selectHomeBayGoalHandler as cand } from "../selectHomeBayGoalHandler.js";
import { loc_1cff as oracle } from "../../translated/loc_1cff.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const GATES = [0x825e, 0x825f, 0x8260, 0x8261, 0x8262, 0x8263, 0x8264, 0x8265, 0x8266, 0x8267];
const BAY2_GATE_P1 = 0x825f;

// frog Y below 0x2a; guard/key/collision clear (no caller-skip); scan locked; attract; gates clear.
const at = (x) => craft((mem) => {
  mem[FROG_X] = x; mem[FROG_Y] = 0x20; mem[0x83fd] = 1;
  mem[0x8120] = 0; mem[0x8121] = 0; mem[0x8134] = 0; mem[0x826c] = 1; mem[0x83fe] = 0;
  for (const g of GATES) mem[g] = 0;
});

const CASES = [
  ["bay1", 0x18], ["bay2", 0x48], ["bay3", 0x78], ["bay4", 0xa8], ["bay5", 0xd8],
  ["gap-low", 0x00], ["gap-mid", 0x30], ["gap-high", 0xff],
];

test("EQUAL (crafted): selectHomeBayGoalHandler == oracle across bands + gaps", { skip }, () => {
  for (const [name, x] of CASES) {
    assert.equal(ramDiff(oracle, cand, at(x)), null, `dispatch for ${name} (x=0x${x.toString(16)}) diverged`);
  }
  const e = at(0x48); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[BAY2_GATE_P1], 1, "positive control: bay-2 award did not set its gate");
  console.log("  EQUAL: 5 bay bands + 3 gaps; bay-2 gate 0->1 confirms non-vacuous");
});

test("TEETH: mis-dispatch twins are caught", { skip }, () => {
  const alwaysReject = (m) => m.call(0x1d77);
  const wrongBay = (m) => m.call(0x1e7a);
  assert.ok(ramDiff(oracle, alwaysReject, at(0x48)), "always-reject twin escaped on a bay band");
  assert.ok(ramDiff(oracle, wrongBay, at(0x48)), "wrong-bay twin escaped (bay2 vs bay4)");
  console.log("  TEETH: always-reject + wrong-bay both caught");
});
