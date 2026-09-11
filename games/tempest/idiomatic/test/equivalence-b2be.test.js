// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b2be (ROM 0xb2be) -- load a 16-bit pointer from ROM table $ce68 (when the
// per-index flag $0415+A is nonzero) or $ce7a (when zero), indexed by 2*A, into $74/$75, and clear $a9.
// Live-out is RAM only (A/X/Y are addressing scratch no caller reads), so every arm compares RAM
// (dumpState minus STACK_SCRATCH). It is a pure leaf (no dispatch); the seam completes it by omitting its
// ROM ret. No POKEY reads, so the crafted arms are fully deterministic.
// Run: node --test games/tempest/idiomatic/test/equivalence-b2be.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b2be as oracle } from "../../translated/loc_b2be.js";
import { loc_b2be } from "../loc_b2be.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_74, loc_75, loc_a9, loc_415 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const opt = (name) => {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
};
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb2be;
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

test("CAPTURE: real 0xb2be dispatches -- loc_b2be == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b2be(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

function seed(m, s) {
  m.regs.a = s.a;
  if (s.flag !== undefined) m.mem8[(loc_415 + s.a) & 0xffff] = s.flag;
  if (s.pre_a9 !== undefined) m.mem8[loc_a9] = s.pre_a9;
}

test("CRAFTED: table selection by $0415+A and 2*A stride == oracle (RAM -stack)", () => {
  const cases = [
    { tag: "idx 2, flag!=0 -> table $ce68", a: 0x02, flag: 0x01, pre_a9: 0x55 },
    { tag: "idx 2, flag==0 -> table $ce7a", a: 0x02, flag: 0x00, pre_a9: 0x55 },
    { tag: "idx 0, flag!=0 -> table $ce68 off 0", a: 0x00, flag: 0xff, pre_a9: 0x55 },
    { tag: "idx 5, flag==0 -> table $ce7a off 0x0a", a: 0x05, flag: 0x00, pre_a9: 0x00 },
    { tag: "idx 7, flag!=0 -> table $ce68 off 0x0e", a: 0x07, flag: 0x80, pre_a9: 0x12 },
  ];
  for (const s of cases) {
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle(o); loc_b2be(c);
    assert.equal(ramDiff(o, c), null, `RAM: ${s.tag}`);
  }
});

test("TEETH: a twin that ignores the flag and always reads $ce7a diverges from the oracle", () => {
  // Non-default seed so the mutation bites: flag nonzero -> oracle uses $ce68, whose entry differs from
  // $ce7a at every index (verified against the ROM tables).
  const s = { a: 0x02, flag: 0x01, pre_a9: 0x55 };
  const o = new Machine(ROM, OPTS); seed(o, s);
  const c = new Machine(ROM, OPTS); seed(c, s);
  oracle(o);
  const brokenAlwaysCe7a = (m) => { // BUG: hard-codes table $ce7a, ignoring the $0415+A flag
    const off = (m.regs.a << 1) & 0xff;
    m.mem8[loc_74] = m.mem8[(0xce7a + off) & 0xffff];
    m.mem8[loc_75] = m.mem8[(0xce7a + 1 + off) & 0xffff];
    m.mem8[loc_a9] = 0;
  };
  brokenAlwaysCe7a(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch a wrong table selection");
});
