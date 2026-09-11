// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a5cb (ROM 0xa5cb-0xa617) -- sets $00=0x20, $0106|=0x80, clears
// $0104/$0107/$5c/$0123, $0105=2, counts nonzero $03ac..$03bb into $0123; if that count is nonzero and
// $9f<7 loads the param block ($04=0x1e,$00=0x0a,$02=0x20,$0123=0x80); finally $0125=0xff. Live-out is
// memory only, so each side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH).
// A leaf: the module omits the ROM ret and the seam completes it.
// Run: node --test games/tempest/idiomatic/test/equivalence-a5cb.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a5cb as oracle } from "../../translated/loc_a5cb.js";
import { loc_a5cb } from "../loc_a5cb.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_0, loc_2, loc_4, loc_9f, loc_106, loc_123, loc_125, loc_3ac } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa5cb;
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

test("CAPTURE: real 0xa5cb dispatches -- loc_a5cb == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a5cb(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: live entries + $9f<7 -- param block loads (RAM equal)", () => {
  const seed = (m) => {
    m.mem.write8(loc_106, 0x01);
    m.mem.write8(loc_9f, 0x03);
    for (let i = 0; i < 16; i++) m.mem.write8((loc_3ac + i) & 0xffff, (i === 4 || i === 9) ? 0x01 : 0x00);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_a5cb(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after init");
  assert.equal(c.mem.read8(loc_106) & 0x80, 0x80, "$0106 bit7 set");
  assert.equal(c.mem.read8(loc_4), 0x1e, "param block $04 loaded");
  assert.equal(c.mem.read8(loc_0), 0x0a, "param block $00 loaded");
  assert.equal(c.mem.read8(loc_2), 0x20, "param block $02 loaded");
  assert.equal(c.mem.read8(loc_123), 0x80, "param block $0123 loaded");
  assert.equal(c.mem.read8(loc_125), 0xff, "$0125 marked ready");
});

test("CRAFTED: $9f>=7 -- param block skipped, count kept (RAM equal)", () => {
  const seed = (m) => {
    m.mem.write8(loc_106, 0x00);
    m.mem.write8(loc_9f, 0x09);
    for (let i = 0; i < 16; i++) m.mem.write8((loc_3ac + i) & 0xffff, i < 3 ? 0x01 : 0x00);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_a5cb(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after init");
  assert.equal(c.mem.read8(loc_123), 0x03, "count kept (param block skipped)");
  assert.equal(c.mem.read8(loc_0), 0x20, "$00 stays at 0x20 (block skipped)");
  assert.equal(c.mem.read8(loc_125), 0xff, "$0125 marked ready regardless");
});

test("TEETH: a twin that leaves $0125 untouched diverges from the oracle", () => {
  const seed = (m) => {
    m.mem.write8(loc_106, 0x01);
    m.mem.write8(loc_9f, 0x03);
    m.mem.write8(loc_125, 0x11); // non-default sentinel so the missing store bites
    for (let i = 0; i < 16; i++) m.mem.write8((loc_3ac + i) & 0xffff, i === 4 ? 0x01 : 0x00);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => {
    const mem = m.mem8;
    mem[0x00] = 0x20; mem[0x0106] = mem[0x0106] | 0x80;
    mem[0x0104] = 0; mem[0x0107] = 0; mem[0x5c] = 0; mem[0x0123] = 0; mem[0x0105] = 0x02;
    for (let x = 0x0f; x >= 0; x--) if (mem[(0x03ac + x) & 0xffff] !== 0) mem[0x0123] = (mem[0x0123] + 1) & 0xff;
    if (mem[0x0123] !== 0 && mem[0x9f] < 0x07) {
      mem[0x04] = 0x1e; mem[0x00] = 0x0a; mem[0x02] = 0x20; mem[0x0123] = 0x80;
    }
    // BUG: never writes $0125 = 0xff
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped $0125 store");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_a5cb, TARGET, m);
  assert.equal(r.placeable, true, `loc_a5cb must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
