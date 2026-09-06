// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0f7b — memory-equivalent to the frozen oracle at ROM 0x0f7b. A shared object tail: delegate the
 * horizontal target pick/commit for the actor (IX record), then arm two of the record's counters. Whole
 * contract is the object record in work RAM, so EQUAL asserts ramDiff==null. The seed puts the actor
 * right of the reference so the delegate's target is a known band value. Teeth: no-op, a skip-delegate
 * twin (proves the dissolved call is load-bearing), a wrong-value twin, and a scribble.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { beginObjectCrossPlayerMove as cand } from "../beginObjectCrossPlayerMove.js";
import { loc_0f7b as oracle } from "../../translated/loc_0f7b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REC = 0x42b0;     // object record base (IX)
const REF_X = 0x4202;   // reference X the delegate crosses
const SCRATCH = 0x4300; // a plain work-RAM cell for the ramDiff-teeth twin

// Actor right of the reference -> delegate aims at the left band; markers on the tail cells.
const entry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[REC + 0x02] = 0;    // planner sub-state
  mem[REC + 0x04] = 0x80; // actor X
  mem[REF_X] = 0x40;      // reference X
  mem[REC + 0x19] = 0xee; // target marker
  mem[REC + 0x18] = 0x99; // tail-cell marker
  mem[REC + 0x10] = 0x99; // tail-cell marker
});

test("EQUAL (crafted): loc_0f7b == oracle commits the move and arms the counters", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_0f7b diverged");
  const a = entry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[REC + 0x19], 48, "positive control: delegate did not stash the left-band target");
  assert.equal(a.mem8[REC + 0x09], 0x50, "positive control: delegate did not store the move delta");
  assert.equal(a.mem8[REC + 0x02], 1, "positive control: delegate did not advance the planner sub-state");
  assert.equal(a.mem8[REC + 0x18], 3, "positive control: leg counter not armed to 3");
  assert.equal(a.mem8[REC + 0x10], 100, "positive control: move throttle not armed to 100");
  console.log("  EQUAL: loc_0f7b == oracle (record RAM), target committed + counters armed");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipDelegate = (m) => { m.mem8[REC + 0x18] = 3; m.mem8[REC + 0x10] = 100; };
  const wrongThrottle = (m) => { cand(m); m.mem8[REC + 0x10] = 99; };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] = m.mem8[SCRATCH] ^ 0xff; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, skipDelegate, entry()), "the skip-delegate twin escaped");
  assert.ok(ramDiff(oracle, wrongThrottle, entry()), "the wrong-throttle twin escaped");
  assert.ok(ramDiff(oracle, scribble, entry()), "the scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: no-op, skip-delegate, wrong-throttle, scribble all caught");
});
