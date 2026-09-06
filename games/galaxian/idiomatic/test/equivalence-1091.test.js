// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1091 — memory-equivalent to the frozen oracle at ROM 0x1091. A per-object step: bump the object's
 * sub-counter (ix+3), set its state byte (ix+2)=8, then tail into the cross-player move tail (dissolved
 * jp) that picks and commits the actor's horizontal target and arms two of its counters. The whole
 * contract is the object record in work RAM, so EQUAL asserts ramDiff==null. The seed puts the actor
 * right of the reference so the delegate's target is a known left-band value; ordering matters — the
 * state byte is set to 8 BEFORE the delegate, which then increments it to 9. Teeth: no-op, an
 * inc-skipping twin, a skip-delegate twin (proves the dissolved jp is load-bearing), and a wrong-state
 * twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_1091 as cand } from "../loc_1091.js";
import { loc_1091 as oracle } from "../../translated/loc_1091.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REC = 0x42b0;   // object record base (IX)
const REF_X = 0x4202; // reference X the delegate crosses

// Actor right of the reference -> delegate aims at the left band; markers on the bumped/state cells.
const entry = () => craft((mem, m) => {
  m.push16(0x9999);
  m.regs.ix = REC;
  mem[REC + 0x03] = 0x10; // sub-counter (incremented)
  mem[REC + 0x02] = 0;    // state byte (set to 8, then delegate bumps to 9)
  mem[REC + 0x04] = 0x80; // actor X
  mem[REF_X] = 0x40;      // reference X
  mem[REC + 0x18] = 0x99; // tail-cell marker
  mem[REC + 0x10] = 0x99; // tail-cell marker
});

test("EQUAL (crafted): loc_1091 == oracle bumps the counters and commits the move", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_1091 diverged");
  const a = entry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[REC + 0x03], 0x11, "positive control: sub-counter not bumped");
  assert.equal(a.mem8[REC + 0x02], 9, "positive control: state 8 not set before the delegate bumped it to 9");
  assert.equal(a.mem8[REC + 0x19], 48, "positive control: delegate did not stash the left-band target");
  assert.equal(a.mem8[REC + 0x18], 3, "positive control: flight-curve seed not armed");
  assert.equal(a.mem8[REC + 0x10], 100, "positive control: move throttle not armed to 100");
  console.log("  EQUAL: loc_1091 == oracle (record RAM), counters bumped + move committed");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipInc = (m) => { cand(m); m.mem8[REC + 0x03] = (m.mem8[REC + 0x03] - 1) & 0xff; };
  const skipDelegate = (m) => { m.mem8[REC + 0x03] = (m.mem8[REC + 0x03] + 1) & 0xff; m.mem8[REC + 0x02] = 8; };
  const wrongState = (m) => { cand(m); m.mem8[REC + 0x02] = (m.mem8[REC + 0x02] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, skipInc, entry()), "the inc-skipping twin escaped");
  assert.ok(ramDiff(oracle, skipDelegate, entry()), "the skip-delegate twin escaped (delegate not load-bearing?)");
  assert.ok(ramDiff(oracle, wrongState, entry()), "the wrong-state twin escaped");
  console.log("  TEETH: no-op, inc-skip, skip-delegate, wrong-state all caught");
});
