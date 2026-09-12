// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c423 (ROM 0xc423-0xc43b) -- copies four $03xx,x table cells (x=$37) into the
// $61..$64 record header, then tail-calls loc_c3ba (which emits the record through loc_df92). The oracle runs
// the translated loc_c3ba via m.call; the idiomatic calls the idiomatic loc_c3ba directly. Live-out is memory
// only (registers at RTS are incidental), so both sides run on a clone and the contract is RAM (-stack).
// Run: node --test games/tempest/idiomatic/test/equivalence-c423.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c423 as oracle } from "../../translated/loc_c423.js";
import { loc_c423 } from "../loc_c423.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_37, loc_31a, loc_32a, loc_33a, loc_34a, loc_61, loc_62, loc_63, loc_64, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc423;
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

test("CAPTURE: real 0xc423 dispatches -- loc_c423 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c423(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

function seed(m) {
  m.mem.write8(loc_37, 0x05);
  m.mem.write8((loc_32a + 5) & 0xffff, 0x11);
  m.mem.write8((loc_31a + 5) & 0xffff, 0x22);
  m.mem.write8((loc_34a + 5) & 0xffff, 0x33);
  m.mem.write8((loc_33a + 5) & 0xffff, 0x44);
  m.mem.write8(loc_74, 0x30); m.mem.write8(loc_75, 0x02); // record cursor into safe RAM
}

test("CRAFTED: the four indexed cells land in $61..$64 and RAM matches the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c423(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after copy + emit");
  assert.equal(c.mem.read8(loc_61), 0x11, "$61");
  assert.equal(c.mem.read8(loc_62), 0x22, "$62");
  assert.equal(c.mem.read8(loc_63), 0x33, "$63");
  assert.equal(c.mem.read8(loc_64), 0x44, "$64");
});

test("TEETH: a twin that skips the $63 copy diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => {
    const { mem8 } = m;
    const x = mem8[loc_37];
    mem8[loc_61] = mem8[(loc_32a + x) & 0xffff];
    mem8[loc_62] = mem8[(loc_31a + x) & 0xffff];
    // BUG: never copies into $63
    mem8[loc_64] = mem8[(loc_33a + x) & 0xffff];
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped copy");
});
