// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitRiverLaneArrivals — memory-equivalent to the frozen oracle at ROM 0x23B7.
 * GATE: crafted-entry. Attract never dispatches this in-play lane setup (probe: 0 over ENTRY_FRAMES),
 * since its caller only runs in active play; a coherent post-boot state captured at the per-frame
 * score redraw (0x0b1f) is cloned and the four lane direction flags poked. The clear entry (all flags
 * 0, mirrors pre-set nonzero) exercises the four mirror-clear writes; each lane entry sets one flag so
 * the routine tails to that lane's commit handler (0x1bba/0x1c0d/0x1c76/0x1cd5), which both sides
 * reach via m.call with the frog X/Y cursors armed and run on a fresh clone. Live-out is memory-only,
 * so RAM is compared and registers/SP are not. Teeth: three broken twins (no-op, wrong mirror value,
 * skip the lane-0 commit call).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { commitRiverLaneArrivals } from "../commitRiverLaneArrivals.js";
import { loc_23b7 as oracle } from "../../translated/loc_23b7.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const NEIGHBOUR = 0x0b1f;
const DIR_FLAGS = 0x8248; // four lane direction flags 0x8248..0x824b
const MIRRORS = 0x824c;   // four lane mirror flags 0x824c..0x824f
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedState() {
  if (seed) return seed;
  const real = TRANSLATED.get(NEIGHBOUR);
  const m = makeMachine(new Map([[NEIGHBOUR, (mm) => {
    if (!seed) seed = mm.clone();
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(seed, "vacuous: the neighbour was never dispatched, no state to replay");
  return seed;
}

// The clear entry: all direction flags 0, all mirrors nonzero so each mirror-clear write shows.
function craftClear() {
  const c = seedState().clone();
  for (let i = 0; i < 4; i++) { c.mem8[DIR_FLAGS + i] = 0; c.mem8[MIRRORS + i] = 0x77; }
  return c;
}

// A lane entry: fire one lane (its mirror 0 so the handler proceeds), the rest clear; give the
// handlers a coherent lane counter/delta so they do observable work.
function craftLane(lane) {
  const c = seedState().clone();
  for (let i = 0; i < 4; i++) { c.mem8[DIR_FLAGS + i] = 0; c.mem8[MIRRORS + i] = 0; }
  c.mem8[DIR_FLAGS + lane] = 1;
  for (let i = 0; i < 4; i++) { c.mem8[0x8250 + i] = 2; c.mem8[0x8254 + i] = 1; }
  return c;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins the RAM diff must catch.
function brokenNoOp() {}
function brokenWrongMirror(m) {
  const { regs, mem8 } = m;
  regs.hl = 0x8044; regs.de = 0x8047;
  regs.a = mem8[0x8248]; if (regs.a !== 0) return m.call(0x1bba); mem8[0x824c] = 1; // BUG: not 0
  regs.a = mem8[0x8249]; if (regs.a !== 0) return m.call(0x1c0d); mem8[0x824d] = 1;
  regs.a = mem8[0x824a]; if (regs.a !== 0) return m.call(0x1c76); mem8[0x824e] = 1;
  regs.a = mem8[0x824b]; if (regs.a !== 0) return m.call(0x1cd5); mem8[0x824f] = 1;
}
function brokenSkipCommit(m) {
  const { regs, mem8 } = m;
  regs.hl = 0x8044; regs.de = 0x8047;
  regs.a = mem8[0x8248]; if (regs.a !== 0) return; mem8[0x824c] = 0; // BUG: lane 0 never commits
  regs.a = mem8[0x8249]; if (regs.a !== 0) return m.call(0x1c0d); mem8[0x824d] = 0;
  regs.a = mem8[0x824a]; if (regs.a !== 0) return m.call(0x1c76); mem8[0x824e] = 0;
  regs.a = mem8[0x824b]; if (regs.a !== 0) return m.call(0x1cd5); mem8[0x824f] = 0;
}

test("EQUAL (crafted): commitRiverLaneArrivals == oracle on the clear path and each lane arm", { skip }, () => {
  assert.equal(ramDiff(commitRiverLaneArrivals, craftClear()), null, "the clear path diverged");
  for (let l = 0; l < 4; l++) assert.equal(ramDiff(commitRiverLaneArrivals, craftLane(l)), null, `lane ${l} diverged`);
  assert.ok(ramDiff(brokenNoOp, craftClear()), "vacuous: oracle wrote nothing on the clear path");
  assert.ok(ramDiff(brokenNoOp, craftLane(0)), "vacuous: oracle wrote nothing on the lane-0 arm");
  console.log("  EQUAL: clear path + four lane commit arms, commitRiverLaneArrivals == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(brokenNoOp, craftClear()), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongMirror, craftClear()), "the wrong-mirror twin escaped");
  assert.ok(ramDiff(brokenSkipCommit, craftLane(0)), "the skip-commit twin escaped");
  console.log("  TEETH: no-op, wrong-mirror, skip-commit all caught");
});
