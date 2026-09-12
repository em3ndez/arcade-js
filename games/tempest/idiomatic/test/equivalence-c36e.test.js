// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c36e (ROM 0xc36e-0xc3b9) -- when the gate byte (A) is zero, seats four indexed
// record fields ($61-$64) from the $031a/$032a/$033a/$034a,Y tables, emits the header via loc_c772, caches
// its cursor to $b0/$b1, then draws one record per pass through loc_c423, bumping the $37 index by 0x10 on
// each low-nibble saturation. The idiomatic side dissolves the two jsr into direct loc_c772(m, 0x61) and
// loc_c423(m) calls (c423 reads its index from $37 in RAM, so no register thread). Live-out is memory only,
// so each arm compares RAM (dumpState minus STACK_SCRATCH); registers are NOT asserted.
// Run: node --test games/tempest/idiomatic/test/equivalence-c36e.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c36e as oracle } from "../../translated/loc_c36e.js";
import { loc_c36e } from "../loc_c36e.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { loc_c772 } from "../loc_c772.js";
import { loc_c423 } from "../loc_c423.js";
import {
  STACK_SCRATCH, loc_37, loc_38, loc_61, loc_73, loc_74, loc_b0, loc_b1,
  loc_111, loc_31a, loc_32a, loc_33a, loc_34a,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc36e;
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

test("CAPTURE: real 0xc36e dispatches -- loc_c36e == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c36e(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// A=0 so the body runs; distinct Y and source-table entries; $0111=0 -> full 0x0f count;
// ($74) cursor into vector RAM so the emitted records land in diffed RAM.
function seedRun(m) {
  m.regs.a = 0x00; m.regs.y = 0x03; m.regs.setNZ(m.regs.a);
  for (const b of [loc_31a, loc_32a, loc_33a, loc_34a]) {
    for (let i = 0; i < 8; i++) m.mem.write8(u16(b + i), (b + i) & 0xff);
  }
  m.mem.write8(loc_111, 0x00);
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x20); // ($74) -> 0x2000
}

test("CRAFTED: gate open (A=0) -- loc_c36e == oracle in RAM, fields + cursor seated", () => {
  const o = new Machine(ROM, OPTS); seedRun(o);
  const c = new Machine(ROM, OPTS); seedRun(c);
  oracle(o); loc_c36e(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after header + record draws");
  assert.equal(c.mem.read8(loc_61), c.mem.read8(u16(loc_32a + 3)), "$61 = [$032a+Y]");
  assert.equal(c.mem.read8(loc_73), 0xc0, "$73 constant seated");
  assert.equal(c.mem.read8(loc_38), 0xff, "record loop ran the counter to 0xff");
});

test("CRAFTED: gate closed (A!=0) -- both skip, RAM unchanged and equal", () => {
  const o = new Machine(ROM, OPTS); seedRun(o); o.regs.a = 0x01; o.regs.setNZ(0x01);
  const c = new Machine(ROM, OPTS); seedRun(c); c.regs.a = 0x01; c.regs.setNZ(0x01);
  oracle(o); loc_c36e(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the skip path");
  assert.equal(c.mem.read8(loc_73), o.mem.read8(loc_73), "no write on skip");
});

test("TEETH: a twin that runs the body regardless of the gate diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedRun(o); o.regs.a = 0x01; o.regs.setNZ(0x01); oracle(o); // gate closed -> oracle skips
  const c = new Machine(ROM, OPTS); seedRun(c); c.regs.a = 0x01; c.regs.setNZ(0x01);
  const brokenGate = (m, a = m.regs.a, y = m.regs.y) => {
    const mem8 = m.mem8;
    // BUG: ignores the gate and always draws the header
    mem8[loc_37] = y;
    mem8[loc_61] = mem8[u16(loc_32a + y)];
    loc_c772(m, 0x61);
  };
  brokenGate(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the ignored gate");
});

test("TEETH: a twin that skips the record loop diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedRun(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedRun(c);
  const brokenLoop = (m, a = m.regs.a, y = m.regs.y) => {
    const mem8 = m.mem8;
    if (a !== 0) return;
    mem8[loc_37] = y;
    mem8[loc_61] = mem8[u16(loc_32a + y)];
    mem8[0x62] = mem8[u16(loc_31a + y)];
    mem8[0x63] = mem8[u16(loc_34a + y)];
    mem8[0x64] = mem8[u16(loc_33a + y)];
    loc_c772(m, 0x61);
    mem8[loc_b0] = mem8[loc_74];
    mem8[loc_b1] = mem8[loc_74 + 1];
    // BUG: never runs the loc_c423 record loop
  };
  brokenLoop(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped record loop");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seedRun(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_c36e, TARGET, m);
  assert.equal(r.placeable, true, `loc_c36e must be seam-placeable; got: ${r.error}`);
});
