// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a416 (ROM 0xa416-0xa447) -- if flag $0116==0 does nothing; else clears it and
// for each live slot ($030a,x!=0) advances $0312,x by table a44e[$0302,x]; a slot that reaches limit
// a448[type] is freed ($030a,x=0), a slot still short re-raises $0116. Live-out is memory only, so each
// side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH). A leaf: the module omits
// the ROM ret and the seam completes it.
// Run: node --test games/tempest/idiomatic/test/equivalence-a416.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a416 as oracle } from "../../translated/loc_a416.js";
import { loc_a416 } from "../loc_a416.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_116, loc_302, loc_30a, loc_312 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa416;
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

test("CAPTURE: real 0xa416 dispatches -- loc_a416 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a416(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: flag set + one live slot -- counter advances by the type step (RAM equal)", () => {
  const TYPE = 0;
  const CNT = 0x02;
  const seed = (m) => {
    m.mem.write8(loc_116, 0x01);
    for (let i = 0; i < 8; i++) m.mem.write8((loc_30a + i) & 0xffff, i === 5 ? 0xaa : 0x00);
    m.mem.write8((loc_312 + 5) & 0xffff, CNT);
    m.mem.write8((loc_302 + 5) & 0xffff, TYPE);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  const step = c.mem.read8(0xa44e + TYPE);   // per-type step (ROM)
  const limit = c.mem.read8(0xa448 + TYPE);  // per-type limit (ROM)
  const next = (CNT + step) & 0xff;
  oracle(o); loc_a416(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after advance");
  if (next < limit) {
    assert.equal(c.mem.read8((loc_312 + 5) & 0xffff), next, "counter advanced by step");
    assert.equal(c.mem.read8((loc_30a + 5) & 0xffff), 0xaa, "slot stays live while short of limit");
  } else {
    assert.equal(c.mem.read8((loc_30a + 5) & 0xffff), 0x00, "slot freed once limit reached");
  }
});

test("CRAFTED: flag clear -- routine is a no-op (RAM equal)", () => {
  const seed = (m) => {
    m.mem.write8(loc_116, 0x00);
    for (let i = 0; i < 8; i++) m.mem.write8((loc_30a + i) & 0xffff, 0xaa);
    for (let i = 0; i < 8; i++) m.mem.write8((loc_312 + i) & 0xffff, 0x03);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_a416(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after no-op");
  assert.equal(c.mem.read8((loc_312 + 4) & 0xffff), 0x03, "counter untouched when flag clear");
});

test("TEETH: a twin that does nothing when the flag is set diverges from the oracle", () => {
  const seed = (m) => {
    m.mem.write8(loc_116, 0x01);
    for (let i = 0; i < 8; i++) m.mem.write8((loc_30a + i) & 0xffff, i === 5 ? 0xaa : 0x00);
    m.mem.write8((loc_312 + 5) & 0xffff, 0x02);
    m.mem.write8((loc_302 + 5) & 0xffff, 0x00);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => { /* BUG: never clears $0116 nor advances the live slot */ };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the missing advance");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_a416, TARGET, m);
  assert.equal(r.placeable, true, `loc_a416 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
