// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b56a (ROM 0xb56a) -- stores 0,0,0,A into the four bytes at the $74/$75
// pointer, then advances that pointer by four. A is the only input; live-out is RAM only (the oracle's
// stack save/restore of A lands inside STACK_SCRATCH, excluded from the diff). Pure leaf, no dispatch;
// the seam completes it by omitting its ROM ret. No POKEY reads, so the crafted arms are deterministic.
// Run: node --test games/tempest/idiomatic/test/equivalence-b56a.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b56a as oracle } from "../../translated/loc_b56a.js";
import { loc_b56a } from "../loc_b56a.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const opt = (name) => {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
};
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb56a;
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

test("CAPTURE: real 0xb56a dispatches -- loc_b56a == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b56a(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

function seed(m, s) {
  m.regs.a = s.a;
  m.mem8[loc_74] = s.ptr & 0xff;
  m.mem8[loc_75] = (s.ptr >> 8) & 0xff;
}

test("CRAFTED: writes 0,0,0,A and advances $74/$75 by four == oracle (RAM -stack)", () => {
  const cases = [
    { tag: "mid page, no wrap", a: 0x7e, ptr: 0x0400 },
    { tag: "A = 0", a: 0x00, ptr: 0x0410 },
    { tag: "low byte wraps into high", a: 0xa5, ptr: 0x04fe },
    { tag: "low byte exactly to 0x00", a: 0x33, ptr: 0x03fc },
  ];
  for (const s of cases) {
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle(o); loc_b56a(c);
    assert.equal(ramDiff(o, c), null, `RAM: ${s.tag}`);
    // pointer advanced by exactly four
    const adv = (c.mem8[loc_74] | (c.mem8[loc_75] << 8));
    assert.equal(adv, (s.ptr + 4) & 0xffff, `ptr advance: ${s.tag}`);
  }
});

test("TEETH: a twin that skips the A byte diverges from the oracle", () => {
  const s = { a: 0xa5, ptr: 0x0400 }; // non-default A so the missing store bites
  const o = new Machine(ROM, OPTS); seed(o, s);
  const c = new Machine(ROM, OPTS); seed(c, s);
  oracle(o);
  const broken = (m) => { // BUG: writes only three zero bytes, never the A byte, and still advances by 4
    const ptr = m.mem8[loc_74] | (m.mem8[loc_75] << 8);
    m.mem8[(ptr) & 0xffff] = 0;
    m.mem8[(ptr + 1) & 0xffff] = 0;
    m.mem8[(ptr + 2) & 0xffff] = 0;
    const sum = m.mem8[loc_74] + 4;
    m.mem8[loc_74] = sum & 0xff;
    if (sum > 0xff) m.mem8[loc_75] = (m.mem8[loc_75] + 1) & 0xff;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the missing A store");
});
