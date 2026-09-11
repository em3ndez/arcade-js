// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c9f1 -- scans the $46 window (length from $3e) for its max into $0126,
// decrements it once when nonzero, then sets $00 to 0x14 or (when $05 is negative) 0x10. Live-out is memory
// only, so each side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH). A leaf: the
// module omits the ROM ret and the seam completes it, so the arms compare RAM (-stack), NOT pc/SP.
// Run: node --test games/tempest/idiomatic/test/equivalence-c9f1.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c9f1 as oracle } from "../../translated/loc_c9f1.js";
import { loc_c9f1 } from "../loc_c9f1.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_0, loc_5, loc_3e, loc_46, loc_126 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc9f1;
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

// window $46..$49 = {02,09,05,01}, max=09; $05=0 -> $00=0x14
const seed = (m) => {
  m.mem.write8(loc_3e, 0x03);
  m.mem.write8(loc_46 + 0, 0x02); m.mem.write8(loc_46 + 1, 0x09);
  m.mem.write8(loc_46 + 2, 0x05); m.mem.write8(loc_46 + 3, 0x01);
  m.mem.write8(loc_5, 0x00);
};

test("CAPTURE: real 0xc9f1 dispatches -- loc_c9f1 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c9f1(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: max-1 lands in $0126 and $00 = 0x14 for non-negative $05", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c9f1(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after scan");
  assert.equal(c.mem.read8(loc_126), 0x08, "$0126 = max(09)-1");
  assert.equal(c.mem.read8(loc_0), 0x14, "$00 = 0x14");
});

test("TEETH: a twin that stores the max without decrementing diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => {
    const mem = m.mem8;
    let max = 0;
    for (let x = mem[loc_3e]; ; x = (x - 1) & 0xff) {
      const v = mem[(loc_46 + x) & 0xff];
      if (v >= max) max = v;
      if (x === 0) break;
    }
    mem[loc_126] = max; // BUG: no decrement when nonzero
    mem[loc_0] = (mem[loc_5] & 0x80) ? 0x10 : 0x14;
  };
  broken(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the RAM diff FAILED to catch the missing decrement");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_c9f1, TARGET, m);
  assert.equal(r.placeable, true, `loc_c9f1 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
