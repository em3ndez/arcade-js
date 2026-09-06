// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0cc3 — memory-equivalent to the frozen oracle at ROM 0x0cc3. It loops the 8 object slots (base
 * 0x42b0, 32-byte stride) and drives each record through the object dispatcher (driveObjectSlot, the
 * decompiled 0x0cd6). The idiomatic loop calls the idiomatic dispatcher directly; the frozen oracle runs
 * the translated dispatcher — memory-equivalent link by link, so the whole 8-slot pass matches.
 *
 * The records are crafted ACTIVE in state 3 (advanceObjectFlightAndFire), whose first act is to bump the
 * per-record counter (record+3); each slot starts with a distinct counter so a visit is observable and
 * mis-visiting the wrong records diverges. Teeth: no-op, wrong count (4 slots), wrong stride (0x10), wrong
 * base — each drives a different set of records via the same dispatcher and diverges from the oracle.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_0cc3 as cand } from "../loc_0cc3.js";
import { loc_0cc3 as oracle } from "../../translated/loc_0cc3.js";
import { driveObjectSlot } from "../driveObjectSlot.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ_BASE = 0x42b0;
const STRIDE = 0x20;
const ACTIVE = 0x00; // record+0 bit0: slot active
const DEATH = 0x01;  // record+1 bit0: dying-object animation
const STATE = 0x02;  // record+2: object-AI state index
const COUNT = 0x03;  // record+3: per-frame counter (state 3 bumps this first)

// 8 object records, each active + state 3 + a distinct starting counter, so every slot's dispatch writes
// an observable, record-local change and the loop's coverage is testable.
function seed() {
  return craft((mem, m) => {
    m.push16(0x9999);
    for (let s = 0; s < 8; s++) {
      const r = OBJ_BASE + s * STRIDE;
      mem[r + ACTIVE] = 0x01;    // active
      mem[r + DEATH] = 0x00;     // not dying
      mem[r + STATE] = 0x03;     // state 3 -> advanceObjectFlightAndFire (bumps record+3 first)
      mem[r + COUNT] = 0x10 + s; // distinct counter per slot
    }
  });
}

// Broken twins: loop the SAME idiomatic dispatcher over the wrong records (count/stride/base). Each drives
// a different set of counters than the oracle's real 8-slot pass, so the RAM diff is non-null.
const loopN = (count, stride, base) => (m) => {
  let rec = base;
  for (let k = 0; k < count; k++) { driveObjectSlot(m, rec); rec += stride; }
};
const wrongCount = loopN(4, STRIDE, OBJ_BASE);
const wrongStride = loopN(8, 0x10, OBJ_BASE);
const wrongBase = loopN(8, STRIDE, OBJ_BASE + STRIDE);

test("EQUAL (real dispatch): loc_0cc3 == oracle across the 8 slots", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seed()), null, "loc_0cc3 diverged from the oracle over the 8-slot pass");
  // Non-vacuous: the oracle bumps each record's counter (record+3), slot 0 and slot 7 both visited.
  const a = seed(); oracle(a);
  assert.equal(a.mem8[OBJ_BASE + COUNT], 0x11, "positive control: slot 0 counter bumped 0x10->0x11");
  assert.equal(a.mem8[OBJ_BASE + 7 * STRIDE + COUNT], 0x18, "positive control: slot 7 counter bumped 0x17->0x18");
  console.log("  EQUAL: loc_0cc3 == oracle — all 8 records driven through the dispatcher");
});

// A mis-strided/based loop can drive a mis-aligned "record" whose state index is out of range and throw;
// a throw is a divergence too (the broken loop is not memory-equivalent), so count it as caught.
const caught = (twin, e) => { try { return ramDiff(oracle, twin, e); } catch { return true; } };

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(caught(() => {}, seed()), "the no-op twin escaped");
  assert.ok(caught(wrongCount, seed()), "the wrong-count twin escaped (4 of 8 slots)");
  assert.ok(caught(wrongStride, seed()), "the wrong-stride twin escaped");
  assert.ok(caught(wrongBase, seed()), "the wrong-base twin escaped");
  console.log("  TEETH: no-op, wrong-count, wrong-stride, wrong-base all caught");
});
