// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_9aee (ROM 0x9aee) -- load a vector-list pointer pair from two ROM tables by Y
// (loc_9b02[Y]->loc_2c, loc_9afd[Y]->loc_2d), stash Y at loc_2b, re-latch A from loc_29. Live-out is three
// RAM cells (loc_2b/loc_2c/loc_2d) plus A, so the arms compare RAM (-stack) + A. A leaf: it omits the ROM
// ret and the seam completes it. Serves the full 0x9aee entry only (the 0x9af1/0x9af6 mid-entries stay
// translated). No POKEY/clock read, so the CRAFTED diff is deterministic.
// Run: node --test games/tempest/idiomatic/test/equivalence-9aee.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_9aee as oracle } from "../../translated/loc_9aee.js";
import { loc_9aee } from "../loc_9aee.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_29, loc_2b, loc_2c, loc_2d, loc_9b02 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const rd = (f) => (existsSync(new URL(f, ROM_DIR)) ? new Uint8Array(readFileSync(new URL(f, ROM_DIR))) : null);
const ROM = rd("maincpu.bin");
const opt = (f) => rd(f);
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const ROM_PRESENT = ROM !== null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x9aee;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0x9aee dispatches -- loc_9aee == oracle in RAM (-stack) and A", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_9aee(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.a, o.regs.a, "A live-out (loc_29 re-latch) matches the oracle");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: loc_9b02[Y]->loc_2c, loc_9afd[Y]->loc_2d, Y->loc_2b, A<-loc_29", () => {
  const cases = [
    { tag: "Y=0", y: 0x00, a29: 0x11 },
    { tag: "Y=1", y: 0x01, a29: 0x22 },
    { tag: "Y=5", y: 0x05, a29: 0x00 },
  ];
  for (const { tag, y, a29 } of cases) {
    const seed = (mm) => { mm.regs.y = y; mm.mem.write8(loc_29, a29); };
    const o = new Machine(ROM, OPTS); seed(o);
    const c = new Machine(ROM, OPTS); seed(c);
    oracle(o); const ret = loc_9aee(c);
    assert.equal(ramDiff(o, c), null, `RAM (loc_2b/2c/2d): ${tag}`);
    assert.equal(c.regs.a, o.regs.a, `A (loc_29 re-latch) matches oracle: ${tag}`);
    assert.equal(ret, o.regs.a, `return == A: ${tag}`);
  }
});

test("TEETH: a twin that ignores Y (always table index 0) diverges in loc_2c on Y!=0", () => {
  const o = new Machine(ROM, OPTS); o.regs.y = 1; oracle(o); // loc_9b02[1] != loc_9b02[0]
  const idx0c = new Machine(ROM, OPTS).mem.read8(loc_9b02); // table entry at index 0
  assert.notEqual(idx0c, o.mem.read8(loc_2c), "the RAM diff FAILED to catch a Y-independent twin");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.y = 0;
  m.regs.s = 0xff;
  m.push16(0xabcd);
  const r = seamPlaceable(withOmittedRet, loc_9aee, TARGET, m);
  assert.equal(r.placeable, true, `loc_9aee must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
