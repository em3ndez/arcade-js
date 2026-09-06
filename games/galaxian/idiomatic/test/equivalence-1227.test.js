// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1227 — memory-equivalent to the frozen oracle at ROM 0x1227. When the shot gate 0x4208 bit0 is armed,
 * it sweeps the seven object records at 0x42d0 (stride 0x20), running the per-object hit test against the
 * player-shot reference (0x4209/0x420a) on each; a clear gate returns untouched. The oracle wraps each call
 * in an exx bank swap purely to protect the loop counter — no memory effect — so ramDiff over work RAM (the
 * hit flag, the deactivated/scored object cells, the command queue) is the live-out check; the caller reads
 * no registers back. Teeth: no-op, a first-slot-only sweep (misses the last object), and a gate-ignoring
 * sweep on the disabled entry. A plain-ret leaf, so no SP-seam tooth.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { flagPlayerShotHitsOnObjects as cand } from "../flagPlayerShotHitsOnObjects.js";
import { loc_1227 as oracle } from "../../translated/loc_1227.js";
import { flagPlayerShotHitOnObject } from "../flagPlayerShotHitOnObject.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = 0x42d0, STRIDE = 0x20, COUNT = 7;
const GATE = 0x4208;
const REFX = 0x4209, REFY = 0x420a, HITFLAG = 0x420b;
const QHEAD = 0x40a0, QBASE = 0x4000, HEAD = 0xc0;
const LAST = OBJ + (COUNT - 1) * STRIDE; // 0x4390

function armCommon(mem, mm) {
  mm.push16(0x9999);
  mem[REFX] = 0x40; mem[REFY] = 0x40; mem[HITFLAG] = 0;
  mem[QHEAD] = HEAD;
  for (let i = HEAD; i <= 0xff; i++) mem[QBASE + i] = 0x80; // free slots for enqueues
  for (let s = 0; s < COUNT; s++) { const o = OBJ + s * STRIDE; mem[o + 0] = 0; mem[o + 1] = 0; }
}
function plantHit(mem, o) { mem[o + 0] = 0x01; mem[o + 3] = 0x40; mem[o + 4] = 0x40; mem[o + 7] = 0x30; }

// Gate armed; a hit at the first and last slots proves the whole sweep runs.
const enabledEntry = () => craft((mem, mm) => {
  armCommon(mem, mm);
  mem[GATE] |= 1;
  plantHit(mem, OBJ);
  plantHit(mem, LAST);
});
// Gate clear; a hit is planted so an ignore-the-gate mutant diverges.
const disabledEntry = () => craft((mem, mm) => {
  armCommon(mem, mm);
  mem[GATE] &= ~1;
  plantHit(mem, OBJ);
});

test("EQUAL (crafted): loc_1227 == oracle on the enabled sweep and the disabled gate (RAM)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, enabledEntry()), null, "loc_1227 diverged on the enabled sweep");
  assert.equal(ramDiff(oracle, cand, disabledEntry()), null, "loc_1227 diverged on the disabled gate");

  // Positive control: the enabled sweep hits both the first and last object.
  const en = enabledEntry(); en.routines = STUBS; oracle(en);
  assert.equal(en.mem8[HITFLAG], 1, "control: hit flag not raised");
  assert.equal(en.mem8[OBJ + 0], 0, "control: first object not deactivated");
  assert.equal(en.mem8[LAST + 0], 0, "control: last object not deactivated (sweep stopped short)");
  // Positive control: the disabled gate leaves the planted object active.
  const dis = disabledEntry(); dis.routines = STUBS; oracle(dis);
  assert.equal(dis.mem8[HITFLAG], 0, "control: disabled gate raised the hit flag");
  assert.equal(dis.mem8[OBJ + 0], 0x01, "control: disabled gate swept the object");
  console.log("  EQUAL: loc_1227 == oracle (RAM), full seven-object sweep + gate off");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const firstOnly = (m) => flagPlayerShotHitOnObject(m, OBJ);            // misses the last object
  const ignoreGate = (m) => {                                           // sweeps even with the gate clear
    let o = OBJ;
    for (let i = 0; i < COUNT; i++) { flagPlayerShotHitOnObject(m, o); o += STRIDE; }
  };
  assert.ok(ramDiff(oracle, noOp, enabledEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, firstOnly, enabledEntry()), "the first-slot-only twin escaped");
  assert.ok(ramDiff(oracle, ignoreGate, disabledEntry()), "the ignore-the-gate twin escaped");
  console.log("  TEETH: no-op, first-slot-only, ignore-the-gate all caught");
});
