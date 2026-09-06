// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_17f9 — memory-equivalent to the frozen oracle at ROM 0x17f9.
 * When the counter in A is nonzero, decrement it and store it back to the sound counter cell (0x41c4);
 * then, on every path, tail-stage the sound pitch keyed on the low two bits at HL. Both live-outs are work
 * RAM in the state dump: the sound counter 0x41c4 (written only on the nonzero path) and the staged pitch
 * 0x41c1 (written by the delegate). So EQUAL is asserted on ramDiff==null with a positive control per path.
 * The nonzero path also proves the write feeds the pitch (the odd-selector warble reads the just-stored
 * counter). Teeth: no-op, a skip-decrement twin (leaves 0x41c4 stale + warbles the wrong value), and a
 * wrong-pitch twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_17f9 as cand } from "../loc_17f9.js";
import { loc_17f9 as oracle } from "../../translated/loc_17f9.js";
import { stageSoundPitchBySelector } from "../stageSoundPitchBySelector.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SEL_CELL = 0x4100;       // scratch cell HL points at; its low 2 bits pick the pitch mode
const SOUND_COUNTER = 0x41c4;  // decremented + stored here on the nonzero path, then read by the warble
const STAGED_PITCH = 0x41c1;   // the delegate parks the pitch here
const FOREIGN_PITCH = 0xff;
const FOREIGN_COUNTER = 0x99;

// Nonzero counter + odd selector: dec 5->4 into 0x41c4, then warble that (4+96, >>1) -> 50.
const decOdd = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.a = 5; mm.regs.hl = SEL_CELL;
  mem[SEL_CELL] = 3; mem[SOUND_COUNTER] = FOREIGN_COUNTER; mem[STAGED_PITCH] = FOREIGN_PITCH;
});
// Nonzero counter + zero selector: dec 7->6 into 0x41c4, stage the fixed pitch 96.
const decFixed = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.a = 7; mm.regs.hl = SEL_CELL;
  mem[SEL_CELL] = 0; mem[SOUND_COUNTER] = FOREIGN_COUNTER; mem[STAGED_PITCH] = FOREIGN_PITCH;
});
// Zero counter: no decrement, no store; stage the fixed pitch 96.
const zeroCount = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.a = 0; mm.regs.hl = SEL_CELL;
  mem[SEL_CELL] = 0; mem[SOUND_COUNTER] = FOREIGN_COUNTER; mem[STAGED_PITCH] = FOREIGN_PITCH;
});

test("EQUAL (crafted): loc_17f9 == oracle decrements the counter then warbles from it", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, decOdd()), null, "loc_17f9 diverged on the decrement+warble path");
  const a = decOdd(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SOUND_COUNTER], 4, "positive control: oracle stored the decremented counter");
  assert.equal(a.mem8[STAGED_PITCH], 50, "positive control: oracle warbled the stored counter to 50");
  console.log("  EQUAL: nonzero+odd -> counter 5->4, staged pitch 50, == oracle");
});

test("EQUAL (crafted): loc_17f9 == oracle decrements then stages the fixed pitch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, decFixed()), null, "loc_17f9 diverged on the decrement+fixed path");
  const a = decFixed(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SOUND_COUNTER], 6, "positive control: oracle stored the decremented counter");
  assert.equal(a.mem8[STAGED_PITCH], 96, "positive control: oracle staged the fixed pitch 96");
  console.log("  EQUAL: nonzero+zero-sel -> counter 7->6, staged pitch 96, == oracle");
});

test("EQUAL (crafted): loc_17f9 == oracle leaves the counter alone on the zero path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, zeroCount()), null, "loc_17f9 diverged on the zero-counter path");
  const a = zeroCount(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SOUND_COUNTER], FOREIGN_COUNTER, "positive control: oracle left the counter unchanged");
  assert.equal(a.mem8[STAGED_PITCH], 96, "positive control: oracle staged the fixed pitch 96");
  console.log("  EQUAL: zero counter -> counter untouched, staged pitch 96, == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipDec = (m) => { stageSoundPitchBySelector(m, m.regs.hl); }; // stages but never touches 0x41c4
  const wrongPitch = (m) => { cand(m); m.mem8[STAGED_PITCH] = m.mem8[STAGED_PITCH] ^ 0xff; };
  assert.ok(ramDiff(oracle, noOp, decOdd()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, skipDec, decOdd()), "the skip-decrement twin escaped");
  assert.ok(ramDiff(oracle, wrongPitch, decOdd()), "the wrong-pitch twin escaped");
  console.log("  TEETH: no-op, skip-decrement, wrong-pitch all caught on 0x41c4/0x41c1");
});
