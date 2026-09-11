// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_ca18 (ROM 0xca18) -- masks $05 &= 0x3f, then lays a fixed init block:
// $3e=0, $02=0x1a, $00=0x0a, $04=0xa0, $016b=0x01, $01=0x0a. Live-out is RAM only (A is store scratch no
// caller reads), so every arm compares RAM (-stack). Pure leaf (no dispatch): the seam completes it by
// omitting the ROM ret. No POKEY reads. Seeds set $05's high bits (must survive the mask only in their low
// six) and pre-dirty the block so both the mask and the constant stores are observable.
// Run: node --test games/tempest/idiomatic/test/equivalence-ca18.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_ca18 as oracle } from "../../translated/loc_ca18.js";
import { loc_ca18 } from "../loc_ca18.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_5, loc_3e, loc_2, loc_0, loc_4, loc_16b, loc_1 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const opt = (name) => {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
};
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xca18;
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

test("CAPTURE: real 0xca18 dispatches -- loc_ca18 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_ca18(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// $05 high bits set (0xc0) so the &0x3f mask is observable; block cells pre-dirtied.
function seed(m) {
  m.mem8[loc_5] = 0xc5;   // low six bits 0x05 survive; high two (0xc0) get masked off
  m.mem8[loc_3e] = 0x77;
  m.mem8[loc_2] = 0x77;
  m.mem8[loc_0] = 0x77;
  m.mem8[loc_4] = 0x77;
  m.mem8[loc_16b] = 0x77;
  m.mem8[loc_1] = 0x77;
}

test("CRAFTED: $05 masked + fixed block written == oracle (RAM -stack)", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_ca18(c);
  assert.equal(ramDiff(o, c), null, "masked $05 + init block match oracle");
  // Independent confirmation of each field.
  assert.equal(c.mem8[loc_5], 0x05, "$05 masked to low six bits");
  assert.equal(c.mem8[loc_3e], 0x00, "$3e = 0");
  assert.equal(c.mem8[loc_2], 0x1a, "$02 = 0x1a");
  assert.equal(c.mem8[loc_0], 0x0a, "$00 = 0x0a");
  assert.equal(c.mem8[loc_4], 0xa0, "$04 = 0xa0");
  assert.equal(c.mem8[loc_16b], 0x01, "$016b = 0x01");
  assert.equal(c.mem8[loc_1], 0x0a, "$01 = 0x0a");
});

test("TEETH: a rewrite that skips masking $05 diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o); // $05 seeded 0xc5 (non-default so the missing mask bites)
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const brokenSkipMask = (m) => { // BUG: writes the block but leaves $05 unmasked at 0xc5
    m.mem8[loc_3e] = 0x00;
    m.mem8[loc_2] = 0x1a;
    m.mem8[loc_0] = 0x0a;
    m.mem8[loc_4] = 0xa0;
    m.mem8[loc_16b] = 0x01;
    m.mem8[loc_1] = 0x0a;
  };
  brokenSkipMask(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch a skipped $05 mask");
});
