// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_090d — crafted-entry equivalence vs the frozen oscillating-mover oracle at ROM 0x090d.
 * All live-outs are work RAM (in the state dump), so equivalence is asserted with ramDiff==null:
 *   - the swept 16-bit word at 0x420e,
 *   - the sweep-direction flag at 0x420d (turnaround paths),
 *   - the 9-cell stride-2 broadcast table at 0x4028..0x4038.
 * No register/io live-out — a memory-only check is complete here. Five paths are exercised: an
 * ascending step, a descending step, an ascending turnaround (dir 0->1), a descending turnaround
 * (dir 1->0), the closed-throttle no-op, and the leading proximity-gate shortcut. Each has a
 * non-vacuous positive control; teeth twins diverge on every path.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { advanceFormationSweepOscillator as cand } from "../advanceFormationSweepOscillator.js";
import { loc_090d as oracle } from "../../translated/loc_090d.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const GATE = 0x4208;        // behavior/proximity gate (bit0)
const SHOT_POS = 0x4209;    // shot position counter
const SHOT_FIELD = 0x420a;  // shot field byte
const SWEEP_DIR = 0x420d;   // 0=ascending, 1=descending
const SWEPT_WORD = 0x420e;  // 16-bit swept word (low byte at 0x420e)
const BOUND_LO = 0x4210;    // low bound (E)
const BOUND_HI = 0x4211;    // high bound (D)
const FRAME = 0x425f;       // frame counter (throttle)
const COL_OCC = 0x41f0;     // per-column occupancy summaries
const STRIDED = 0x4028;     // first cell of the stride-2 broadcast table

// Proximity gate off (bit0 clear) for every non-gate path so we reach the mover proper.
const ascStep = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] = 0; mem[SWEEP_DIR] = 0; mm.mem16[SWEPT_WORD] = 0x0010; mem[BOUND_LO] = 0x80; mem[FRAME] = 0;
});
const descStep = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] = 0; mem[SWEEP_DIR] = 1; mm.mem16[SWEPT_WORD] = 0x0040; mem[BOUND_HI] = 0x10; mem[FRAME] = 0;
});
const ascTurn = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] = 0; mem[SWEEP_DIR] = 0; mm.mem16[SWEPT_WORD] = 0x0090; mem[BOUND_LO] = 0x80; mem[FRAME] = 0;
});
const descTurn = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] = 0; mem[SWEEP_DIR] = 1; mm.mem16[SWEPT_WORD] = 0x8010; mem[BOUND_HI] = 0x80; mem[FRAME] = 0;
});
const throttled = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] = 0; mem[SWEEP_DIR] = 0; mm.mem16[SWEPT_WORD] = 0x0010; mem[BOUND_LO] = 0x80; mem[FRAME] = 1;
});
// Gate armed + shot lined up on column 3 (which reads occupied) -> shortcut broadcast of -(low byte).
// Zero the strided table first so the broadcast (0xfb) is an observable, deterministic change.
const gateHit = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] = 1; mem[SHOT_POS] = 0x22; mem[SWEPT_WORD] = 0x05; mem[SHOT_FIELD] = 0x35; mem[COL_OCC + 3] = 1;
  for (let i = 0; i < 9; i++) mem[STRIDED + i * 2] = 0;
});

test("EQUAL (crafted): loc_090d == oracle steps the word up and broadcasts the negated low byte", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, ascStep()), null, "ascending step diverged");
  const a = ascStep(); oracle(a);
  assert.equal(a.mem16[SWEPT_WORD], 0x0011, "positive control: oracle stepped the word 0x0010->0x0011");
  assert.equal(a.mem8[STRIDED], (-0x11) & 0xff, "positive control: oracle broadcast the negated low byte");
  console.log("  EQUAL: ascending step 0x0010->0x0011, strided = 0xef");
});

test("EQUAL (crafted): loc_090d == oracle steps the word down and broadcasts", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, descStep()), null, "descending step diverged");
  const a = descStep(); oracle(a);
  assert.equal(a.mem16[SWEPT_WORD], 0x003f, "positive control: oracle stepped the word 0x0040->0x003f");
  assert.equal(a.mem8[STRIDED], (-0x3f) & 0xff, "positive control: oracle broadcast the negated low byte");
  console.log("  EQUAL: descending step 0x0040->0x003f, strided = 0xc1");
});

test("EQUAL (crafted): loc_090d == oracle flips to descending at the upper bound", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, ascTurn()), null, "ascending turnaround diverged");
  const a = ascTurn(); oracle(a);
  assert.equal(a.mem8[SWEEP_DIR], 1, "positive control: oracle set the direction flag to descending");
  assert.equal(a.mem16[SWEPT_WORD], 0x0090, "positive control: turnaround leaves the word unstepped");
  console.log("  EQUAL: upper bound -> dir 0->1, word unchanged");
});

test("EQUAL (crafted): loc_090d == oracle flips to ascending at the lower bound", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, descTurn()), null, "descending turnaround diverged");
  const a = descTurn(); oracle(a);
  assert.equal(a.mem8[SWEEP_DIR], 0, "positive control: oracle cleared the direction flag to ascending");
  console.log("  EQUAL: lower bound -> dir 1->0");
});

test("EQUAL (crafted): loc_090d == oracle skips the step on a closed throttle", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, throttled()), null, "closed-throttle path diverged");
  const a = throttled(); oracle(a);
  assert.equal(a.mem16[SWEPT_WORD], 0x0010, "positive control: closed throttle leaves the word unstepped");
  console.log("  EQUAL: throttle closed -> no step");
});

test("EQUAL (crafted): loc_090d == oracle takes the proximity-gate shortcut", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, gateHit()), null, "proximity-gate path diverged");
  const a = gateHit(); oracle(a);
  assert.equal(a.mem8[STRIDED], (-0x05) & 0xff, "positive control: gate shortcut broadcast the negated low byte");
  console.log("  EQUAL: proximity gate -> strided = 0xfb");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const stepByTwo = (m) => { m.mem16[SWEPT_WORD] = (m.mem16[SWEPT_WORD] + 2) & 0xffff; };
  const rawBroadcast = (m) => {
    const w = (m.mem16[SWEPT_WORD] + 1) & 0xffff;
    m.mem16[SWEPT_WORD] = w;
    for (let i = 0; i < 9; i++) m.mem8[STRIDED + i * 2] = w & 0xff; // raw low, not negated
  };
  const scribble = (m) => { cand(m); m.mem8[0x4100] = m.mem8[0x4100] ^ 0xff; };
  const dirNoOp = () => {};
  const gateNoOp = () => {};

  assert.ok(ramDiff(oracle, noOp, ascStep()), "no-op twin escaped the step path");
  assert.ok(ramDiff(oracle, stepByTwo, ascStep()), "step-by-two twin escaped");
  assert.ok(ramDiff(oracle, rawBroadcast, ascStep()), "raw-broadcast twin escaped");
  assert.ok(ramDiff(oracle, scribble, ascStep()), "scribble twin escaped (ramDiff teeth)");
  assert.ok(ramDiff(oracle, dirNoOp, ascTurn()), "no-op twin escaped the turnaround path");
  assert.ok(ramDiff(oracle, gateNoOp, gateHit()), "no-op twin escaped the proximity-gate path");
  console.log("  TEETH: no-op, step-by-two, raw-broadcast, scribble, turnaround, gate all caught");
});
