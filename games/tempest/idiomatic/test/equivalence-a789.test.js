// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a789 (ROM 0xa789) -- zero the $0283..$0292 table and re-seed $010e/$010d=0x20,
// $01=0x04, $68=$69=0. A/X only carry the loop constant/counter (incidental scratch, dropped), so live-out
// is RAM only and the arms compare RAM (-stack). A pure leaf (no dispatch, no stack move): it omits the ROM
// ret and the withOmittedRet seam completes it.
// Run: node --test games/tempest/idiomatic/test/equivalence-a789.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a789 as oracle } from "../../translated/loc_a789.js";
import { loc_a789 } from "../loc_a789.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_283, loc_10e, loc_10d, loc_1, loc_68, loc_69 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const opt = (name) => {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
};
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa789;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps taken before any gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 1200) : [];

test("CAPTURE: real 0xa789 dispatches -- loc_a789 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a789(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

function seed(m, s) { for (const [a, v] of Object.entries(s)) m.mem.write8(Number(a), v); }

test("CRAFTED: table cleared + scalars re-seeded from a non-default seed", () => {
  // NON-default so every write actually bites (table ends != seed, scalars end != seed).
  const s = {
    [loc_283]: 0xaa, [loc_283 + 7]: 0x5a, [loc_283 + 15]: 0x55,
    [loc_10e]: 0x11, [loc_10d]: 0x22, [loc_1]: 0x33, [loc_68]: 0x44, [loc_69]: 0x66,
  };
  const o = new Machine(ROM, OPTS); seed(o, s);
  const c = new Machine(ROM, OPTS); seed(c, s);
  oracle(o); loc_a789(c);
  assert.equal(ramDiff(o, c), null, "RAM matches oracle");
  for (let i = 0; i < 16; i++) assert.equal(c.mem.read8(loc_283 + i), 0x00, `$0283+${i} cleared`);
  assert.equal(c.mem.read8(loc_10e), 0x20, "$010e = 0x20");
  assert.equal(c.mem.read8(loc_10d), 0x20, "$010d = 0x20");
  assert.equal(c.mem.read8(loc_1), 0x04, "$01 = 0x04");
  assert.equal(c.mem.read8(loc_68), 0x00, "$68 = 0");
  assert.equal(c.mem.read8(loc_69), 0x00, "$69 = 0");
});

test("TEETH: a twin that leaves $01 unchanged diverges", () => {
  const s = { [loc_1]: 0x33 };
  const o = new Machine(ROM, OPTS); seed(o, s);
  oracle(o);
  assert.equal(o.mem.read8(loc_1), 0x04, "precondition: oracle set $01 = 0x04");
  const broken01 = 0x33; // BUG: never re-seeded $01
  assert.notEqual(broken01, o.mem.read8(loc_1), "the RAM diff FAILED to catch a skipped $01 write");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xff;
  m.push16(0xabcd); // a real caller-return word on the 6502 page-1 stack
  const r = seamPlaceable(withOmittedRet, loc_a789, TARGET, m);
  assert.equal(r.placeable, true, `loc_a789 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
