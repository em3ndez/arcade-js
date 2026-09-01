// SPDX-License-Identifier: GPL-3.0-only
// Memory+register equivalence for loc_18e7 -- HL := base + bit0 of the select byte; the caller reads
// [HL]. Neither side writes RAM, so the observable live-out is HL: each side runs on a clone and the
// contract is RAM (dumpState, minus STACK_SCRATCH) AND the returned HL.
// Run: node --test games/invaders/idiomatic/test/equivalence-18e7.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_18e7 as oracle } from "../../translated/loc_18e7.js";
import { loc_18e7 } from "../loc_18e7.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_2067, loc_20e7 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x18e7;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  new Machine(ROM, { overrides: snap }).runFrames(maxFrames);
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 1500) : [];

test("CAPTURE: real 0x18e7 dispatches -- loc_18e7 == oracle in RAM (-stack) and HL", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_18e7(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.hl, o.regs.hl, "live-out HL");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: HL := 0x20e7 + bit0 of (loc_2067)", () => {
  for (const v of [0x00, 0x01, 0x02, 0x03, 0xfe, 0xff]) {
    const o = new Machine(ROM); o.mem.write8(loc_2067, v);
    const c = new Machine(ROM); c.mem.write8(loc_2067, v);
    oracle(o);
    const ret = loc_18e7(c);
    assert.equal(ramDiff(o, c), null, `(loc_2067)=0x${v.toString(16)}`);
    const want = loc_20e7 + (v & 1);
    assert.equal(o.regs.hl, want, `oracle HL for 0x${v.toString(16)}`);
    assert.equal(c.regs.hl, want, `module HL for 0x${v.toString(16)}`);
    assert.equal(ret, want, `module returns HL for 0x${v.toString(16)}`);
  }
});

test("TEETH: a wrong HL (bit0 bump dropped) is caught", () => {
  const o = new Machine(ROM); o.mem.write8(loc_2067, 0x01); // bit0=1 -> HL should bump
  const c = new Machine(ROM); c.mem.write8(loc_2067, 0x01);
  oracle(o);
  loc_18e7(c); c.regs.hl = loc_20e7; // BUG: dropped the +1 bump
  assert.notEqual(o.regs.hl, c.regs.hl, "the live-out check FAILED to catch a wrong HL");
});
