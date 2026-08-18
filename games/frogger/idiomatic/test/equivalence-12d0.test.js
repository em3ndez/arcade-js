// SPDX-License-Identifier: GPL-3.0-only
/**
 * killFrogAtLane — crafted-entry equivalence vs the frozen frog-kill tail. It always raises the hold
 * flag; then, only in the mid-river band 0x30 <= FROG_Y < 0x80, also raises the second-bank kill cell.
 * The band is closed at the low edge and open at the high edge — both pinned with off-by-one teeth.
 * RAM compared, dead stack scratch masked. Positive controls: in-band flips both, out-of-band only hold.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y } from "./_frogHop.js";
import { killFrogAtLane as cand } from "../dispatchFrogMoveAgainstLanes.js";
import { loc_12d0 as oracle } from "../../translated/loc_11bf.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const HOLD_FLAG = 0x8004;   // hold / object-frog-hit flag, always raised
const SECOND_BANK = 0x829c; // mid-river / second-bank kill cell, raised only in-band

// A crafted entry at a given frog Y with both target cells pre-cleared (so a flip 0->1 is observable).
const at = (y) => craft((mem) => { mem[FROG_Y] = y; mem[HOLD_FLAG] = 0; mem[SECOND_BANK] = 0; });

test("EQUAL (crafted): killFrogAtLane == oracle across the three Y bands + edges", { skip }, () => {
  // in-band interior + both closed/open boundaries + out-of-band on each side.
  for (const y of [0x00, 0x10, 0x2f, 0x30, 0x31, 0x50, 0x7f, 0x80, 0x81, 0x90, 0xff]) {
    assert.equal(ramDiff(oracle, cand, at(y)), null, `frog Y=0x${y.toString(16)} diverged`);
  }

  // positive control (in-band): the oracle flips BOTH cells 0 -> 1.
  const ib = at(0x50); oracle(ib);
  assert.equal(ib.mem8[HOLD_FLAG], 1, "positive control: in-band did not raise the hold flag");
  assert.equal(ib.mem8[SECOND_BANK], 1, "positive control: in-band did not raise the second-bank cell");

  // positive control (above the river): only the hold flag flips; the band gate holds the second bank.
  const ab = at(0x80); oracle(ab);
  assert.equal(ab.mem8[HOLD_FLAG], 1, "positive control: above-river did not raise the hold flag");
  assert.equal(ab.mem8[SECOND_BANK], 0, "positive control: above-river spuriously raised the second bank");

  console.log("  EQUAL: 11 Y probes (bands + both edges); in-band flips both 0->1, above-river flips only hold");
});

test("EQUAL (broad): killFrogAtLane == oracle on every frog Y 0..255", { skip }, () => {
  let n = 0;
  for (let y = 0; y <= 255; y++) {
    assert.equal(ramDiff(oracle, cand, at(y)), null, `broad frog Y=0x${y.toString(16)} diverged`); n++;
  }
  console.log(`  EQUAL: ${n} frog-Y sweep values, killFrogAtLane == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const inBand = at(0x50);
  const aboveRiver = at(0x80);
  const lowEdge = at(0x30);
  const highEdge = at(0x80);

  const noOp = () => {};
  const missSecondBank = (m) => { m.mem8[HOLD_FLAG] = 1; };
  const alwaysSecondBank = (m) => { m.mem8[HOLD_FLAG] = 1; m.mem8[SECOND_BANK] = 1; };
  // low-edge off-by-one: treats 0x30 as out of band (<=0x30 returns) -> misses the second bank at 0x30.
  const lowOffByOne = (m) => {
    m.mem8[HOLD_FLAG] = 1; const y = m.mem8[FROG_Y];
    if (y >= 0x80) return; if (y <= 0x30) return; m.mem8[SECOND_BANK] = 1;
  };
  // high-edge off-by-one: treats 0x80 as in band (>0x80 returns) -> spuriously sets the second bank at 0x80.
  const highOffByOne = (m) => {
    m.mem8[HOLD_FLAG] = 1; const y = m.mem8[FROG_Y];
    if (y > 0x80) return; if (y < 0x30) return; m.mem8[SECOND_BANK] = 1;
  };

  assert.ok(ramDiff(oracle, noOp, inBand), "no-op twin escaped (missed the hold flag)");
  assert.ok(ramDiff(oracle, missSecondBank, inBand), "miss-second-bank twin escaped (in-band, no 0x829c)");
  assert.ok(ramDiff(oracle, alwaysSecondBank, aboveRiver), "always-second-bank twin escaped (spurious 0x829c)");
  assert.ok(ramDiff(oracle, lowOffByOne, lowEdge), "low-edge off-by-one twin escaped (dropped 0x30)");
  assert.ok(ramDiff(oracle, highOffByOne, highEdge), "high-edge off-by-one twin escaped (added 0x80)");

  console.log("  TEETH: no-op, miss-second-bank, always-second-bank, low-edge & high-edge off-by-one all caught");
});
