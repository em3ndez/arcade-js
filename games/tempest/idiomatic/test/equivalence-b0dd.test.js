// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b0dd (ROM 0xb0dd) -- if A already equals $72, return with no effect;
// otherwise latch A into $72 and tail into loc_df6a (emit the {0x00, A|0x70} vector word at the ($74/$75)
// cursor, advancing it by 2). A is a register input. Live-out is memory only for this display-builder
// family (the shared df5f tail returns nothing; the ROM's incidental A is not reproduced), so the
// contract is RAM (dumpState, minus STACK_SCRATCH). Plain tail-caller -- no SP tooth. No POKEY read.
// Run: node --test games/tempest/idiomatic/test/equivalence-b0dd.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b0dd as oracle } from "../../translated/loc_b0dd.js";
import { loc_b0dd } from "../loc_b0dd.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_72, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const opt = (name) => {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
};
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb0dd;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function seed(m, s) {
  if (s.a !== undefined) m.regs.a = s.a;
  for (const [a, v] of Object.entries(s.mem || {})) m.mem.write8(Number(a), v);
}

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0xb0dd dispatches -- loc_b0dd == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b0dd(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: unchanged branch is a no-op; changed branch latches $72 and emits == oracle (RAM -stack)", () => {
  // Unchanged: A already equals $72 -> early return, nothing touched.
  {
    const s = { a: 0x33, mem: { [loc_72]: 0x33, [loc_74]: 0x00, [loc_75]: 0x20 } };
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle(o); loc_b0dd(c);
    assert.equal(ramDiff(o, c), null, "RAM: unchanged branch");
    assert.equal(c.mem.read8(loc_72), 0x33, "$72 unchanged");
    assert.equal(c.mem.read8(0x2000), o.mem.read8(0x2000), "cursor target untouched");
  }
  // Changed: A differs -> latch $72 = A, emit {0x00, A|0x70}, cursor += 2.
  {
    const s = { a: 0x05, mem: { [loc_72]: 0x33, [loc_74]: 0x00, [loc_75]: 0x20 } };
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle(o); loc_b0dd(c);
    assert.equal(ramDiff(o, c), null, "RAM: changed branch");
    assert.equal(c.mem.read8(loc_72), 0x05, "$72 latched");
    assert.equal(c.mem.read8(0x2000), 0x00, "emit byte 0 = 0x00");
    assert.equal(c.mem.read8(0x2001), 0x75, "emit byte 1 = A|0x70");
    assert.equal(c.mem.read8(loc_74) | (c.mem.read8(loc_75) << 8), 0x2002, "cursor += 2");
  }
});

test("TEETH: twins that take the wrong branch or skip the latch diverge from the oracle", () => {
  // Twin A: A differs but the twin skips the whole body (treats it as a no-op).
  {
    const s = { a: 0x05, mem: { [loc_72]: 0x33, [loc_74]: 0x00, [loc_75]: 0x20 } };
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle(o);
    const broken = (_mm) => { /* BUG: never latches $72 nor emits */ };
    broken(c);
    assert.notEqual(ramDiff(o, c), null, "RAM diff FAILED to catch the skipped body");
  }
  // Twin B: latches $72 but never emits the vector word.
  {
    const s = { a: 0x05, mem: { [loc_72]: 0x33, [loc_74]: 0x00, [loc_75]: 0x20 } };
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle(o);
    const broken = (mm) => { mm.mem8[loc_72] = mm.regs.a; };
    broken(c);
    assert.notEqual(ramDiff(o, c), null, "RAM diff FAILED to catch the missing emit");
  }
});
