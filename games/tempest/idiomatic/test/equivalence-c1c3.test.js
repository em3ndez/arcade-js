// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c1c3 -- zeroes six zero-page cells and most of a math-coprocessor input block,
// then sets one control register. Live-out is memory only (A at RTS is incidental), so each side runs on a
// clone and the contract is RAM (dumpState, minus STACK_SCRATCH). A leaf: the module omits the ROM ret and
// the seam completes it, so the arms compare RAM (-stack), NOT pc/SP.
// Run: node --test games/tempest/idiomatic/test/equivalence-c1c3.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c1c3 as oracle } from "../../translated/loc_c1c3.js";
import { loc_c1c3 } from "../loc_c1c3.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_78, loc_80, loc_81, loc_88, loc_90, loc_91 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc1c3;
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

const ZP = [loc_81, loc_91, loc_80, loc_78, loc_90, loc_88];

test("CAPTURE: real 0xc1c3 dispatches -- loc_c1c3 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c1c3(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: the six zero-page cells all clear over dirty sentinels", () => {
  const seed = (m) => { for (let i = 0; i < ZP.length; i++) m.mem.write8(ZP[i] & 0xffff, 0xa0 + i); };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c1c3(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after clear");
  for (const a of ZP) assert.equal(c.mem.read8(a & 0xffff), 0x00, `cell 0x${a.toString(16)} cleared`);
});

test("TEETH: a twin that leaves one zero-page cell untouched diverges from the oracle", () => {
  const seed = (m) => { for (let i = 0; i < ZP.length; i++) m.mem.write8(ZP[i] & 0xffff, 0xa0 + i); };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const brokenC1c3 = (m) => {
    const mem = m.mem8;
    for (const a of ZP) if (a !== loc_88) mem[a] = 0x00; // BUG: never clears loc_88
  };
  brokenC1c3(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped store");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_c1c3, TARGET, m);
  assert.equal(r.placeable, true, `loc_c1c3 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
