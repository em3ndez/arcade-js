// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0218 — crafted-entry equivalence vs the frozen sequence-state handler at ROM 0x0218.
 * Memory-only live-outs: the shared strided-table reset, the two dwell tiers (0x4008/0x4009), and on
 * mid-tier expiry the sequence-state bump (0x400a), the tier reloads, the 256-byte sprite-source clear
 * (0x42b0..) and the redraw count (0x4241). No register or io live-out the caller reads. Three paths:
 *   - LOW HOLD: low tier still counting -> only the reset + one decrement.
 *   - MID HOLD: low tier expired (reload + enqueue) but mid tier still counting.
 *   - FULL EXPIRY: both tiers expire -> the full advance/clear.
 * Teeth: a no-op twin, plus perturbations of the state bump, the low-tier reload and the cleared block.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0218 as cand } from "../loc_0218.js";
import { loc_0218 as oracle } from "../../translated/loc_0218.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TIMER_LOW = 0x4008;
const TIMER_MID = 0x4009;
const SEQ_STATE = 0x400a;
const REDRAW_COUNT = 0x4241;
const SPRITE_SRC = 0x42b0;
const SPRITE_SRC_END = 0x43af; // last byte of the 256-byte clear

// Both tiers set to expire this tick; sequence state seeded to 5, the clear region dirtied.
const fullExpiry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[TIMER_LOW] = 1;
  mem[TIMER_MID] = 1;
  mem[SEQ_STATE] = 5;
  mem[SPRITE_SRC] = 0xff;
  mem[SPRITE_SRC_END] = 0xff;
});
// Low tier still counting.
const lowHold = () => craft((mem, mm) => { mm.push16(0x9999); mem[TIMER_LOW] = 5; mem[SEQ_STATE] = 5; });
// Low tier expires (reload + enqueue) but mid tier keeps counting.
const midHold = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[TIMER_LOW] = 1;
  mem[TIMER_MID] = 5;
  mem[SEQ_STATE] = 5;
});

function runOracle(entry) { const a = entry.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_0218 == oracle on the full-expiry path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, fullExpiry()), null, "loc_0218 diverged on the full-expiry path");
  const a = runOracle(fullExpiry());
  assert.equal(a.mem8[SEQ_STATE], 6, "positive control: oracle advanced the sequence state 5->6");
  assert.equal(a.mem8[TIMER_LOW], 32, "positive control: oracle reloaded the low tier to 32");
  assert.equal(a.mem8[TIMER_MID], 4, "positive control: oracle reloaded the mid tier to 4");
  assert.equal(a.mem8[REDRAW_COUNT], 0, "positive control: oracle cleared the redraw count");
  assert.equal(a.mem8[SPRITE_SRC], 0, "positive control: oracle cleared the sprite-source block head");
  assert.equal(a.mem8[SPRITE_SRC_END], 0, "positive control: oracle cleared the sprite-source block tail");
  console.log("  EQUAL: loc_0218 == oracle, full expiry advanced state 5->6 and cleared the block");
});

test("EQUAL (crafted): loc_0218 == oracle holds on the low tier", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, lowHold()), null, "loc_0218 diverged on the low-hold path");
  const a = runOracle(lowHold());
  assert.equal(a.mem8[TIMER_LOW], 4, "positive control: oracle decremented the low tier 5->4");
  assert.equal(a.mem8[SEQ_STATE], 5, "positive control: low hold leaves the sequence state untouched");
  console.log("  EQUAL: loc_0218 == oracle, low tier 5->4, no advance");
});

test("EQUAL (crafted): loc_0218 == oracle holds on the mid tier", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, midHold()), null, "loc_0218 diverged on the mid-hold path");
  const a = runOracle(midHold());
  assert.equal(a.mem8[TIMER_LOW], 80, "positive control: oracle reloaded the low tier to 80");
  assert.equal(a.mem8[TIMER_MID], 4, "positive control: oracle decremented the mid tier 5->4");
  assert.equal(a.mem8[SEQ_STATE], 5, "positive control: mid hold leaves the sequence state untouched");
  console.log("  EQUAL: loc_0218 == oracle, low reload + mid 5->4, no advance");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongStateInc = (m) => { cand(m); m.mem8[SEQ_STATE] = (m.mem8[SEQ_STATE] + 1) & 0xff; };
  const wrongLowReload = (m) => { cand(m); m.mem8[TIMER_LOW] = 33; };
  const skipClear = (m) => { cand(m); m.mem8[SPRITE_SRC] = 0xff; };
  assert.ok(ramDiff(oracle, noOp, fullExpiry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongStateInc, fullExpiry()), "wrong state-bump twin escaped");
  assert.ok(ramDiff(oracle, wrongLowReload, fullExpiry()), "wrong low-reload twin escaped");
  assert.ok(ramDiff(oracle, skipClear, fullExpiry()), "un-cleared block twin escaped");
  assert.ok(ramDiff(oracle, noOp, lowHold()), "no-op twin escaped on low hold");
  console.log("  TEETH: no-op, wrong state-bump, wrong low-reload, un-cleared block all caught");
});
