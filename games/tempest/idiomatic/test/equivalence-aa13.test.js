// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_aa13 (ROM 0xaa13-0xaa59) -- chooses a length from flags, points the copy
// target at page $2f60, copies that many source bytes down into it, on the negative-flag path emits a
// packed counter via loc_af77, then restores the low target byte and tail-jmps loc_df09. The idiomatic
// side dissolves jsr $af77 (into loc_af77(m, $9f+1)) and the jmp $df09 tail (into loc_df09(m)). Live-out
// is memory only (pure tail-caller into the header emitter, reads no register after), so each arm compares
// RAM (dumpState minus STACK_SCRATCH). ROM source/count tables live at $ce66/$cde6.
// Run: node --test games/tempest/idiomatic/test/equivalence-aa13.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_aa13 as oracle } from "../../translated/loc_aa13.js";
import { loc_aa13 } from "../loc_aa13.js";
import { loc_df09 } from "../loc_df09.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { STACK_SCRATCH, loc_3e, loc_5, loc_43, loc_44, loc_45, loc_74, loc_75, loc_9f, loc_ce66, loc_cde6, loc_2f60 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xaa13;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

// Find an index whose ROM count byte keeps the copy inside diffed vector RAM.
function pickSmallIndex(m) {
  for (let i = 0; i < 128; i++) if (m.mem.read8(u16(loc_ce66 + i)) < 0x60) return i;
  return 0;
}

test("CAPTURE: real 0xaa13 dispatches -- loc_aa13 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_aa13(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED (positive path, no af77): copy down into $2f60 -- RAM equal", () => {
  const probe = new Machine(ROM, OPTS);
  const idx = pickSmallIndex(probe);
  const seed = (m) => {
    m.mem.write8(loc_5, 0x00);           // positive -> bmi not taken, bpl taken (skip af77)
    m.mem.write8(loc_43, 0x00); m.mem.write8(loc_44, 0x00); m.mem.write8(loc_45, 0x00); // X stays $3e
    m.mem.write8(loc_3e, idx);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_aa13(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after copy (no af77)");
});

test("CRAFTED (negative path, af77): counter emit + copy -- RAM equal", () => {
  const probe = new Machine(ROM, OPTS);
  const idx = pickSmallIndex(probe);
  const seed = (m) => {
    m.mem.write8(loc_5, 0x80);   // negative -> bmi taken (X stays $3e), bpl not taken (call af77)
    m.mem.write8(loc_3e, idx);
    m.mem.write8(loc_9f, 0x2a);  // af77 input basis
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_aa13(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after copy + af77 emit");
});

test("TEETH: a twin skipping the final y=0 copy diverges from the oracle", () => {
  const probe = new Machine(ROM, OPTS);
  const idx = pickSmallIndex(probe);
  const seed = (m) => {
    m.mem.write8(loc_5, 0x00);
    m.mem.write8(loc_43, 0x00); m.mem.write8(loc_44, 0x00); m.mem.write8(loc_45, 0x00);
    m.mem.write8(loc_3e, idx);
    // The final y=0 source byte ($cde6[0]) is 0x00 and the dest ($2f60) starts at 0x00, so
    // skipping that copy is invisible on a bare seed. Pre-load the y=0 dest with a sentinel
    // that differs from $cde6[0]: the oracle overwrites it to 0x00, the twin leaves it.
    m.mem.write8(loc_2f60, 0x5a);
  };
  const o = new Machine(ROM, OPTS); seed(o); oracle(o);
  const c = new Machine(ROM, OPTS); seed(c);
  const brokenAa13 = (m) => {
    const { mem8, mem16 } = m;
    let x = mem8[loc_3e];
    if (!(mem8[loc_5] & 0x80)) {
      if ((mem8[loc_43] | mem8[loc_44] | mem8[loc_45]) !== 0) x = 0x01;
    }
    mem8[loc_74] = 0x60;
    mem8[loc_75] = 0x2f;
    let y = mem8[u16(loc_ce66 + x)];
    const savedSum = (y + mem8[loc_74] + 1) & 0xff;
    do {
      mem8[u16(mem16[loc_74] + y)] = mem8[u16(loc_cde6 + y)];
      y = (y - 1) & 0xff;
    } while (y !== 0);
    // BUG: skips the final y=0 copy
    mem8[loc_74] = savedSum;
    return loc_df09(m);
  };
  brokenAa13(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped final copy");
});

test("SP-TOOTH: the omitted-ret tail-caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_aa13, TARGET, m);
  assert.equal(r.placeable, true, `loc_aa13 must be seam-placeable; got: ${r.error}`);
});
