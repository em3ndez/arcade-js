// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_12b6 — memory-equivalent to the frozen oracle at ROM 0x12b6. Per-object proximity test: an inactive
 * object (byte0 bit0 clear) is a no-op; otherwise the object field (ix+3, biased) classifies into a low
 * (<5) or high (5..16) window, and the object's X (ix+4) is banded against the player reference (0x4202).
 * A hit raises HIT_EVENT_FLAG (0x4204)=1 and tail-jumps (dissolved) into the kill-award, which deactivates
 * the object and enqueues a score request; a miss or an out-of-range field (>=17) does nothing. All effects
 * are work RAM, so EQUAL asserts ramDiff==null across every arm. The hit seeds arm a free queue slot so the
 * award's enqueue is observable. Teeth prove the active guard, both band tests, and the dissolved award are
 * each load-bearing.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { flagObjectHitOnPlayer as cand } from "../flagObjectHitOnPlayer.js";
import { loc_12b6 as oracle } from "../../translated/loc_12b6.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REC = 0x42b0;         // object record base (IX)
const REF_X = 0x4202;       // player position reference
const HIT_FLAG = 0x4204;    // raised on a hit
const FIELD = REC + 0x03;   // classified into a proximity window (biased +33)
const OBJ_X = REC + 0x04;   // banded against the reference
const KILL_FIELD = REC + 0x07; // award band scan reads this
const QUEUE_HEAD = 0x40a0;
const QUEUE_BASE = 0x4000;
const HEAD = 0xc0;
const SENTINEL = 0x55;

function armQueue(mem) { mem[QUEUE_HEAD] = HEAD; mem[QUEUE_BASE + HEAD] = 0x80; }

// biased field: u8((ix+3)+33) -> 0xdf=window 0 (low), 0xe9=window 10 (high), 0xff=window 32 (out of range)
const inactiveEntry = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.ix = REC;
  mem[REC] = 0x00; mem[HIT_FLAG] = SENTINEL;
});
const lowHitEntry = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.ix = REC; armQueue(mem);
  mem[REC] = 0x01; mem[FIELD] = 0xdf; mem[REF_X] = 0x40; mem[OBJ_X] = 0x40;
  mem[KILL_FIELD] = 0x30; mem[HIT_FLAG] = 0x00;
});
const lowMissEntry = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.ix = REC;
  mem[REC] = 0x01; mem[FIELD] = 0xdf; mem[REF_X] = 0x40; mem[OBJ_X] = 0x00; mem[HIT_FLAG] = SENTINEL;
});
const highHitEntry = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.ix = REC; armQueue(mem);
  mem[REC] = 0x01; mem[FIELD] = 0xe9; mem[REF_X] = 0x40; mem[OBJ_X] = 0x40;
  mem[KILL_FIELD] = 0x30; mem[HIT_FLAG] = 0x00;
});
const highMissEntry = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.ix = REC;
  mem[REC] = 0x01; mem[FIELD] = 0xe9; mem[REF_X] = 0x40; mem[OBJ_X] = 0x00; mem[HIT_FLAG] = SENTINEL;
});
const aboveEntry = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.ix = REC;
  mem[REC] = 0x01; mem[FIELD] = 0xff; mem[REF_X] = 0x40; mem[OBJ_X] = 0x40; mem[HIT_FLAG] = SENTINEL;
});

test("EQUAL (crafted): loc_12b6 == oracle across every window arm (RAM)", { skip }, () => {
  const cases = [
    ["inactive", inactiveEntry], ["low-hit", lowHitEntry], ["low-miss", lowMissEntry],
    ["high-hit", highHitEntry], ["high-miss", highMissEntry], ["above", aboveEntry],
  ];
  for (const [name, e] of cases) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_12b6 diverged on the ${name} arm`);
  }
  // positive control: a hit raises the flag, deactivates the object, and enqueues the award request.
  for (const [name, e] of [["low", lowHitEntry], ["high", highHitEntry]]) {
    const a = e(); a.routines = STUBS; oracle(a);
    assert.equal(a.mem8[HIT_FLAG], 1, `positive control: ${name} hit did not raise HIT_EVENT_FLAG`);
    assert.equal(a.mem8[REC + 0], 0, `positive control: ${name} hit did not deactivate the object`);
    assert.equal(a.mem8[REC + 1], 1, `positive control: ${name} hit did not set (ix+1)=1`);
    assert.equal(a.mem8[QUEUE_BASE + HEAD], 0x03, `positive control: ${name} hit did not enqueue the request hi`);
    assert.equal(a.mem8[QUEUE_BASE + HEAD + 1], 0x04, `positive control: ${name} hit did not enqueue the request lo`);
  }
  // positive control: the no-op arms leave the flag at its sentinel.
  for (const [name, e] of [["inactive", inactiveEntry], ["low-miss", lowMissEntry], ["high-miss", highMissEntry], ["above", aboveEntry]]) {
    const a = e(); a.routines = STUBS; oracle(a);
    assert.equal(a.mem8[HIT_FLAG], SENTINEL, `positive control: ${name} arm should not touch the flag`);
  }
  console.log("  EQUAL: loc_12b6 == oracle — inactive/miss/above are no-ops, low+high hits award the kill");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const flagOnly = (m) => { m.mem8[HIT_FLAG] = 1; };                       // raise flag, skip the award
  const wrongFlag = (m) => { cand(m); m.mem8[HIT_FLAG] = 0; };
  assert.ok(ramDiff(oracle, noOp, lowHitEntry()), "the no-op twin escaped (low-hit)");
  assert.ok(ramDiff(oracle, flagOnly, lowHitEntry()), "the flag-only twin escaped (award not load-bearing?)");
  assert.ok(ramDiff(oracle, wrongFlag, highHitEntry()), "the wrong-flag twin escaped (high-hit)");
  // Guard/band teeth: a twin that fires on a should-be-no-op arm must diverge from the oracle's no-op.
  assert.ok(ramDiff(oracle, flagOnly, inactiveEntry()), "the guard-ignoring twin escaped (inactive)");
  assert.ok(ramDiff(oracle, flagOnly, lowMissEntry()), "the fire-on-miss twin escaped (low band test)");
  assert.ok(ramDiff(oracle, flagOnly, aboveEntry()), "the fire-on-above twin escaped (window classify)");
  console.log("  TEETH: no-op, flag-only (award), wrong-flag, guard/band/window fires all caught");
});
