// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b0e7 (ROM 0xb0e7) -- loads a fixed init block: $00=0x0a, $02=0x00, $04=0xdf,
// $01=0x12, $014e=0x19, $014d=0x18. Live-out is RAM only (A at RTS incidental), so each arm compares RAM
// (dumpState, minus STACK_SCRATCH). No POKEY/clock coupling -> the crafted diff is deterministic.
// Run: node --test games/tempest/idiomatic/test/equivalence-b0e7.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b0e7 as oracle } from "../../translated/loc_b0e7.js";
import { loc_b0e7 } from "../loc_b0e7.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_0, loc_1, loc_2, loc_4, loc_14d, loc_14e } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const opt = (name) => existsSync(new URL(name, ROM_DIR)) ? new Uint8Array(readFileSync(new URL(name, ROM_DIR))) : undefined;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb0e7;
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

// Seed every target cell with a non-zero sentinel distinct from its written value so each write bites
// (including $02 = 0x00, which must overwrite a nonzero sentinel).
function seed(m) {
  m.mem.write8(loc_0, 0x11);
  m.mem.write8(loc_1, 0x22);
  m.mem.write8(loc_2, 0x33);
  m.mem.write8(loc_4, 0x44);
  m.mem.write8(loc_14d, 0x55);
  m.mem.write8(loc_14e, 0x66);
}

test("CAPTURE: real 0xb0e7 dispatches -- loc_b0e7 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b0e7(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: the fixed init block == oracle (RAM -stack)", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_b0e7(c);
  assert.equal(ramDiff(o, c), null);
  assert.equal(c.mem.read8(loc_0), 0x0a, "$00");
  assert.equal(c.mem.read8(loc_2), 0x00, "$02");
  assert.equal(c.mem.read8(loc_4), 0xdf, "$04");
  assert.equal(c.mem.read8(loc_1), 0x12, "$01");
  assert.equal(c.mem.read8(loc_14e), 0x19, "$014e");
  assert.equal(c.mem.read8(loc_14d), 0x18, "$014d");
});

test("TEETH: a twin that writes the wrong $04 constant diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  // BUG: plant every constant except $04, which gets 0x00 instead of 0xdf.
  c.mem.write8(loc_0, 0x0a); c.mem.write8(loc_2, 0x00); c.mem.write8(loc_4, 0x00);
  c.mem.write8(loc_1, 0x12); c.mem.write8(loc_14e, 0x19); c.mem.write8(loc_14d, 0x18);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch a wrong $04 constant");
});
