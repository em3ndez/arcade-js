// SPDX-License-Identifier: GPL-3.0-only
/**
 * initNewGameScoreAndTimers — memory-equivalent to the frozen oracle at ROM 0x0B0A.
 * GATE: crafted-entry. Attract never runs the new-game start reset (it is reached only through the
 * new-game setup path), so a post-boot attract machine is cloned and poked into a realistic entry:
 * the four cleared words seeded non-zero to prove they are zeroed, and the start-time byte set to a
 * known value to prove it is copied into both time-remaining bytes. The routine reads its input from
 * memory and its live-out is memory-only, so RAM is compared and registers/SP are not; the compared
 * RAM excludes the dead [SP-8, SP) window (this routine pushes nothing, but the oracle's trailing
 * return pops the seat, so the mask keeps the two sides on the same footing).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { initNewGameScoreAndTimers } from "../initNewGameScoreAndTimers.js";
import { loc_0b0a as oracle } from "../../translated/loc_0b0a.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const START_TIME = 0x83e4;
const TIME_P1 = 0x83e5;
const TIME_P2 = 0x83e6;
const EXTRA_LIFE = 0x83e7; // word 0x83e7/0x83e8
const SCORE_P2 = 0x83eb; // word 0x83eb/0x83ec
const HIGH_SCORE = 0x83ed; // word 0x83ed/0x83ee
const CLEARED = [0x83e7, 0x83e8, 0x83eb, 0x83ec, 0x83ed, 0x83ee];
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with the reset targets dirtied and the start-time set, so a correct run leaves
// an observable effect on every cell it touches.
function craft(startTime) {
  const e = seedMachine().clone();
  for (const a of CLEARED) e.mem8[a] = 0xff;
  e.mem8[TIME_P1] = 0x11;
  e.mem8[TIME_P2] = 0x22;
  e.mem8[START_TIME] = startTime;
  return e;
}

// null == RAM-equivalent, excluding the dead [SP-8, SP) window. Memory-only: compare RAM, not regs/SP.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let k = 1; k <= 8; k++) {
    const addr = (sp - k) & 0xffff;
    if (addr >= 0x8000 && addr <= 0x87ff) { const o = addr - 0x8000; da[o] = 0; db[o] = 0; }
  }
  const d = firstStateDiff(da, db, (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {}
// wrong count: forgets to clear the extra-life-flag word.
function brokenSkipExtraLife(m) {
  const { mem8, mem16 } = m;
  mem16[HIGH_SCORE] = 0;
  mem16[SCORE_P2] = 0;
  const t = mem8[START_TIME];
  mem16[TIME_P1] = (t << 8) | t;
}
// dropped low-byte copy: seeds only the P2 time byte (mirrors the oracle test's dropped `ld l,a`).
function brokenHalfSeed(m) {
  const { mem8, mem16 } = m;
  mem16[HIGH_SCORE] = 0;
  mem16[SCORE_P2] = 0;
  mem16[EXTRA_LIFE] = 0;
  const t = mem8[START_TIME];
  mem8[TIME_P2] = t; // BUG: 0x83e5 (P1) left dirty
}
// wrong source: seeds the time bytes with a constant instead of the start-time byte.
function brokenConstSeed(m) {
  const { mem16 } = m;
  mem16[HIGH_SCORE] = 0;
  mem16[SCORE_P2] = 0;
  mem16[EXTRA_LIFE] = 0;
  mem16[TIME_P1] = 0x0000; // BUG: ignores 0x83e4
}
// wrong address: clears 0x83e9 instead of the extra-life word at 0x83e7.
function brokenWrongAddr(m) {
  const { mem8, mem16 } = m;
  mem16[HIGH_SCORE] = 0;
  mem16[SCORE_P2] = 0;
  mem16[0x83e9] = 0; // BUG: wrong cell
  const t = mem8[START_TIME];
  mem16[TIME_P1] = (t << 8) | t;
}

test("EQUAL (crafted): initNewGameScoreAndTimers == oracle across start-time values", { skip }, () => {
  for (const t of [0x42, 0x00, 0x99]) {
    assert.equal(ramDiff(initNewGameScoreAndTimers, craft(t)), null, `diverged for start-time 0x${t.toString(16)}`);
  }
  console.log("  EQUAL: initNewGameScoreAndTimers == oracle for start-times 0x42/0x00/0x99");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = craft(0x42);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenSkipExtraLife, e), "the skip-extra-life twin escaped");
  assert.ok(ramDiff(brokenHalfSeed, e), "the half-seed twin escaped");
  assert.ok(ramDiff(brokenConstSeed, e), "the const-seed twin escaped");
  assert.ok(ramDiff(brokenWrongAddr, e), "the wrong-address twin escaped");
  console.log("  TEETH: no-op, skip-extra-life, half-seed, const-seed, wrong-address all caught");
});
