// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_11e0 — crafted-entry equivalence vs the frozen slot-claim-and-fill handler.
 * The live-out is RAM: the first free 5-byte slot in the table at 0x4260 is marked active and populated
 * from the IX object (entry[1]=Y, entry[3]=X, entry[4]=scaled X velocity via loc_1218; entry[2] is left
 * untouched), and RNG_SEED is advanced by the scaler. A full table writes nothing. A post-attract seed is
 * cloned; the table, the IX object, the target-X anchor and RNG_SEED are poked, with a sentinel at
 * entry[2]. EQUAL asserts ramDiff==null across fill (positive + mirrored), full-table, and second-slot
 * cases; a non-vacuous control checks the oracle really fills and advances RNG. Teeth: no-op, skipped
 * active mark, a stray entry[2] write, no-mirror, and fill-when-full all escape.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_bootSetup.js";
import { loc_11e0 as cand } from "../loc_11e0.js";
import { loc_11e0 as oracle } from "../../translated/loc_11e0.js";
import { loc_1218 } from "../loc_1218.js";

const BASE = 0x4260; // table base
const STRIDE = 5;
const REF_X = 0x4202;
const RNG_SEED = 0x401e;
const IX = 0x4300;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// All 14 slots free; entry[2] of slot 0 sentineled to prove it stays untouched.
function freeTable(objY, objX, refX, seed) {
  return craft((mem, m) => {
    m.push16(0x9999);
    m.regs.ix = IX;
    mem[IX + 3] = objY; mem[IX + 4] = objX; mem[REF_X] = refX; mem[RNG_SEED] = seed;
    for (let k = 0; k < 14; k++) mem[BASE + STRIDE * k] = 0x00;
    mem[BASE + 2] = 0x77; // slot-0 entry[2] sentinel
  });
}
// All 14 slots active (table full); slot-0 entry bytes sentineled so a wrongful fill is visible.
function fullTable(objY, objX, refX, seed) {
  return craft((mem, m) => {
    m.push16(0x9999);
    m.regs.ix = IX;
    mem[IX + 3] = objY; mem[IX + 4] = objX; mem[REF_X] = refX; mem[RNG_SEED] = seed;
    for (let k = 0; k < 14; k++) { mem[BASE + STRIDE * k] = 0x01; mem[BASE + STRIDE * k + 1] = 0x00; mem[BASE + STRIDE * k + 4] = 0x00; }
  });
}
// Slot 0 active, the rest free -> the fill lands in slot 1.
function secondSlot(objY, objX, refX, seed) {
  return craft((mem, m) => {
    m.push16(0x9999);
    m.regs.ix = IX;
    mem[IX + 3] = objY; mem[IX + 4] = objX; mem[REF_X] = refX; mem[RNG_SEED] = seed;
    for (let k = 0; k < 14; k++) mem[BASE + STRIDE * k] = 0x00;
    mem[BASE] = 0x01;
  });
}

test("EQUAL (crafted): loc_11e0 == oracle on fill / full / second-slot", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, freeTable(0x30, 0x40, 0x50, 0x37)), null, "positive-delta fill diverged");
  assert.equal(ramDiff(oracle, cand, freeTable(0x30, 0x40, 0x30, 0x37)), null, "mirrored-delta fill diverged");
  assert.equal(ramDiff(oracle, cand, fullTable(0x30, 0x40, 0x50, 0x37)), null, "full-table (no write) diverged");
  assert.equal(ramDiff(oracle, cand, secondSlot(0x30, 0x40, 0x50, 0x37)), null, "second-slot fill diverged");

  // Non-vacuous: the oracle really fills slot 0 and advances RNG; entry[2] stays untouched.
  const a = freeTable(0x30, 0x40, 0x50, 0x37); oracle(a);
  assert.equal(a.mem8[BASE + 0], 0x01, "control: entry[0] active");
  assert.equal(a.mem8[BASE + 1], 0x30, "control: entry[1] = sprite Y");
  assert.equal(a.mem8[BASE + 2], 0x77, "control: entry[2] untouched");
  assert.equal(a.mem8[BASE + 3], 0x40, "control: entry[3] = sprite X");
  assert.equal(a.mem8[BASE + 4], 0x25, "control: entry[4] = scaled velocity");
  assert.equal(a.mem8[RNG_SEED], 0x14, "control: RNG advanced by the scaler");
  console.log("  EQUAL: loc_11e0 == oracle on fill/full/second-slot; entry[2] preserved");
});

test("TEETH: broken twins are caught in RAM", { skip }, () => {
  // A faithful fill with one knob flipped.
  function fillTwin(opts = {}) {
    return (m) => {
      const { mem8 } = m; const obj = m.regs.ix;
      let slot = -1;
      for (let i = 0; i < 14; i++) { const p = BASE + i * STRIDE; if (opts.ignoreActive || !(mem8[p] & 0x01)) { slot = p; break; } }
      if (slot < 0) return;
      if (!opts.skipMark) mem8[slot] = 0x01;
      mem8[slot + 1] = mem8[obj + 3];
      const vertical = (0xf0 - mem8[slot + 1]) & 0xff;
      if (opts.touch2) mem8[slot + 2] = 0x99;
      mem8[slot + 3] = mem8[obj + 4];
      const h = mem8[REF_X] - mem8[obj + 4];
      if (h < 0) { const sc = loc_1218(m, (-h) & 0xff, vertical); mem8[slot + 4] = opts.noMirror ? sc : (-sc) & 0xff; }
      else { mem8[slot + 4] = loc_1218(m, h, vertical); }
    };
  }
  const noOp = () => {};

  assert.ok(ramDiff(oracle, noOp, freeTable(0x30, 0x40, 0x50, 0x37)), "no-op twin escaped");
  assert.ok(ramDiff(oracle, fillTwin({ skipMark: true }), freeTable(0x30, 0x40, 0x50, 0x37)), "skip-active-mark twin escaped");
  assert.ok(ramDiff(oracle, fillTwin({ touch2: true }), freeTable(0x30, 0x40, 0x50, 0x37)), "stray entry[2] write twin escaped");
  assert.ok(ramDiff(oracle, fillTwin({ noMirror: true }), freeTable(0x30, 0x40, 0x30, 0x37)), "no-mirror twin escaped");
  assert.ok(ramDiff(oracle, fillTwin({ ignoreActive: true }), fullTable(0x30, 0x40, 0x50, 0x37)), "fill-when-full twin escaped");
  console.log("  TEETH: no-op, skip-mark, stray entry[2], no-mirror, fill-when-full all caught in RAM");
});
