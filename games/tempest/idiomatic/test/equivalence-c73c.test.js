// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c73c -- stores two 16-bit differences through the ($74) pointer at cursor $a9,
// low bytes raw, high bytes masked to 5 bits (the second OR'd 0xa0), advancing $a9 by four. Live-out is
// memory only, so each side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH). A leaf:
// the module omits the ROM ret and the seam completes it, so the arms compare RAM (-stack), NOT pc/SP.
// Run: node --test games/tempest/idiomatic/test/equivalence-c73c.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c73c as oracle } from "../../translated/loc_c73c.js";
import { loc_c73c } from "../loc_c73c.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_a9, loc_61, loc_62, loc_63, loc_64, loc_6a, loc_6b, loc_6c, loc_6d, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc73c;
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

// base 0x0300, cursor 0x10; ($1234-$0211)=0x1023 -> 23,10 ; ($0200-$0001)=0x01ff -> ff,a1
const seed = (m) => {
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_75, 0x03);
  m.mem.write8(loc_a9, 0x10);
  m.mem.write8(loc_63, 0x34); m.mem.write8(loc_64, 0x12);
  m.mem.write8(loc_6c, 0x11); m.mem.write8(loc_6d, 0x02);
  m.mem.write8(loc_61, 0x00); m.mem.write8(loc_62, 0x02);
  m.mem.write8(loc_6a, 0x01); m.mem.write8(loc_6b, 0x00);
};

test("CAPTURE: real 0xc73c dispatches -- loc_c73c == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c73c(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: two 16-bit deltas stored at $0310.. and $a9 advanced by four", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c73c(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after stores");
  assert.equal(c.mem.read8(0x0310), 0x23, "delta1 lo");
  assert.equal(c.mem.read8(0x0311), 0x10, "delta1 hi (5-bit)");
  assert.equal(c.mem.read8(0x0312), 0xff, "delta2 lo");
  assert.equal(c.mem.read8(0x0313), 0xa1, "delta2 hi (5-bit | 0xa0)");
  assert.equal(c.mem.read8(loc_a9), 0x14, "$a9 advanced by four");
});

test("TEETH: a twin that skips the 0xa0 on the second high byte diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => {
    const mem = m.mem8;
    let y = mem[loc_a9];
    const base = mem[loc_74] | (mem[loc_75] << 8);
    const d1 = ((mem[loc_63] | (mem[loc_64] << 8)) - (mem[loc_6c] | (mem[loc_6d] << 8))) & 0xffff;
    mem[(base + y) & 0xffff] = d1 & 0xff; y = (y + 1) & 0xff;
    mem[(base + y) & 0xffff] = (d1 >> 8) & 0x1f; y = (y + 1) & 0xff;
    const d2 = ((mem[loc_61] | (mem[loc_62] << 8)) - (mem[loc_6a] | (mem[loc_6b] << 8))) & 0xffff;
    mem[(base + y) & 0xffff] = d2 & 0xff; y = (y + 1) & 0xff;
    mem[(base + y) & 0xffff] = (d2 >> 8) & 0x1f; y = (y + 1) & 0xff; // BUG: dropped | 0xa0
    mem[loc_a9] = y;
  };
  broken(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the RAM diff FAILED to catch the dropped 0xa0");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_c73c, TARGET, m);
  assert.equal(r.placeable, true, `loc_c73c must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
