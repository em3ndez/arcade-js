// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b75b -- a caller that walks twelve slots emitting each non-empty entry's shape
// (dissolving its in-loop jmp into the already-idiomatic loc_bcfd, value + index passed explicitly) then
// latches a level byte. The callee chain shapes vector work cells; live-out is memory only, so each side
// runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH). No register inputs.
// Run: node --test games/tempest/idiomatic/test/equivalence-b75b.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b75b as oracle } from "../../translated/loc_b75b.js";
import { loc_b75b } from "../loc_b75b.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { STACK_SCRATCH, loc_2d3, loc_2ad, loc_3, loc_135, loc_808, loc_37 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb75b;
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

test("CAPTURE: real 0xb75b dispatches -- loc_b75b == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b75b(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

const seedVectorRam = (m) => { for (let a = 0x2000; a < 0x2100; a++) m.mem.write8(a, (a * 7) & 0xff); };
const seed = (m, stage) => {
  seedVectorRam(m);
  for (let i = 0; i <= 0x0b; i++) {
    // mix in some empty entries (skipped) and some live ones across the near/far split
    m.mem.write8(u16(loc_2d3 + i), i % 3 === 0 ? 0x00 : (0x10 + i));
    m.mem.write8(u16(loc_2ad + i), 0x40 + i);
  }
  m.mem.write8(loc_3, 0x33);
  m.mem.write8(loc_135, stage);
};

test("CRAFTED: seeded loop is RAM-equivalent and latches the level byte", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x04); // stage < 6 -> level 0x04
  const c = new Machine(ROM, OPTS); seed(c, 0x04);
  oracle(o); loc_b75b(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the walk");
  assert.equal(c.io.colorram[loc_808 & 0x0f], 0x04, "level byte latched to 0x04");
  assert.equal(c.mem.read8(loc_37), o.mem.read8(loc_37), "loop counter matches oracle");
});

test("CRAFTED: stage in [6,8) latches 0x0b; stage >= 8 latches 0x0c", () => {
  for (const [stage, want] of [[0x07, 0x0b], [0x09, 0x0c]]) {
    const o = new Machine(ROM, OPTS); seed(o, stage);
    const c = new Machine(ROM, OPTS); seed(c, stage);
    oracle(o); loc_b75b(c);
    assert.equal(ramDiff(o, c), null, `RAM equal at stage ${stage}`);
    assert.equal(c.io.colorram[loc_808 & 0x0f], want, `level byte at stage ${stage}`);
  }
});

test("TEETH (non-default seed): a twin that latches the wrong level byte diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x09);
  const c = new Machine(ROM, OPTS); seed(c, 0x09);
  oracle(o);
  loc_b75b(c);
  c.mem.write8(loc_808, 0x00); // BUG: clobber the latched level byte
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong level byte");
});
