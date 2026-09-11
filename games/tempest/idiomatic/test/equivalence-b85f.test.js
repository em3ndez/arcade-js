// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b85f (ROM 0xb85f-0xb874) -- seeds the paired 3-entry arrays $22..$24 (zp) and
// $0809..$080b to entry0=$00, entry1=$04, entry2=$0c. Live-out is memory only (A at RTS is incidental), so
// each side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH). A leaf: the module
// omits the ROM ret and the seam completes it, so the arms compare RAM (-stack), NOT pc/SP.
// Run: node --test games/tempest/idiomatic/test/equivalence-b85f.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b85f as oracle } from "../../translated/loc_b85f.js";
import { loc_b85f } from "../loc_b85f.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_22, loc_23, loc_24, loc_809, loc_80a, loc_80b } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb85f;
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

const PAIRS = [[loc_22, 0x00], [loc_23, 0x04], [loc_24, 0x0c], [loc_809, 0x00], [loc_80a, 0x04], [loc_80b, 0x0c]];

test("CAPTURE: real 0xb85f dispatches -- loc_b85f == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b85f(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: both arrays seeded to {0x00, 0x04, 0x0c} over dirty sentinels", () => {
  const seed = (m) => { for (const [a] of PAIRS) m.mem.write8(a & 0xffff, 0x77); };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_b85f(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after seed");
  // color RAM (0x0800-0x080F) is CPU write-only (read8 throws) -- read those back via io.colorram
  const readCell = (a) => (a >= 0x0800 && a <= 0x080f ? c.io.colorram[a & 0x0f] : c.mem.read8(a & 0xffff));
  for (const [a, v] of PAIRS) assert.equal(readCell(a), v, `cell 0x${a.toString(16)} = 0x${v.toString(16)}`);
});

test("TEETH: a twin that skips the $24/$080b entry2 store diverges from the oracle", () => {
  const seed = (m) => { for (const [a] of PAIRS) m.mem.write8(a & 0xffff, 0x77); };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const brokenB85f = (m) => {
    const mem = m.mem8;
    // BUG: never writes entry2 (0x0c) to $24 / $080b
    mem[loc_80a] = 0x04; mem[loc_23] = 0x04;
    mem[loc_22] = 0x00; mem[loc_809] = 0x00;
  };
  brokenB85f(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the RAM diff FAILED to catch the skipped entry2 store");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_b85f, TARGET, m);
  assert.equal(r.placeable, true, `loc_b85f must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
