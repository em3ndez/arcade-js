// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_1611 (ROM 0x1611) -- "HL := mem[0x2067] << 8". No input register (the
// page byte lives in RAM); no memory is written, so the contract is the HL live-out (plus a RAM sanity
// diff, minus STACK_SCRATCH). Each side runs on a fresh clone.
// Run: node --test games/invaders/idiomatic/test/equivalence-1611.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1611 as oracle } from "../../translated/loc_1611.js";
import { loc_1611 } from "../loc_1611.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_2067 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x1611;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

// A broken twin of loc_1611: drops the high-byte shift, so HL is wrong for any non-zero page byte.
function loc_1611_broken(m) {
  return (m.regs.hl = m.mem.read8(0x2067)); // BUG: forgot << 8
}

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  new Machine(ROM, { overrides: snap }).runFrames(maxFrames);
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 1500) : [];

test("CAPTURE: real 0x1611 dispatches -- loc_1611 == oracle in RAM and HL live-out", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_1611(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.hl, o.regs.hl); // HL is the live-out
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: HL := page-byte << 8 for several page bytes", () => {
  for (const v of [0x00, 0x01, 0x20, 0x7f, 0xa5, 0xff]) {
    const o = new Machine(ROM); o.mem8[loc_2067] = v;
    const c = new Machine(ROM); c.mem8[loc_2067] = v;
    oracle(o); loc_1611(c);
    assert.equal(ramDiff(o, c), null, `page=0x${v.toString(16)}`);
    assert.equal(c.regs.hl, o.regs.hl, `HL match page=0x${v.toString(16)}`);
    assert.equal(c.regs.hl, v << 8, `HL value page=0x${v.toString(16)}`);
  }
});

test("TEETH: a wrong HL is caught", () => {
  const o = new Machine(ROM); o.mem8[loc_2067] = 0xa5;
  const c = new Machine(ROM); c.mem8[loc_2067] = 0xa5;
  oracle(o);
  loc_1611_broken(c); // BUG: HL missing the << 8
  assert.notEqual(c.regs.hl, o.regs.hl, "the check FAILED to catch a wrong HL");
});
