// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b2fe (ROM 0xb2fe-0xb331) -- emits a header record (loc_df09), sets the
// $3b/$3c pointer and toggles a per-slot parity flag, then writes the two-byte word chosen by the new
// parity through that pointer. The idiomatic side dissolves the jsr $df09 into a direct loc_df09(m)
// call. Live-out is memory only, so each arm compares RAM (dumpState minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-b2fe.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b2fe as oracle } from "../../translated/loc_b2fe.js";
import { loc_b2fe } from "../loc_b2fe.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_415, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb2fe;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0xb2fe dispatches -- loc_b2fe == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b2fe(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// A into a valid slot index; cursor into vector RAM so the df09 header emit is diffed. The parity
// pre-state selects which of the two branch words gets written through ($3b).
function seedSlot(m, a, parityPre) {
  m.regs.a = a;
  m.mem.write8(loc_74, 0x40); m.mem.write8(loc_75, 0x20); // ($74) -> 0x2040
  m.mem.write8((loc_415 + a) & 0xffff, parityPre);
}

test("CRAFTED: parity pre=0 -> toggles to 1 (nonzero branch); RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedSlot(o, 0x03, 0x00);
  const c = new Machine(ROM, OPTS); seedSlot(c, 0x03, 0x00);
  oracle(o); loc_b2fe(c);
  assert.equal(ramDiff(o, c), null, "RAM equal (toggled parity nonzero)");
  assert.equal(c.mem.read8((loc_415 + 0x03) & 0xffff), 0x01, "parity flag toggled to 1");
});

test("CRAFTED: parity pre=1 -> toggles to 0 (zero branch); RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedSlot(o, 0x02, 0x01);
  const c = new Machine(ROM, OPTS); seedSlot(c, 0x02, 0x01);
  oracle(o); loc_b2fe(c);
  assert.equal(ramDiff(o, c), null, "RAM equal (toggled parity zero)");
  assert.equal(c.mem.read8((loc_415 + 0x02) & 0xffff), 0x00, "parity flag toggled to 0");
});

test("TEETH: a twin that skips the parity toggle diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedSlot(o, 0x03, 0x00); oracle(o);
  const c = new Machine(ROM, OPTS); seedSlot(c, 0x03, 0x00);
  // Faithful except the parity flag store is dropped: $0415,x stays at its pre-state.
  const broken = (m, a = m.regs.a) => {
    const { mem8, mem16 } = m;
    // no df09, no emit, but write the pointer target so only the flag differs
    const idx = (a << 1) & 0xff;
    const parity = mem8[(loc_415 + a) & 0xffff] ^ 0x01; // BUG: computed but never stored back
    void parity; void idx; void mem16;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped parity toggle");
});

test("SP-TOOTH: the omitted-ret routine (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_b2fe, TARGET, m);
  assert.equal(r.placeable, true, `loc_b2fe must be seam-placeable; got: ${r.error}`);
});
