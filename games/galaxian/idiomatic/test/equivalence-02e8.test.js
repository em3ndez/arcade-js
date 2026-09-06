// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_02e8 — memory-equivalent to the frozen sequence-init reset at ROM 0x02e8. Pure memory: zeros the
 * 128-byte flag block, clears two status bytes, arms the dwell timer, and (via the tail) bumps the
 * sequence-state byte and reseeds the strided object-shadow field. ramDiff covers every live-out; the
 * seed dirties each written cell so the writes are observable. Teeth: no-op, skip-timer, skip-fill,
 * and skip-clear twins each leave a divergence.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { clearFlagBlockAndReseedObjectShadow as cand } from "../clearFlagBlockAndReseedObjectShadow.js";
import { loc_02e8 as oracle } from "../../translated/loc_02e8.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const FLAG0 = 0x4100;     // first byte of the flag block
const FLAGN = 0x417f;     // last byte of the flag block
const STATUS_A = 0x425f;
const STATUS_B = 0x4238;
const DWELL = 0x4009;
const SEQ_STATE = 0x400a; // bumped by the tail
const SHADOW0 = 0x4021;   // first strided shadow cell
const SRC0 = 0x1d71;      // template the shadow is reseeded from

// Dirty every cell the routine writes so each live-out is observable.
const entry = () => craft((mem, mm) => {
  mem[FLAG0] = 0xff;
  mem[FLAGN] = 0xff;
  mem[STATUS_A] = 0x55;
  mem[STATUS_B] = 0x55;
  mem[DWELL] = 0x00;
  mem[SHADOW0] = mem[SHADOW0] ^ 0xff;
  mm.push16(0x9999); // for the tail ret
});

test("EQUAL (crafted): loc_02e8 == oracle resets the sequence-init block", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_02e8 diverged");
  const a = entry(); a.routines = STUBS; oracle(a);
  const before = entry();
  assert.equal(a.mem8[FLAG0], 0, "positive control: flag block not zeroed");
  assert.equal(a.mem8[FLAGN], 0, "positive control: flag block tail not zeroed");
  assert.equal(a.mem8[STATUS_A], 0, "positive control: status A not cleared");
  assert.equal(a.mem8[STATUS_B], 0, "positive control: status B not cleared");
  assert.equal(a.mem8[DWELL], 0x40, "positive control: dwell timer not armed");
  assert.equal(a.mem8[SEQ_STATE], (before.mem8[SEQ_STATE] + 1) & 0xff, "positive control: sequence state not bumped");
  assert.equal(a.mem8[SHADOW0], before.mem8[SRC0], "positive control: shadow field not reseeded");
  console.log("  EQUAL: loc_02e8 == oracle — block zeroed, timer armed, state bumped, shadow reseeded");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipTimer = (m) => { cand(m); m.mem8[DWELL] = 0; };
  const skipFill = (m) => { cand(m); m.mem8[FLAG0] = 0xff; };
  const skipClear = (m) => { cand(m); m.mem8[STATUS_A] = 0x55; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, skipTimer, entry()), "the skip-timer twin escaped");
  assert.ok(ramDiff(oracle, skipFill, entry()), "the skip-fill twin escaped");
  assert.ok(ramDiff(oracle, skipClear, entry()), "the skip-clear twin escaped");
  console.log("  TEETH: no-op, skip-timer, skip-fill, skip-clear all caught");
});
