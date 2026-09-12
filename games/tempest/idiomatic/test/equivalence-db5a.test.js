// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_db5a -- when both guard bytes ($01ca | $01c7) are clear it runs the walk
// seeder (loc_de11) and then stamps $7c <- $01c9 and $00 <- 0x02; if either guard is set it returns
// with no writes. Live-out is memory only (A at RTS is an incidental byproduct), so the arms compare
// RAM (dumpState, minus STACK_SCRATCH). The seeder's own effects land in RAM on both sides.
// Run: node --test games/tempest/idiomatic/test/equivalence-db5a.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_db5a as oracle } from "../../translated/loc_db5a.js";
import { loc_db5a } from "../loc_db5a.js";
import { loc_de11 } from "../loc_de11.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_0, loc_7c, loc_1c7, loc_1c9, loc_1ca } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xdb5a;
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

test("CAPTURE: real 0xdb5a dispatches -- loc_db5a == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_db5a(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: guards clear -- seeder runs and $7c <- $01c9, $00 <- 0x02", () => {
  const seed = (m) => {
    m.regs.s = 0xfb;
    m.mem.write8(loc_1ca, 0x00);
    m.mem.write8(loc_1c7, 0x00);
    m.mem.write8(loc_1c9, 0x77);
    m.mem.write8(loc_7c, 0x11);
    m.mem.write8(loc_0, 0x55);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_db5a(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after run");
  assert.equal(c.mem.read8(loc_7c), 0x77, "$7c <- $01c9");
  assert.equal(c.mem.read8(loc_0), 0x02, "$00 <- 0x02");
});

test("CRAFTED: a guard set -- early return, $7c and $00 untouched", () => {
  const seed = (m) => {
    m.regs.s = 0xfb;
    m.mem.write8(loc_1ca, 0x40); // guard set
    m.mem.write8(loc_1c7, 0x00);
    m.mem.write8(loc_1c9, 0x77);
    m.mem.write8(loc_7c, 0x11);
    m.mem.write8(loc_0, 0x55);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_db5a(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after early return");
  assert.equal(c.mem.read8(loc_7c), 0x11, "$7c untouched");
  assert.equal(c.mem.read8(loc_0), 0x55, "$00 untouched");
});

test("TEETH: a twin that skips the $7c store (non-default seed) diverges from the oracle", () => {
  const seed = (m) => {
    m.regs.s = 0xfb;
    m.mem.write8(loc_1ca, 0x00);
    m.mem.write8(loc_1c7, 0x00);
    m.mem.write8(loc_1c9, 0x77);
    m.mem.write8(loc_7c, 0x11); // non-default so the skipped store shows
    m.mem.write8(loc_0, 0x55);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => {
    if ((m.mem8[loc_1ca] | m.mem8[loc_1c7]) !== 0) return;
    loc_de11(m);
    m.mem8[loc_0] = 0x02; // BUG: never stores $7c
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped $7c store");
});

test("SP-TOOTH: the omitted-ret caller is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_db5a, TARGET, m);
  assert.equal(r.placeable, true, `loc_db5a must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret caller placeable");
});
