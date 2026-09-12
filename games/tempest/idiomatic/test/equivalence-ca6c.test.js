// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_ca6c (ROM 0xca6c-0xcaf0) -- adds a three-byte BCD amount into the $40..$42+y
// score trio, range-checks the high byte against $0156, and on a qualifying result (with a per-slot $48,x
// counter under six) bumps the counter, fires sound loc_ccb9, and sets $0124. The oracle runs the translated
// sound via m.call; the idiomatic dissolves it to loc_ccc3(A=0x4f) threading the slot x and y. Live-out is
// memory only (registers at RTS incidental), so both sides run on a clone and the contract is RAM (-stack).
// Run: node --test games/tempest/idiomatic/test/equivalence-ca6c.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_ca6c as oracle } from "../../translated/loc_ca6c.js";
import { loc_ca6c } from "../loc_ca6c.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_5, loc_29, loc_2a, loc_2b, loc_3d, loc_40, loc_41, loc_42, loc_48, loc_124, loc_156 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xca6c;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 4000) : [];

test("CAPTURE: real 0xca6c dispatches -- loc_ca6c == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_ca6c(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Valid-BCD seed that runs the X>=8 operand-triplet add and reaches the award+sound path.
function seed(m) {
  m.mem.write8(loc_5, m.mem.read8(loc_5) | 0x80); // gate on
  m.mem.write8(loc_3d, 0x00);   // y = 0, award slot 0
  m.mem.write8(loc_29, 0x11);   // addend low
  m.mem.write8(loc_2a, 0x22);   // addend mid
  m.mem.write8(loc_2b, 0x50);   // addend high (nonzero)
  m.mem.write8(loc_40, 0x00); m.mem.write8(loc_41, 0x00); m.mem.write8(loc_42, 0x00);
  m.mem.write8(loc_156, 0x10);  // threshold, nonzero and <= $2b
  m.mem.write8(loc_48, 0x00);   // counter under six
  m.mem.write8(loc_124, 0x00);
  m.regs.x = 0x08;              // >= 8 operand path
}

test("CRAFTED: BCD add lands the score, then the award bumps the counter and sets $0124", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_ca6c(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after add + award");
  assert.equal(c.mem.read8(loc_40), 0x11, "$40 score low");
  assert.equal(c.mem.read8(loc_41), 0x22, "$41 score mid");
  assert.equal(c.mem.read8(loc_42), 0x50, "$42 score high");
  assert.equal(c.mem.read8(loc_48), 0x01, "$48 counter bumped");
  assert.equal(c.mem.read8(loc_124), 0x20, "$0124 flag raised");
});

test("GATED: with $05 bit7 clear the routine is a no-op vs the oracle", () => {
  const prep = (m) => { seed(m); m.mem.write8(loc_5, m.mem.read8(loc_5) & 0x7f); };
  const o = new Machine(ROM, OPTS); prep(o);
  const c = new Machine(ROM, OPTS); prep(c);
  oracle(o); loc_ca6c(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the gated-off path");
  assert.equal(c.mem.read8(loc_40), 0x00, "score untouched when gated off");
});

test("TEETH: mutating an addend byte makes the idiomatic diverge from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  c.mem.write8(loc_29, 0x33); // non-default: different low addend
  loc_ca6c(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the changed addend");
});
