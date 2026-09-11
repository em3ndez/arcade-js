// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c81b -- from the $4e gate and a >=2 test on $06, derives a 0..2 step, subtracts
// it from $06, and either seeds intro cells (gate clear) or sets status bits, zeroes cells, bumps a 16-bit
// tally at $040c,x and clamps $0100. Live-out is memory only, so each side runs on a clone and the contract
// is RAM (dumpState, minus STACK_SCRATCH). A leaf: the module omits the ROM ret and the seam completes it.
// Run: node --test games/tempest/idiomatic/test/equivalence-c81b.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c81b as oracle } from "../../translated/loc_c81b.js";
import { loc_c81b } from "../loc_c81b.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_0, loc_1, loc_2, loc_4, loc_5, loc_6, loc_16, loc_18, loc_3e, loc_4e, loc_50, loc_100, loc_123, loc_40c, loc_40d } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc81b;
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

// gate=0x60, $06=5 -> step=2; $05=0 -> |0xc0; x clamps to 3; $040f++; $0100=0x10+1+1=0x12
const seed = (m) => {
  m.mem.write8(loc_4e, 0x60);
  m.mem.write8(loc_6, 0x05);
  m.mem.write8(loc_5, 0x00);
  m.mem.write8(loc_16, 0x77); m.mem.write8(loc_18, 0x77); m.mem.write8(loc_0, 0x77);
  m.mem.write8(loc_40c + 3, 0x00); m.mem.write8(loc_40d + 3, 0x00);
  m.mem.write8(loc_100, 0x10);
};

test("CAPTURE: real 0xc81b dispatches -- loc_c81b == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c81b(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: gate/step path sets $3e, $05|=0xc0, zeroes $16/$18/$00, bumps $040f, clamps $0100", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c81b(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after step path");
  assert.equal(c.mem.read8(loc_4e), 0x00, "$4e cleared");
  assert.equal(c.mem.read8(loc_6), 0x03, "$06 -= 2");
  assert.equal(c.mem.read8(loc_3e), 0x01, "$3e = step-1");
  assert.equal(c.mem.read8(loc_5), 0xc0, "$05 |= 0xc0");
  assert.equal(c.mem.read8(loc_16), 0x00, "$16 cleared");
  assert.equal(c.mem.read8(loc_40c + 3), 0x01, "$040f bumped");
  assert.equal(c.mem.read8(loc_100), 0x12, "$0100 clamped sum");
});

test("TEETH: a twin that clears $4e but skips the status block diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => { m.mem8[loc_4e] = 0x00; }; // BUG: none of the step/status work
  broken(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the RAM diff FAILED to catch the skipped status block");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_c81b, TARGET, m);
  assert.equal(r.placeable, true, `loc_c81b must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
