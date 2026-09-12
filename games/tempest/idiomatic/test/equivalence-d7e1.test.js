// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_d7e1 (ROM 0xd7e1-0xd803) -- arms $0005=0 and $0001=2, then delegates to
// loc_abac only when $01ca==0 AND ($0c00 & 0x10)!=0 AND ($01c9 & 0x03)==0 (also stamping $0000=0 past the
// second guard); any guard fails -> straight return. Effect is memory-only, so each side runs on a fresh
// Machine and the contract is RAM (dumpState, minus STACK_SCRATCH). Leaf-omits the ROM ret.
// Run: node --test games/tempest/idiomatic/test/equivalence-d7e1.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_d7e1 as oracle } from "../../translated/loc_d7e1.js";
import { loc_d7e1 } from "../loc_d7e1.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_0, loc_1, loc_5, loc_1c9, loc_1ca } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xd7e1;
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

test("CAPTURE: real 0xd7e1 dispatches -- loc_d7e1 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_d7e1(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: all guards open -- delegate runs, RAM matches oracle", () => {
  // delegate runs only when (loc_1c9 & 3) != 0 (idle=0 takes the rts), so seed a pending request
  const seed = (m) => { m.mem.write8(loc_1ca, 0x00); m.mem.write8(loc_1c9, 0x03); };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_d7e1(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after delegate");
  assert.equal(c.mem.read8(loc_1), 0x02, "$0001 armed");
  assert.equal(c.mem.read8(loc_0), 0x00, "$0000 stamped past second guard");
});

test("CRAFTED: first guard shut ($01ca!=0) -- no delegate, RAM still matches oracle", () => {
  const seed = (m) => { m.mem.write8(loc_1ca, 0x01); m.mem.write8(loc_1c9, 0x00); };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_d7e1(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the guarded-out path");
  assert.equal(c.mem.read8(loc_1), 0x02, "$0001 still armed before the guard");
});

test("TEETH: a twin that fails to arm $0001 diverges from the oracle", () => {
  const seed = (m) => { m.mem.write8(loc_1ca, 0x00); m.mem.write8(loc_1c9, 0x00); };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => { m.mem8[loc_5] = 0x00; }; // BUG: never arms $0001 nor delegates
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the missing arm/delegate");
});
