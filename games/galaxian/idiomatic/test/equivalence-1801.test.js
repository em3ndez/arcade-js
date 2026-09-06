// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1801 — memory-equivalent to the frozen oracle at ROM 0x1801.
 * Reads the low two bits at HL. Nonzero -> recompute the staged pitch from the sound counter (0x41c4)
 * using those bits as the selector (odd applies a +96 bias and rotate-right warble, even passes through).
 * Zero -> stage a fixed pitch of 96. The only live-out is the staged pitch cell 0x41c1 (work RAM, in the
 * state dump), so EQUAL is asserted on ramDiff==null with a non-vacuous positive control per path.
 * Teeth: no-op and wrong-value twins each leave a wrong 0x41c1.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { stageSoundPitchBySelector as cand } from "../stageSoundPitchBySelector.js";
import { loc_1801 as oracle } from "../../translated/loc_1801.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SEL_CELL = 0x4100;   // scratch work-RAM cell the pointer reads its selector bits from
const SOUND_COUNTER = 0x41c4;
const STAGED_PITCH = 0x41c1;
const FOREIGN = 0xff;      // seed the pitch cell foreign so any store is observable

// Odd selector (3): bias 0x41c4 by 96 and rotate right -> a warbled pitch.
const oddEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SEL_CELL;
  mem[SEL_CELL] = 3; mem[SOUND_COUNTER] = 0x40; mem[STAGED_PITCH] = FOREIGN;
});
// Even selector (2): pass 0x41c4 through unchanged.
const evenEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SEL_CELL;
  mem[SEL_CELL] = 2; mem[SOUND_COUNTER] = 0x40; mem[STAGED_PITCH] = FOREIGN;
});
// Zero selector: stage the fixed pitch 96.
const fixedEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SEL_CELL;
  mem[SEL_CELL] = 0; mem[STAGED_PITCH] = FOREIGN;
});

test("EQUAL (crafted): loc_1801 == oracle on the odd-selector warble path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, oddEntry()), null, "loc_1801 diverged on the odd path");
  const a = oddEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[STAGED_PITCH], 80, "positive control: oracle warbled 0x40 (+96, >>1) to 80");
  console.log("  EQUAL: odd selector -> staged pitch 80, == oracle");
});

test("EQUAL (crafted): loc_1801 == oracle on the even-selector passthrough path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, evenEntry()), null, "loc_1801 diverged on the even path");
  const a = evenEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[STAGED_PITCH], 0x40, "positive control: oracle passed the counter through to 0x41c1");
  console.log("  EQUAL: even selector -> staged pitch 0x40, == oracle");
});

test("EQUAL (crafted): loc_1801 == oracle on the fixed-pitch path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, fixedEntry()), null, "loc_1801 diverged on the fixed path");
  const a = fixedEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[STAGED_PITCH], 96, "positive control: oracle staged the fixed pitch 96");
  console.log("  EQUAL: zero selector -> staged pitch 96, == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongValue = (m) => { m.mem8[STAGED_PITCH] = 81; };
  assert.ok(ramDiff(oracle, noOp, oddEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongValue, oddEntry()), "the wrong-value twin escaped");
  assert.ok(ramDiff(oracle, noOp, fixedEntry()), "the no-op twin escaped on the fixed path");
  console.log("  TEETH: no-op and wrong-value caught on 0x41c1");
});
