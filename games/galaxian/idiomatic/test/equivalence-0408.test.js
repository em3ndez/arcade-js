// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0408 — memory-equivalent to the frozen oracle at ROM 0x0408 (a sequence state-table entry). It
 * seeds the interleaved OBJRAM shadow field from a ROM template (dissolved call), zero-fills three
 * work-RAM spans via the fill primitive (dissolved rst-10s), clears two status cells, seeds the 16-bit
 * VRAM cursor, arms the dwell tier, and bumps the sequence-state selector. Every effect is work-RAM, so
 * the live-out is RAM only (this is a void dispatch handler; its trailing registers are not consumed).
 * The seed pre-pokes the fill spans and status cells with sentinels so each write is observable. Teeth:
 * no-op, no-state-bump, wrong-VRAM-cursor, and a re-dirtied status cell.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { resetObjectRamAndAdvanceSequence as cand } from "../resetObjectRamAndAdvanceSequence.js";
import { loc_0408 as oracle } from "../../translated/loc_0408.js";

const SPRITE_SHADOW = 0x4060;
const OBJ_RECORDS = 0x4260;
const OBJ_RECORDS_TAIL = 0x4360;
const STATUS_A = 0x4238;
const SCROLL_ENABLE = 0x40b0;
const VRAM_PTR = 0x400b;
const DWELL = 0x4009;
const STATE = 0x400a;
const SHADOW_FIELD = 0x4021;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const entry = () => craft((mem8, m) => {
  m.push16(0x9999);
  // Sentinel the fill spans and the shadow field so the clears/seed are observable.
  for (const off of [0, 30, 63]) mem8[SPRITE_SHADOW + off] = 0xaa;
  for (const off of [0, 128, 255]) mem8[OBJ_RECORDS + off] = 0xbb;
  for (const off of [0, 40, 79]) mem8[OBJ_RECORDS_TAIL + off] = 0xcc;
  for (const off of [0, 30, 62]) mem8[SHADOW_FIELD + off] = 0xdd; // stride-2 field cells
  mem8[STATUS_A] = 0x55;
  mem8[SCROLL_ENABLE] = 0x66;
  mem8[STATE] = 0x00;
});

test("EQUAL (crafted): loc_0408 == oracle sets up the state (RAM)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_0408 diverged from the oracle");
  // positive control: the oracle really performs its setup.
  const a = entry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[STATUS_A], 0, "positive control: status cell cleared");
  assert.equal(a.mem8[SCROLL_ENABLE], 0, "positive control: scroll flag cleared");
  assert.equal(a.mem8[VRAM_PTR], 0x02, "positive control: VRAM cursor low = 0x02");
  assert.equal(a.mem8[VRAM_PTR + 1], 0x50, "positive control: VRAM cursor high = 0x50");
  assert.equal(a.mem8[DWELL], 16, "positive control: dwell tier armed to 16");
  assert.equal(a.mem8[STATE], 1, "positive control: sequence state bumped 0->1");
  assert.notEqual(a.mem8[SHADOW_FIELD], 0xdd, "positive control: shadow field reseeded from the template");
  assert.equal(a.mem8[OBJ_RECORDS + 255], 0, "positive control: full-page span zeroed");
  assert.equal(a.mem8[OBJ_RECORDS_TAIL + 79], 0, "positive control: tail span zeroed");
  console.log("  EQUAL: loc_0408 == oracle (RAM), full state-entry setup performed");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noStateBump = (m) => { cand(m); m.mem8[STATE] = (m.mem8[STATE] - 1) & 0xff; };
  const wrongVramPtr = (m) => { cand(m); m.mem8[VRAM_PTR] = 0x00; };
  const redirtyStatus = (m) => { cand(m); m.mem8[STATUS_A] = 0x55; };
  const shortTailFill = (m) => { cand(m); m.mem8[OBJ_RECORDS_TAIL + 79] = 0xcc; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, noStateBump, entry()), "the no-state-bump twin escaped");
  assert.ok(ramDiff(oracle, wrongVramPtr, entry()), "the wrong-VRAM-cursor twin escaped");
  assert.ok(ramDiff(oracle, redirtyStatus, entry()), "the re-dirtied-status twin escaped");
  assert.ok(ramDiff(oracle, shortTailFill, entry()), "the short-tail-fill twin escaped");
  console.log("  TEETH: no-op, no-state-bump, wrong-VRAM-cursor, re-dirtied-status, short-tail-fill all caught");
});
