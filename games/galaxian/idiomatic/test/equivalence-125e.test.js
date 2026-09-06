// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_125e — memory-equivalent to the frozen oracle at ROM 0x125e. It deactivates the object at IX and
 * raises a sound/score request: a band scan of the object's packed field (ix+7) either matches and
 * enqueues immediately (dissolved tail-jump into the command-queue writer), or exhausts, raising the
 * inhibit word (0x422b/0x422c), folding in a neighbour bonus when the active-neighbour count is two
 * (dissolved conditional call), recording it (0x422d), and enqueuing the folded request. Every effect is
 * work-RAM (object cells, the command queue, the status cells), so the live-out is RAM only. HL is
 * threaded into the enqueue as its restored pointer but is not consumed by the object-AI dispatch. The
 * seed arms a free queue slot so the enqueue is observable. Teeth exercise the match and exhaust paths.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_125e as cand } from "../loc_125e.js";
import { loc_125e as oracle } from "../../translated/loc_125e.js";

const IX = 0x42b0;          // object base (work RAM; ix, ix+0x20, ix+0x40 all in the dump)
const QUEUE_HEAD = 0x40a0;  // write-head index cell
const QUEUE_BASE = 0x4000;  // queue slot base
const HEAD = 0xc0;          // an armed, floor-valid head
const INHIBIT_LO = 0x422b;
const INHIBIT_HI = 0x422c;
const NEIGHBOR_COUNT = 0x422a;
const BONUS_CELL = 0x422d;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// Arm a free queue slot at the head so a successful enqueue writes observable bytes.
function armQueue(mem8) {
  mem8[QUEUE_HEAD] = HEAD;
  mem8[QUEUE_BASE + HEAD] = 0x80; // bit7 set = free
}

// obj+7 = 0x30 (< 0x50) matches the first band -> enqueue 0x03:0x04 immediately.
const matchEntry = () => craft((mem8, m) => {
  m.push16(0x9999); m.regs.ix = IX; armQueue(mem8);
  mem8[IX + 7] = 0x30;
});

// obj+7 = 0x80 (>= 0x70) exhausts; count == 2 with both neighbours inactive folds bonus 2->3.
const exhaustBonusEntry = () => craft((mem8, m) => {
  m.push16(0x9999); m.regs.ix = IX; armQueue(mem8);
  mem8[IX + 7] = 0x80;
  mem8[NEIGHBOR_COUNT] = 2;
  mem8[IX + 0x20] = 0x00; // look-ahead slots inactive (bit0 clear)
  mem8[IX + 0x40] = 0x00;
});

// Exhaust with count != 2 -> no bonus fold.
const exhaustNoBonusEntry = () => craft((mem8, m) => {
  m.push16(0x9999); m.regs.ix = IX; armQueue(mem8);
  mem8[IX + 7] = 0x80;
  mem8[NEIGHBOR_COUNT] = 5;
});

test("EQUAL (crafted): loc_125e == oracle on the match and exhaust paths (RAM)", { skip }, () => {
  for (const [name, e] of [["match", matchEntry], ["exhaust+bonus", exhaustBonusEntry], ["exhaust", exhaustNoBonusEntry]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_125e diverged on the ${name} path`);
  }
  // positive control: match path deactivates the object and enqueues 0x03:0x04.
  const mm = matchEntry(); mm.routines = STUBS; oracle(mm);
  assert.equal(mm.mem8[IX + 0], 0, "positive control: object deactivated");
  assert.equal(mm.mem8[IX + 1], 1, "positive control: (ix+1)=1");
  assert.equal(mm.mem8[QUEUE_BASE + HEAD], 0x03, "positive control: request hi byte enqueued");
  assert.equal(mm.mem8[QUEUE_BASE + HEAD + 1], 0x04, "positive control: request lo byte enqueued");
  // positive control: exhaust+bonus raises the inhibit word, folds 2->3, and enqueues 0x03:0x0a.
  const ex = exhaustBonusEntry(); ex.routines = STUBS; oracle(ex);
  assert.equal(ex.mem8[INHIBIT_LO], 0x01, "positive control: inhibit low byte");
  assert.equal(ex.mem8[INHIBIT_HI], 0xf0, "positive control: inhibit high byte");
  assert.equal(ex.mem8[BONUS_CELL], 3, "positive control: neighbour bonus folded 2->3");
  assert.equal(ex.mem8[QUEUE_BASE + HEAD + 1], (3 + 7) & 0xff, "positive control: folded request lo = bonus+param");
  console.log("  EQUAL: loc_125e == oracle (RAM), match + exhaust(+bonus) verified");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const deactOnly = (m) => { m.mem8[IX + 0] = 0; m.mem8[IX + 1] = 1; m.mem8[IX + 2] = 0; }; // no enqueue
  const wrongBonus = (m) => { cand(m); m.mem8[BONUS_CELL] = (m.mem8[BONUS_CELL] + 1) & 0xff; };
  const noInhibit = (m) => { cand(m); m.mem8[INHIBIT_LO] = 0; };
  assert.ok(ramDiff(oracle, noOp, matchEntry()), "the no-op twin escaped (match)");
  assert.ok(ramDiff(oracle, deactOnly, matchEntry()), "the deactivate-only twin escaped (match)");
  assert.ok(ramDiff(oracle, wrongBonus, exhaustBonusEntry()), "the wrong-bonus twin escaped (exhaust)");
  assert.ok(ramDiff(oracle, noInhibit, exhaustBonusEntry()), "the no-inhibit-word twin escaped (exhaust)");
  console.log("  TEETH: no-op, deactivate-only, wrong-bonus, no-inhibit-word all caught");
});
