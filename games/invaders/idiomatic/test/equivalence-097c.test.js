// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_097c -- clamp/index: HL = loc_1da0 + (A>=2) + (A>=4). Input register A,
// live-out register HL (the caller reads mem[HL]); no memory is written, so RAM must stay identical
// (dumpState, minus STACK_SCRATCH) AND the returned HL must match.
// Run: node --test games/invaders/idiomatic/test/equivalence-097c.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_097c as oracle } from "../../translated/loc_097c.js";
import { loc_097c } from "../loc_097c.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_1da0 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x097c;
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

test("CAPTURE: real 0x097c dispatches -- loc_097c == oracle in RAM and HL", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_097c(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.hl, o.regs.hl, "returned HL");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: HL = loc_1da0 + (A>=2) + (A>=4) for several A", () => {
  for (const [a, off] of [[0x00, 0], [0x01, 0], [0x02, 1], [0x03, 1], [0x04, 2], [0x40, 2], [0xff, 2]]) {
    const o = new Machine(ROM); o.regs.a = a;
    const c = new Machine(ROM); c.regs.a = a;
    oracle(o); loc_097c(c);
    assert.equal(ramDiff(o, c), null, `A=0x${a.toString(16)}`);
    assert.equal(c.regs.hl, o.regs.hl, `HL vs oracle A=0x${a.toString(16)}`);
    assert.equal(c.regs.hl, (loc_1da0 + off) & 0xffff, `HL value A=0x${a.toString(16)}`);
  }
});

test("TEETH: a broken twin (drops the >=4 slot) returns a wrong HL that is caught", () => {
  const broken = (m, a = m.regs.a) => (m.regs.hl = loc_1da0 + (a >= 0x02 ? 1 : 0)); // BUG: no >=4 arm
  const o = new Machine(ROM); o.regs.a = 0x05;
  const c = new Machine(ROM); c.regs.a = 0x05;
  oracle(o); broken(c);
  assert.notEqual(c.regs.hl, o.regs.hl, "the HL check FAILED to catch a wrong returned pointer");
});
