// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardHomeBay4Goal — memory-equivalent to the frozen oracle loc_1e7a (ROM 0x1E7A), the bay-4 home
 * goal handler and structural twin of the bay-2 handler. GATE: crafted-entry. The candidate dissolves
 * the reject tail into the input scan and the goal-sprite arm into armHomeGoalSprite, and keeps the
 * m.call into the still-translated award helper (0x2673) and the shared goal fill (0x1f1c). Covered:
 * gate-already-set early return; frog not-reached reject (scan locked identical); award with the
 * points key missed and matched (0x8120=0 so no caller-skip); a latched collision arming the sprite;
 * and player-2 routing. RAM compared, stack masked. Teeth: no-op, unmarked gate, mis-counted;
 * positive control the gate flips 0->1.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y } from "./_frogHop.js";
import { awardHomeBay4Goal as cand } from "../awardHomeBayGoal.js";
import { loc_1e7a as oracle } from "../../translated/loc_1e7a.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const GATE_P1 = 0x8261, GATE_P2 = 0x8266, COUNT_P1 = 0x825c;
const KEY = 0x8121, COLLISION = 0x8134, GUARD = 0x8120, PLAYER = 0x83fd, INPUT_GATE = 0x826c, PLAY = 0x83fe;

const base = (mem) => {
  mem[FROG_Y] = 0x20; mem[PLAYER] = 1; mem[GATE_P1] = 0; mem[GATE_P2] = 0;
  mem[KEY] = 0; mem[COLLISION] = 0; mem[GUARD] = 0; mem[INPUT_GATE] = 1; mem[PLAY] = 0;
};
const alreadyDone = () => craft((mem) => { base(mem); mem[GATE_P1] = 1; });
const reject = () => craft((mem) => { base(mem); mem[FROG_Y] = 0x40; });
const awardMiss = () => craft((mem) => { base(mem); });
const awardMatch = () => craft((mem) => { base(mem); mem[KEY] = 0x04; });
const collision = () => craft((mem) => { base(mem); mem[COLLISION] = 1; });
const player2 = () => craft((mem) => { base(mem); mem[PLAYER] = 2; });

test("EQUAL (crafted): awardHomeBay4Goal == oracle over every branch", { skip }, () => {
  for (const [name, mk] of [
    ["already-done", alreadyDone], ["reject", reject], ["award-miss", awardMiss],
    ["award-match", awardMatch], ["collision", collision], ["player2", player2],
  ]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = awardMiss(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[GATE_P1], 1, "positive control: award did not set the bay-4 gate");
  console.log("  EQUAL: done/reject/miss/match/collision/player2; bay-4 gate 0->1 non-vacuous");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const unmarked = (m) => { cand(m); m.mem8[GATE_P1] = 0; };
  const misCounted = (m) => { cand(m); m.mem8[COUNT_P1] = (m.mem8[COUNT_P1] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, awardMiss()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, unmarked, awardMiss()), "unmarked-gate twin escaped");
  assert.ok(ramDiff(oracle, misCounted, awardMiss()), "mis-counted twin escaped");
  console.log("  TEETH: no-op, unmarked-gate, mis-counted all caught");
});
