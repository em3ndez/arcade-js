// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1472 — crafted-entry equivalence vs the frozen spawn routine at ROM 0x1472. Incoming HL is the
 * primary trigger pointer, C the spawn code. It spawns a primary object at OBJ_TABLE (0x42d0), then walks
 * three trigger flags (from HL.low - 0x0F, descending) and spawns a secondary object per set flag into
 * successive slots from 0x42f0 (stride 0x20). A budget of two caps the secondaries: after the second
 * spawn the walk ends, so the third flag is never examined even when set. All effects are work RAM
 * (object records + the command queue), so EQUAL asserts ramDiff==null.
 * The entry sets all three flags, so the budget cap is observable: the third flag stays set, its slot
 * stays clear. Teeth prove the primary spawn, the secondary walk, the budget cap, and each slot write are
 * load-bearing. No SP tooth: the routine ends in a plain ret, not a seat-then-dispatch.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_1472 as cand } from "../loc_1472.js";
import { loc_1472 as oracle } from "../../translated/loc_1472.js";
import { activateObjectSlotAndEnqueueSpawn } from "../activateObjectSlotAndEnqueueSpawn.js";
import { spawnSecondaryObjectIntoSlot } from "../spawnSecondaryObjectIntoSlot.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TRIGGER = 0x4179; // primary trigger pointer
const SPAWN_CODE = 5;
const F0 = 0x416a; // secondary trigger block: HL.low(0x79) - 0x0F = 0x6A, descending
const F1 = 0x4169;
const F2 = 0x4168;
const OBJ = 0x42d0; // primary object record
const SLOT0 = 0x42f0; // secondary slots, stride 0x20
const SLOT1 = 0x4310;
const SLOT2 = 0x4330;
const ACTIVE = 0;
const INHERIT = 6;
const SRC_IDX = 7;
const QUEUE_HEAD = 0x40a0;
const QUEUE_BASE = 0x4000;
const HEAD = 0xc0;

const entry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.hl = TRIGGER;
  mm.regs.c = SPAWN_CODE;
  mem[TRIGGER] = 1; // primary trigger set
  mem[F0] = 1; mem[F1] = 1; mem[F2] = 1; // all three secondary triggers set
  for (let i = 0; i < 32; i++) mem[OBJ + i] = 0; // primary record clear
  mem[SLOT0] = 0; mem[SLOT0 + 1] = 0; // secondary slots free (both guard bytes clear)
  mem[SLOT1] = 0; mem[SLOT1 + 1] = 0;
  mem[SLOT2] = 0; mem[SLOT2 + 1] = 0;
  mem[QUEUE_HEAD] = HEAD;
  for (let i = HEAD; i <= 0xff; i++) mem[QUEUE_BASE + i] = 0xff; // arm queue slots free
});

function runOracle(e) { const a = e.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_1472 == oracle spawns primary + two budget-capped secondaries", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_1472 diverged");
  const a = runOracle(entry());
  assert.equal(a.mem8[TRIGGER], 0, "positive control: primary trigger consumed");
  assert.equal(a.mem8[OBJ + ACTIVE], 1, "positive control: primary object activated");
  assert.equal(a.mem8[OBJ + INHERIT], SPAWN_CODE, "positive control: primary stored the spawn code");
  assert.equal(a.mem8[OBJ + SRC_IDX], 0x79, "positive control: primary source index = trigger low byte");
  assert.equal(a.mem8[F0], 0, "positive control: first secondary trigger consumed");
  assert.equal(a.mem8[F1], 0, "positive control: second secondary trigger consumed");
  assert.equal(a.mem8[F2], 1, "positive control: budget cap -> third trigger never examined");
  assert.equal(a.mem8[SLOT0 + ACTIVE], 1, "positive control: first secondary slot alive");
  assert.equal(a.mem8[SLOT0 + SRC_IDX], 0x6a, "positive control: first secondary source index");
  assert.equal(a.mem8[SLOT0 + INHERIT], SPAWN_CODE, "positive control: first secondary inherited field 6");
  assert.equal(a.mem8[SLOT1 + ACTIVE], 1, "positive control: second secondary slot alive");
  assert.equal(a.mem8[SLOT1 + SRC_IDX], 0x69, "positive control: second secondary source index");
  assert.equal(a.mem8[SLOT2 + ACTIVE], 0, "positive control: budget cap -> third slot untouched");
  console.log("  EQUAL: loc_1472 == oracle — primary + two secondaries, third flag/slot spared by the budget cap");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const primaryOnly = (m) => { activateObjectSlotAndEnqueueSpawn(m, TRIGGER, OBJ, SPAWN_CODE); };
  const overSpawn = (m) => { cand(m); spawnSecondaryObjectIntoSlot(m, SLOT2, OBJ, F2); }; // ignores the budget cap
  const scribbleSecondary = (m) => { cand(m); m.mem8[SLOT0 + ACTIVE] ^= 0xff; };
  const underConsume = (m) => { cand(m); m.mem8[F1] = 1; }; // un-consume a secondary trigger

  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, primaryOnly, entry()), "the primary-only twin escaped (secondary walk not load-bearing?)");
  assert.ok(ramDiff(oracle, overSpawn, entry()), "the over-spawn twin escaped (budget cap not load-bearing?)");
  assert.ok(ramDiff(oracle, scribbleSecondary, entry()), "the scribble twin escaped");
  assert.ok(ramDiff(oracle, underConsume, entry()), "the un-consume twin escaped");
  console.log("  TEETH: no-op, primary-only, over-spawn, scribble, un-consume all caught");
});
