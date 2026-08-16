// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdFrogMissedHomeBay — memory-equivalent to the frozen oracle loc_1d77 (ROM 0x1D77). GATE:
 * crafted-entry. The reject handler raises the hit/hold flag only when the frog has fully reached
 * the home row (FROG_Y below 0x2a), then both sides tail into the input scan. The scan is locked
 * (0x826c != 0) so it is a trivial identical no-op on both sides and the test isolates the hold
 * logic. RAM compared, stack masked. Teeth: no-op (misses the hold), always-hold (spurious hold);
 * positive control the hold flag really flips 0->1.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y } from "./_frogHop.js";
import { holdFrogMissedHomeBay as cand } from "../holdFrogMissedHomeBay.js";
import { loc_1d77 as oracle } from "../../translated/loc_1d77.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const HOLD_FLAG = 0x8004, INPUT_GATE = 0x826c;

const reached = () => craft((mem) => { mem[INPUT_GATE] = 1; mem[FROG_Y] = 0x20; mem[HOLD_FLAG] = 0; });
const notReached = () => craft((mem) => { mem[INPUT_GATE] = 1; mem[FROG_Y] = 0x40; mem[HOLD_FLAG] = 0; });

test("EQUAL (crafted): holdFrogMissedHomeBay == oracle on reached / not-reached home", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, reached()), null, "the reached-home path diverged");
  assert.equal(ramDiff(oracle, cand, notReached()), null, "the not-reached path diverged");
  const e = reached(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[HOLD_FLAG], 1, "positive control: reached-home did not raise the hold flag");
  console.log("  EQUAL: reached (hold 0->1) + not-reached (no hold), scan locked identical both sides");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const alwaysHold = (m) => { m.mem8[HOLD_FLAG] = 1; };
  assert.ok(ramDiff(oracle, noOp, reached()), "no-op twin escaped (missed hold)");
  assert.ok(ramDiff(oracle, alwaysHold, notReached()), "always-hold twin escaped (spurious hold)");
  console.log("  TEETH: no-op + always-hold both caught");
});
