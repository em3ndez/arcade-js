// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_01e1 — memory-and-latch-equivalent to the frozen oracle at ROM 0x01e1.
 * Paints a 28-cell strip at the VRAM cursor (0x400b) and advances it a full row, then ticks the dwell
 * tier (0x4009). On the tier's expiry it bumps the sequence step (0x400a), re-arms the dwell cascade
 * (0x4008/0x4009), clears the active-object block (0x4200, via a memory fill), zeroes the direction flag
 * (0x4018), raises a status flag (0x4238), reseeds the object-shadow field (0x4021 stride 2 from a ROM
 * template), and clears the two screen-flip latches (0x7006/0x7007 -> io.flipX/flipY, board latches NOT in
 * the state dump). Paths: FULL (tier expires) and HOLD (tier still counting, early return).
 * EQUAL asserts ramDiff==null on both AND io.flipX/flipY equality on the full path. Teeth: no-op,
 * re-dirty-block, wrong-rearm, skip-flip (io) on full; a gate-ignoring twin on hold.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { fillVramRowThenResetObjectState as cand } from "../fillVramRowThenResetObjectState.js";
import { loc_01e1 as oracle } from "../../translated/loc_01e1.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CURSOR = 0x5200;      // VRAM fill cursor value stored at 0x400b
const FILL_TILE = 16;       // strip fill tile
const CURSOR_END = CURSOR + 32;
const SEQ = 0x400a, DWELL_LO = 0x4008, DWELL_HI = 0x4009;
const BLOCK = 0x4200, DIR = 0x4018, FLAG = 0x4238, SHADOW1 = 0x4023;

const fullEntry = () => craft((mem8, mm) => {
  mm.push16(0x9999);
  mm.mem.write16(0x400b, CURSOR);
  mem8[DWELL_HI] = 1;   // tier dec -> 0 -> full path
  mem8[SEQ] = 0;        // assert bumped to 1
  mem8[FLAG] = 0;       // assert raised to 1
  mem8[BLOCK] = 0xff;   // assert cleared to 0
  mem8[SHADOW1] = 0x77; // assert reseeded to template[1]
  mem8[CURSOR] = 0xaa;  // assert painted
  mm.mem.io.flipX = 1;  // armed so clearing is observable
  mm.mem.io.flipY = 1;
});

const holdEntry = () => craft((mem8, mm) => {
  mm.push16(0x9999);
  mm.mem.write16(0x400b, CURSOR);
  mem8[DWELL_HI] = 5;   // tier dec -> 4 -> hold (early return)
  mem8[SEQ] = 0;
  mem8[FLAG] = 0;
  mem8[CURSOR] = 0xaa;
});

function flipsAfter(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m); return [m.mem.io.flipX, m.mem.io.flipY];
}

test("EQUAL (crafted): loc_01e1 == oracle runs the full sub-state reset on dwell expiry", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, fullEntry()), null, "loc_01e1 diverged on the full path");
  assert.deepEqual(flipsAfter(cand, fullEntry()), flipsAfter(oracle, fullEntry()), "flip-latch writes diverged");
  const a = fullEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[CURSOR], FILL_TILE, "positive control: strip painted");
  assert.equal(a.mem.read16(0x400b), CURSOR_END, "positive control: cursor advanced a row");
  assert.equal(a.mem8[SEQ], 1, "positive control: sequence step bumped");
  assert.equal(a.mem8[DWELL_LO], 64, "positive control: sub-timer re-armed");
  assert.equal(a.mem8[DWELL_HI], 4, "positive control: dwell tier re-armed");
  assert.equal(a.mem8[BLOCK], 0, "positive control: active-object block cleared");
  assert.equal(a.mem8[FLAG], 1, "positive control: status flag raised");
  assert.equal(a.mem8[SHADOW1], 5, "positive control: object-shadow field reseeded");
  assert.deepEqual(flipsAfter(oracle, fullEntry()), [0, 0], "positive control: flip latches cleared");
  console.log("  EQUAL: loc_01e1 == oracle, full reset (RAM + io.flipX/flipY)");
});

test("EQUAL (crafted): loc_01e1 == oracle holds while the dwell tier is still counting", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, holdEntry()), null, "loc_01e1 diverged on the hold path");
  const a = holdEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[CURSOR], FILL_TILE, "positive control: strip still painted on the hold path");
  assert.equal(a.mem.read16(0x400b), CURSOR_END, "positive control: cursor still advanced");
  assert.equal(a.mem8[DWELL_HI], 4, "positive control: tier decremented");
  assert.equal(a.mem8[SEQ], 0, "positive control: sequence NOT bumped on hold");
  assert.equal(a.mem8[FLAG], 0, "positive control: status flag NOT raised on hold");
  console.log("  EQUAL: loc_01e1 == oracle, hold path -> strip only, no reset");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const redirtyBlock = (m) => { cand(m); m.mem8[BLOCK] = 0xff; };
  const wrongReArm = (m) => { cand(m); m.mem8[DWELL_LO] = 63; };
  const skipFlip = (m) => { cand(m); m.mem.io.flipX = 1; };
  const raiseOnHold = (m) => { cand(m); m.mem8[FLAG] = 1; };
  assert.ok(ramDiff(oracle, noOp, fullEntry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, redirtyBlock, fullEntry()), "re-dirty-block twin escaped");
  assert.ok(ramDiff(oracle, wrongReArm, fullEntry()), "wrong-rearm twin escaped");
  assert.notEqual(flipsAfter(skipFlip, fullEntry())[0], flipsAfter(oracle, fullEntry())[0], "skip-flip twin escaped (io)");
  assert.ok(ramDiff(oracle, raiseOnHold, holdEntry()), "gate-ignoring twin escaped on the hold path");
  console.log("  TEETH: no-op, re-dirty-block, wrong-rearm, skip-flip (io), hold-gate all caught");
});
