// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loadPaletteRecordPair (ROM 0x2656) -- reads a 3-byte record from the ROM table
// at 0x2676 (indexed by X) and fans it into two palette-RAM triples: 0x140d/0e/0f = (b1,b2,b0) and
// 0x1405/06/07 = (b0,b2,b1). Palette RAM (0x1400-0x140F) is WRITE-only on the bus and is NOT part of
// dumpState (the video layer reads it via mem.paletteRam), so the whole effect is invisible to the RAM
// diff -- the arms read paletteRam back directly. The oracle's balanced pha/pla lands one dead byte on the
// stack page (0x0100|SP), excluded alongside STACK_SCRATCH. Clean omitted-ret leaf, seam-placeable.
// Run: node --test games/centiped/idiomatic/test/equivalence-2656.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2656 as oracle } from "../../translated/loc_2656.js";
import { loadPaletteRecordPair } from "../loadPaletteRecordPair.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH, PALETTE_RECORD_TABLE,
  loc_1405, loc_1406, loc_1407, loc_140d, loc_140e, loc_140f,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x2656;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

// Palette RAM is not in dumpState -- compare it directly (index = cell & 0x0f).
const PAL_CELLS = [loc_1405, loc_1406, loc_1407, loc_140d, loc_140e, loc_140f];
const palDiff = (ma, mb) => {
  for (const cell of PAL_CELLS) {
    const i = cell & 0x0f;
    if (ma.mem.paletteRam[i] !== mb.mem.paletteRam[i]) {
      return { cell, a: ma.mem.paletteRam[i], b: mb.mem.paletteRam[i] };
    }
  }
  return null;
};

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  new Machine(ROM, { overrides: snap }).runFrames(maxFrames);
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 1500) : [];

// A pristine crafted machine with a real 6502 caller-return seated in dead scratch (so the oracle's pha
// byte and its RTS pop stay in the excluded region) and record index X = idx.
function craft(idx) {
  const m = new Machine(ROM);
  m.regs.s = 0xfb;
  m.push16(0x2000); // JSR-style return (ret-1): s -> 0xf9, word at 0x01fa/0x01fb (both in STACK_SCRATCH)
  m.regs.x = idx & 0xff;
  return m;
}

test("CAPTURE: real 0x2656 dispatches -- loadPaletteRecordPair == oracle (RAM -stack, and palette RAM)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    const phaAddr = 0x0100 | o.regs.s; // the oracle's single pha byte lands here
    const capExclude = (a) => a != null && (a === phaAddr || inDeadStack(a));
    const capDiff = (ma, mb) =>
      firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), capExclude);
    oracle(o); loadPaletteRecordPair(c);
    assert.equal(capDiff(o, c), null);
    assert.equal(palDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: several record indices fan out to both palette triples in the fixed permutation", () => {
  for (const idx of [0x00, 0x03, 0x06, 0x09, 0x0c, 0x2a]) {
    const o = craft(idx), c = craft(idx);
    oracle(o); loadPaletteRecordPair(c);
    const label = `x=0x${idx.toString(16)}`;
    assert.equal(ramDiff(o, c), null, `RAM (-stack) ${label}`);
    assert.equal(palDiff(o, c), null, `palette ${label}`);
    // The permutation of the ROM record [b0,b1,b2]: A=(b1,b2,b0), B=(b0,b2,b1).
    const base = (PALETTE_RECORD_TABLE + idx) & 0xffff;
    const b0 = c.mem.read8(base), b1 = c.mem.read8((base + 1) & 0xffff), b2 = c.mem.read8((base + 2) & 0xffff);
    assert.equal(c.mem.paletteRam[loc_140d & 0x0f], b1, `140d ${label}`);
    assert.equal(c.mem.paletteRam[loc_140e & 0x0f], b2, `140e ${label}`);
    assert.equal(c.mem.paletteRam[loc_140f & 0x0f], b0, `140f ${label}`);
    assert.equal(c.mem.paletteRam[loc_1405 & 0x0f], b0, `1405 ${label}`);
    assert.equal(c.mem.paletteRam[loc_1406 & 0x0f], b2, `1406 ${label}`);
    assert.equal(c.mem.paletteRam[loc_1407 & 0x0f], b1, `1407 ${label}`);
  }
});

test("TEETH: a twin that miswrites one palette entry is caught by the palette read-back", () => {
  // The RAM diff is BLIND to palette (not in dumpState); only palDiff can catch this. Corrupt loc_140d
  // with ^0xff so the divergence is guaranteed regardless of the record's actual bytes.
  const broken = (m, x = m.regs.x) => {
    const base = (PALETTE_RECORD_TABLE + (x & 0xff)) & 0xffff;
    const b0 = m.mem.read8(base), b1 = m.mem.read8((base + 1) & 0xffff), b2 = m.mem.read8((base + 2) & 0xffff);
    m.mem.write8(loc_140e, b2); m.mem.write8(loc_1406, b2);
    m.mem.write8(loc_140f, b0); m.mem.write8(loc_1405, b0);
    m.mem.write8(loc_140d, b1 ^ 0xff); // BUG
    m.mem.write8(loc_1407, b1);
  };
  const o = craft(0x03), c = craft(0x03);
  oracle(o); broken(c);
  assert.notEqual(palDiff(o, c), null, "palette read-back FAILED to catch a miswritten entry");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const r = seamPlaceable(withOmittedRet, loadPaletteRecordPair, TARGET, craft(0x00));
  assert.equal(r.placeable, true, `loadPaletteRecordPair must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
