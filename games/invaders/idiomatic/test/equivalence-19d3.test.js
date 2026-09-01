// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_19d3 (ROM 0x19d3) -- store A into loc_20e9. Input A, live-out memory only.
// Run: node --test games/invaders/idiomatic/test/equivalence-19d3.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_19d3 as oracle } from "../../translated/loc_19d3.js";
import { loc_19d3 } from "../loc_19d3.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_20e9 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x19d3;
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

test("CAPTURE: real 0x19d3 dispatches -- loc_19d3 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    o.io.setInte(false); c.io.setInte(false);
    oracle(o); loc_19d3(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: A stored at loc_20e9 for several values", () => {
  for (const a of [0x00, 0x01, 0x7f, 0xff, 0xa5]) {
    const o = new Machine(ROM); o.regs.a = a;
    const c = new Machine(ROM); c.regs.a = a;
    oracle(o); loc_19d3(c);
    assert.equal(ramDiff(o, c), null, `A=0x${a.toString(16)}`);
    assert.equal(c.mem.read8(loc_20e9), a, `stored A=0x${a.toString(16)}`);
  }
});

test("TEETH: a wrong stored byte is caught", () => {
  const o = new Machine(ROM); o.regs.a = 0xa5;
  const c = new Machine(ROM); c.regs.a = 0xa5;
  oracle(o);
  loc_19d3(c); c.mem.write8(loc_20e9, 0x5a); // BUG
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong stored byte");
  assert.equal(d.addr, loc_20e9 & 0xffff);
});
