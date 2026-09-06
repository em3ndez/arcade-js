// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b0b — crafted-entry equivalence for the player-shot vs formation collision leaf.
 * All live-outs are work-RAM: the cleared grid cell (0x41xx), the hit record (0x420b, 0x42b1-0x42b4),
 * and the two command-queue words (0x40xx head + slots) — every one in the state dump, so ramDiff sees
 * them; there is no register or io latch live-out (the caller chains the next call and reads none), so a
 * memory-only check is complete here. Three paths exercised:
 *   - ELSE-branch hit: grid index >= 0x50 -> second word carries a derived column code.
 *   - C-branch hit: grid index < 0x50 -> second word column code is 0.
 *   - GATE CLOSED: shot not armed -> the routine bails and touches nothing.
 * Teeth: mutant twins (candidate + one corrupted cell) on each written live-out, plus a no-op and a
 * gate-ignoring twin. The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { flagPlayerShotHitOnFormation as cand } from "../flagPlayerShotHitOnFormation.js";
import { loc_0b0b as oracle } from "../../translated/loc_0b0b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const GATE = 0x4208;      // bit0: shot armed
const SHOT_Y = 0x4209;    // shot vertical position
const SHOT_X = 0x420a;    // shot horizontal field
const ANCHOR = 0x420e;    // formation anchor
const HIT_FLAG = 0x420b;
const REC_FLAG = 0x42b1;
const REC_PHASE = 0x42b2;
const REC_POS = 0x42b3;   // + 0x42b4 (position word copied from SHOT_Y/SHOT_X)
const GRID = 0x4100;
const QUEUE = 0x4000;
const HEAD = 0x40a0;

// ELSE-branch: Y 0x27 bands to the top row -> grid index 0x71 (>= 0x50); dx 0x18 sits in the window.
const elseHit = () => craft((mem, mm) => {
  mm.push16(0x9999);          // return address for the oracle's ret/tail-call
  mem[GATE] |= 0x01;          // arm the shot
  mem[SHOT_Y] = 0x27;
  mem[SHOT_X] = 0x38;
  mem[ANCHOR] = 0x20;         // dx = 0x18
  mem[GRID + 0x71] |= 0x01;   // live alien at the hit cell
  mem[HEAD] = 0xc0;           // write-head at the floor
  mem[QUEUE + 0xc0] |= 0x80;  // first slot free
  mem[QUEUE + 0xc2] |= 0x80;  // second slot free
});

// C-branch: Y 0x4b bands three rows down -> grid index 0x41 (< 0x50) -> second column code 0.
const cHit = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] |= 0x01;
  mem[SHOT_Y] = 0x4b;
  mem[SHOT_X] = 0x38;
  mem[ANCHOR] = 0x20;         // dx = 0x18
  mem[GRID + 0x41] |= 0x01;
  mem[HEAD] = 0xc0;
  mem[QUEUE + 0xc0] |= 0x80;
  mem[QUEUE + 0xc2] |= 0x80;
});

// Gate closed: same board but the shot is not armed -> the routine must bail.
const gateClosed = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] &= ~0x01;
  mem[SHOT_Y] = 0x27;
  mem[SHOT_X] = 0x38;
  mem[ANCHOR] = 0x20;
  mem[GRID + 0x71] |= 0x01;
});

test("EQUAL (crafted): loc_0b0b == oracle on the else-branch hit", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, elseHit()), null, "else-branch hit diverged");
  // positive control: the oracle really clears the alien, stamps the record and fills the queue.
  const a = elseHit(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[GRID + 0x71] & 0x01, 0, "oracle did not clear the hit cell");
  assert.equal(a.mem8[HIT_FLAG], 1, "oracle did not raise the hit flag");
  assert.equal(a.mem8[REC_FLAG], 1, "oracle did not stamp the record flag");
  assert.equal(a.mem8[REC_PHASE], 0, "oracle did not zero the record phase");
  assert.equal(a.mem8[REC_POS], 0x27, "record position low != shot Y");
  assert.equal(a.mem8[REC_POS + 1], 0x38, "record position high != shot X");
  assert.equal(a.mem8[QUEUE + 0xc0], 0x01, "first queue word hi != 1");
  assert.equal(a.mem8[QUEUE + 0xc1], 0x71, "first queue word lo != grid index");
  assert.equal(a.mem8[QUEUE + 0xc2], 0x03, "second queue word hi != 3");
  assert.equal(a.mem8[QUEUE + 0xc3], 0x03, "second queue word lo != derived code");
  assert.equal(a.mem8[HEAD], 0xc4, "write-head not advanced past both words");
  console.log("  EQUAL: else-branch hit == oracle (grid clear, record, two queue words)");
});

test("EQUAL (crafted): loc_0b0b == oracle on the c-branch hit", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, cHit()), null, "c-branch hit diverged");
  const a = cHit(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[GRID + 0x41] & 0x01, 0, "oracle did not clear the hit cell");
  assert.equal(a.mem8[QUEUE + 0xc0], 0x01, "first queue word hi != 1");
  assert.equal(a.mem8[QUEUE + 0xc1], 0x41, "first queue word lo != grid index");
  assert.equal(a.mem8[QUEUE + 0xc2], 0x03, "second queue word hi != 3");
  assert.equal(a.mem8[QUEUE + 0xc3], 0x00, "second queue word lo != 0 (c-branch)");
  console.log("  EQUAL: c-branch hit == oracle (index < 0x50 -> column code 0)");
});

test("EQUAL (crafted): loc_0b0b == oracle bails on the closed gate", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, gateClosed()), null, "gate-closed path diverged");
  const a = gateClosed(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[GRID + 0x71] & 0x01, 1, "positive control: gate closed -> alien untouched");
  console.log("  EQUAL: gate closed == oracle (no writes)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongFlag = (m) => { cand(m); m.mem8[HIT_FLAG] ^= 1; };        // corrupts the hit flag
  const skipClear = (m) => { cand(m); m.mem8[GRID + 0x71] |= 0x01; };  // re-marks the cleared cell
  const wrongPos = (m) => { cand(m); m.mem8[REC_POS] ^= 0xff; };       // corrupts the copied position
  const wrongQueue = (m) => { cand(m); m.mem8[QUEUE + 0xc2] ^= 0xff; };// corrupts the 2nd queue word
  const ignoreGate = (m) => { m.mem8[GRID + 0x71] = 0; };             // clears an alien the closed gate must keep

  assert.ok(ramDiff(oracle, noOp, elseHit()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongFlag, elseHit()), "the wrong-flag twin escaped");
  assert.ok(ramDiff(oracle, skipClear, elseHit()), "the skip-clear twin escaped");
  assert.ok(ramDiff(oracle, wrongPos, elseHit()), "the wrong-position twin escaped");
  assert.ok(ramDiff(oracle, wrongQueue, elseHit()), "the wrong-queue twin escaped");
  assert.ok(ramDiff(oracle, ignoreGate, gateClosed()), "the gate-ignoring twin escaped");
  console.log("  TEETH: no-op, wrong-flag, skip-clear, wrong-position, wrong-queue, gate-ignoring all caught");
});
