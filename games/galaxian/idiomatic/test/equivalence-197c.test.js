// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_197c — crafted-entry equivalence vs the frozen translated oracle at ROM 0x197c. Reads the credit
 * count (0x4002) and drives the coin-lockout latch (0x6002 -> io.coinLock, a board device latch NOT in
 * the state dump, so ramDiff is blind to it): >= 9 tails into the lockout-clear routine (dissolved here
 * to a direct call) leaving the latch 0; < 9 raises the latch to 1. EQUAL is asserted on the observable
 * io.coinLock for both paths AND ramDiff==null (no work/video/OBJ RAM touched). Teeth: a no-op and a
 * wrong-value twin on the latch per path, plus a RAM-scribble twin proving ramDiff still bites.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { updateCoinLockoutFromCredits as cand } from "../updateCoinLockoutFromCredits.js";
import { loc_197c as oracle } from "../../translated/loc_197c.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CREDITS = 0x4002;
const COIN_LOCKOUT = 0x6002;
const SCRATCH_RAM = 0x4100; // a plain work-RAM cell for the ramDiff-teeth twin

// >= 9 credits: the latch must end cleared (seed it armed so clearing to 0 is observable).
const releaseEntry = () => craft((mem8, m) => { m.push16(0x9999); mem8[CREDITS] = 9; mem8[COIN_LOCKOUT] = 1; });
// < 9 credits: the latch must end raised (seed it clear so raising to 1 is observable).
const engageEntry = () => craft((mem8, m) => { m.push16(0x9999); mem8[CREDITS] = 0; mem8[COIN_LOCKOUT] = 0; });

// The live-out is a board latch (not in dumpState); read it off the io device.
function coinLockAfter(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m); return m.mem.io.coinLock;
}

const noOp = () => {};
// Leaves the lockout released (0) -- wrong on the engage path, where the credit count is below 9 and the
// latch must be RAISED to 1. (An XOR-flip twin would coincidentally land on 1 from the seeded-0 latch.)
const wrongValue = (m) => { m.mem8[COIN_LOCKOUT] = 0; };
const scribble = (m) => { cand(m); m.mem8[SCRATCH_RAM] = m.mem8[SCRATCH_RAM] ^ 0xff; };

test("EQUAL (crafted): loc_197c releases the lockout at >= 9 credits", { skip }, () => {
  assert.equal(coinLockAfter(oracle, releaseEntry()), 0, "positive control: oracle did not release the latch");
  assert.equal(coinLockAfter(cand, releaseEntry()), coinLockAfter(oracle, releaseEntry()), "candidate/oracle disagree");
  assert.equal(ramDiff(oracle, cand, releaseEntry()), null, "loc_197c wrote RAM the oracle did not");
  console.log("  EQUAL: >= 9 -> coin-lockout latch 1->0, no RAM touched");
});

test("EQUAL (crafted): loc_197c engages the lockout below 9 credits", { skip }, () => {
  assert.equal(coinLockAfter(oracle, engageEntry()), 1, "positive control: oracle did not engage the latch");
  assert.equal(coinLockAfter(cand, engageEntry()), coinLockAfter(oracle, engageEntry()), "candidate/oracle disagree");
  assert.equal(ramDiff(oracle, cand, engageEntry()), null, "loc_197c wrote RAM the oracle did not");
  console.log("  EQUAL: < 9 -> coin-lockout latch 0->1, no RAM touched");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.notEqual(coinLockAfter(noOp, releaseEntry()), coinLockAfter(oracle, releaseEntry()), "no-op twin escaped (release)");
  assert.notEqual(coinLockAfter(wrongValue, engageEntry()), coinLockAfter(oracle, engageEntry()), "wrong-value twin escaped (engage)");
  assert.ok(ramDiff(oracle, scribble, releaseEntry()), "scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: latch no-op (release) + wrong-value (engage) + ramDiff scribble all caught");
});
