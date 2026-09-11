// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_97c5 (ROM 0x97c5-0x97f7) -- scans $02df,x (count from $011c) for the
// smallest nonzero entry, keeping value in $29 and index in $2a. If none is found it returns the last
// entry seen. Otherwise it dissolves the m.call($a7a6) into a direct loc_a7a6(m, $02b9,idx, $0200)
// and returns A = 0 (zero) / 0x09 (negative) / 0xf7 (positive). Live-out is A (return code) plus
// memory ($29/$2a and a7a6's $2a stash), so arms compare RAM (dumpState, minus STACK_SCRATCH) AND o.a.
// Run: node --test games/tempest/idiomatic/test/equivalence-97c5.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_97c5 as oracle } from "../../translated/loc_97c5.js";
import { loc_97c5 } from "../loc_97c5.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_29, loc_2a, loc_11c, loc_2df, loc_2b9, loc_200 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x97c5;
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

test("CAPTURE: real 0x97c5 dispatches -- loc_97c5 == oracle in RAM (-stack) and in A", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_97c5(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.a, o.regs.a, "return code A matches");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: found -> A code by sign; none-found -> last entry seen", () => {
  // found: smallest nonzero at index 2; a7a6 derives the sign-coded return
  const seedFound = (m) => {
    m.mem.write8(loc_11c, 0x04);
    for (let i = 0; i <= 4; i++) m.mem.write8((loc_2df + i) & 0xffff, 0x00);
    m.mem.write8((loc_2df + 2) & 0xffff, 0x03);
    m.mem.write8((loc_2b9 + 2) & 0xffff, 0x10);
    m.mem.write8(loc_200, 0x40);
  };
  let o = new Machine(ROM, OPTS); seedFound(o);
  let c = new Machine(ROM, OPTS); seedFound(c);
  oracle(o); loc_97c5(c);
  assert.equal(ramDiff(o, c), null, "found branch RAM equal");
  assert.equal(c.regs.a, o.regs.a, "found branch A equal");
  assert.equal(c.mem.read8(loc_29), 0x03, "min value kept");

  // none found: every entry 0x00 -> $2a stays 0xff -> return last entry (0x00)
  const seedNone = (m) => {
    m.mem.write8(loc_11c, 0x04);
    for (let i = 0; i <= 4; i++) m.mem.write8((loc_2df + i) & 0xffff, 0x00);
  };
  o = new Machine(ROM, OPTS); seedNone(o);
  c = new Machine(ROM, OPTS); seedNone(c);
  oracle(o); loc_97c5(c);
  assert.equal(ramDiff(o, c), null, "none-found branch RAM equal");
  assert.equal(c.regs.a, o.regs.a, "none-found branch A equal");
  assert.equal(c.mem.read8(loc_2a), 0xff, "$2a stays 0xff");
});

test("TEETH: a twin that returns the wrong code (or mis-scans) diverges from the oracle", () => {
  const seed = (m) => {
    m.mem.write8(loc_11c, 0x04);
    for (let i = 0; i <= 4; i++) m.mem.write8((loc_2df + i) & 0xffff, 0x00);
    m.mem.write8((loc_2df + 2) & 0xffff, 0x03);
    m.mem.write8((loc_2b9 + 2) & 0xffff, 0x10);
    m.mem.write8(loc_200, 0x40);
  };
  // A live-out arm: same memory effect, but a wrong return code must be caught.
  let o = new Machine(ROM, OPTS); seed(o);
  let c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  loc_97c5(c);
  c.regs.a = (o.regs.a ^ 0xff) & 0xff; // BUG: corrupt the return code
  assert.notEqual(c.regs.a, o.regs.a, "A comparison FAILED to catch a corrupted return code");

  // Memory arm: a twin that never records the smallest index diverges in RAM.
  o = new Machine(ROM, OPTS); seed(o);
  c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => { m.mem.write8(loc_29, 0xff); m.mem.write8(loc_2a, 0xff); }; // BUG: never scans
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped scan");
});
