// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c235 (ROM 0xc235-0xc2e7) -- level-geometry setup. Dissolves jsr $c2e8 into a
// direct idiomatic call (passing $46,x explicitly, consuming its returned A as the seed index); the oracle
// runs the TRANSLATED loc_c2e8 via m.call. Live-out is memory only (final A/X/Y are incidental), so each
// side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH). loc_c2e8 reads POKEY
// random ($60ca) only when its input >= 0x62; the crafted seeds stay below that, and CAPTURE compares on
// identical clones (poly-frozen), so both arms read the same byte. A caller: the module omits the ROM ret.
// Run: node --test games/tempest/idiomatic/test/equivalence-c235.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c235 as oracle } from "../../translated/loc_c235.js";
import { loc_c235 } from "../loc_c235.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH, loc_2, loc_3d, loc_46, loc_5b, loc_66, loc_67,
  loc_68, loc_69, loc_10f, loc_110, loc_113, loc_435,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc235;
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

test("CAPTURE: real 0xc235 dispatches -- loc_c235 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c235(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Difference branch: $02 != 0x1e drives the 16-bit subtract + 4-step shift into $0121.
const seedDiff = (m) => {
  m.mem.write8(loc_3d, 0x00);
  m.mem.write8(loc_46, 0x30); // c2e8 input (< 0x62 -> deterministic, no random)
  m.mem.write8(loc_2, 0x00);
  m.mem.write8(loc_68, 0x20);
  m.mem.write8(loc_69, 0x10);
};

test("CRAFTED-DIFF: $02!=0x1e path -- constant cells set, RAM matches the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDiff(o);
  const c = new Machine(ROM, OPTS); seedDiff(c);
  oracle(o); loc_c235(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after run");
  assert.equal(c.mem.read8(loc_113), 0x2c, "$0113 = 0x2c");
  assert.equal(c.mem.read8(loc_5b), 0xff, "$5b = 0xff");
  assert.equal(c.mem.read8(loc_66), 0x00, "$66 cleared");
  assert.equal(c.mem.read8(loc_67), 0x00, "$67 cleared");
  assert.equal(c.mem.read8(loc_10f), 0x00, "$010f cleared");
  assert.equal(c.mem.read8(loc_110), 0x00, "$0110 cleared");
});

test("CRAFTED-COPY: $02==0x1e path -- offset pair copied, RAM matches the oracle", () => {
  const seedCopy = (m) => { seedDiff(m); m.mem.write8(loc_2, 0x1e); };
  const o = new Machine(ROM, OPTS); seedCopy(o);
  const c = new Machine(ROM, OPTS); seedCopy(c);
  oracle(o); loc_c235(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after run");
  assert.equal(c.mem.read8(loc_68), o.mem.read8(loc_68), "$68 copied identically");
  assert.equal(c.mem.read8(loc_69), o.mem.read8(loc_69), "$69 copied identically");
});

test("TEETH: a twin whose $0435[0] average is corrupted diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDiff(o);
  const c = new Machine(ROM, OPTS); seedDiff(c);
  oracle(o); loc_c235(c);
  c.mem.write8(loc_435, (c.mem.read8(loc_435) ^ 0xff) & 0xff); // BUG: averaged output corrupted
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the corrupted store");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seedDiff(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_c235, TARGET, m);
  assert.equal(r.placeable, true, `loc_c235 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret caller (moved 0) placeable");
});
