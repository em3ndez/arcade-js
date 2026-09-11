// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c473 (ROM 0xc473-0xc4e0) -- 16-pass clamp loop. Dissolves jsr $c098 into a
// direct idiomatic call; the oracle runs the TRANSLATED loc_c098 via m.call. A and X are inputs (seated
// into $57/$38); the clamp count $59 is a REGISTER live-out (A at RTS), so each arm asserts o.regs.a vs
// c.regs.a alongside the RAM contract (dumpState, minus STACK_SCRATCH). loc_c098 busy-waits on the math
// coprocessor status ($6040), which idles to 0 in a fresh machine, so both arms complete. A caller: the
// module omits the ROM ret and the seam completes it.
// Run: node --test games/tempest/idiomatic/test/equivalence-c473.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c473 as oracle } from "../../translated/loc_c473.js";
import { loc_c473 } from "../loc_c473.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_59 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc473;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 3000) : [];

test("CAPTURE: real 0xc473 dispatches -- loc_c473 == oracle in RAM (-stack) + A live-out", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c473(c); // default params read A/X from each clone's own regs
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.a, o.regs.a, "clamp-count A live-out matches");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// A=0 (initial $57), X=0x0f (initial $38 -> stores index 0x0f..0x00). $03ce/$03de seeded so c098 has inputs.
const seed = (m) => {
  m.regs.a = 0x00;
  m.regs.x = 0x0f;
  for (let i = 0; i <= 0x0f; i++) {
    m.mem.write8((0x03ce + i) & 0xffff, 0x10 + i);
    m.mem.write8((0x03de + i) & 0xffff, 0x20 + i);
  }
};

test("CRAFTED: RAM + clamp-count A live-out match the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  const or = oracle(o);
  const cr = loc_c473(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after run");
  assert.equal(c.regs.a, o.regs.a, "A (clamp count) equal via regs");
  assert.equal(c.regs.a, c.mem.read8(loc_59), "returned A mirrors $59");
  assert.equal(cr, c.regs.a, "return value seats regs.a");
  void or;
});

test("TEETH-RAM: a twin whose $033a[0] clamp output is corrupted diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c473(c);
  c.mem.write8(0x033a, (c.mem.read8(0x033a) ^ 0xff) & 0xff); // BUG: a clamp value corrupted
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the corrupted store");
});

test("TEETH-REG: a twin that mis-reports the clamp count diverges in the A live-out", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c473(c);
  const broken = (c.regs.a ^ 0xff) & 0xff; // BUG: returned clamp count inverted
  assert.notEqual(broken, o.regs.a, "the A comparison FAILED to catch the wrong count");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seed(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_c473, TARGET, m);
  assert.equal(r.placeable, true, `loc_c473 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret caller (moved 0) placeable");
});
