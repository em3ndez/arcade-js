// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_175d — crafted-entry equivalence vs the frozen sound-tick at ROM 0x175d.
 * Runs the channel updater (dissolved advanceSoundSequenceChannel) over three descriptors in turn; they
 * share the same staging/timer cells, so with all three active and the duration timer at 5 each call takes
 * the still-counting branch and decrements it once (5 -> 2 after three). All writes are work RAM, so ramDiff
 * covers the live-out. Positive control: the duration timer lands at 2 (proving all three channels ran) and
 * the staging cells are set. Teeth: no-op, one-only, two-only (both leave the timer high), and scribble.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_175d as cand } from "../loc_175d.js";
import { loc_175d as oracle } from "../../translated/loc_175d.js";
import { advanceSoundSequenceChannel } from "../advanceSoundSequenceChannel.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DESC1 = 0x41d2, DESC2 = 0x41cf, DESC3 = 0x41cd;
const STAGE_FLAG = 0x41c0;    // set to 2 by an active channel
const STAGE_PITCH = 0x41c1;   // <- current tone
const CUR_TONE = 0x41d5;
const DURATION_TIMER = 0x41d6;
const SCRATCH = 0x4190; // untouched by the routine

// All three descriptors active, timer high enough that every call just counts down (no expiry/sequence read).
const active = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[DESC1] = 1; mem[DESC2] = 1; mem[DESC3] = 1;
  mem[DURATION_TIMER] = 5;
  mem[CUR_TONE] = 0x2a;
});

test("EQUAL (crafted): loc_175d == oracle over the three channels", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, active()), null, "loc_175d diverged");
  const a = active(); oracle(a);
  assert.equal(a.mem8[STAGE_FLAG], 2, "positive control: staging flag set");
  assert.equal(a.mem8[STAGE_PITCH], 0x2a, "positive control: current tone staged");
  assert.equal(a.mem8[DURATION_TIMER], 2, "positive control: timer ticked three times (5 -> 2)");
  console.log("  EQUAL: loc_175d == oracle (RAM), all three channels ticked");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const oneOnly = (m) => { advanceSoundSequenceChannel(m, DESC1); };
  const twoOnly = (m) => { advanceSoundSequenceChannel(m, DESC1); advanceSoundSequenceChannel(m, DESC2); };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] ^= 0xff; };
  assert.ok(ramDiff(oracle, noOp, active()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, oneOnly, active()), "one-only twin escaped (timer would land at 4)");
  assert.ok(ramDiff(oracle, twoOnly, active()), "two-only twin escaped (timer would land at 3)");
  assert.ok(ramDiff(oracle, scribble, active()), "scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: no-op, one-only, two-only, scribble all caught");
});
