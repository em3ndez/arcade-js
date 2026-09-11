// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c196 -- from a level index, splits eight packed ROM-table bytes into low/high
// nibbles, mirroring each into zero-page ($19.. / $21..) and color RAM ($0800.. / $0808..). Live-out is
// memory only (A/X/Y at RTS are incidental), so each side runs on a clone and the contract is RAM (dumpState,
// minus STACK_SCRATCH). Color RAM is CPU write-only (read8 throws), so it is read back via io.colorram. A
// leaf: the module omits the ROM ret and the seam completes it, so the arms compare RAM (-stack), NOT pc/SP.
// Run: node --test games/tempest/idiomatic/test/equivalence-c196.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c196 as oracle } from "../../translated/loc_c196.js";
import { loc_c196 } from "../loc_c196.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_9f, loc_19, loc_21 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc196;
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

// Non-default level index so the split runs over real table data and the teeth bite.
const seed = (m) => {
  m.mem.write8(loc_9f, 0x30);
  for (let y = 0; y < 8; y++) { m.mem.write8((loc_19 + y) & 0xffff, 0x77); m.mem.write8((loc_21 + y) & 0xffff, 0x77); }
};

test("CAPTURE: real 0xc196 dispatches -- loc_c196 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c196(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: nibbles split into zp and color RAM, mirrored low/high pairs consistent", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c196(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after split");
  // color RAM (0x0800-0x080f) is CPU write-only (read8 throws) -- read via io.colorram
  for (let y = 0; y < 8; y++) {
    const lo = c.mem.read8((loc_19 + y) & 0xffff);
    const hi = c.mem.read8((loc_21 + y) & 0xffff);
    assert.ok(lo <= 0x0f, `low nibble ${y} in range`);
    assert.ok(hi <= 0x0f, `high nibble ${y} in range`);
    assert.equal(c.io.colorram[y], lo, `color low ${y} mirrors zp`);
    assert.equal(c.io.colorram[8 + y], hi, `color high ${y} mirrors zp`);
    assert.equal(o.io.colorram[y], c.io.colorram[y], `color low ${y} == oracle`);
    assert.equal(o.io.colorram[8 + y], c.io.colorram[8 + y], `color high ${y} == oracle`);
  }
});

test("TEETH: a twin that skips one zp store diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c196(c);
  c.mem.write8(loc_19, (c.mem.read8(loc_19) ^ 0xff) & 0xff); // BUG: entry-0 low nibble corrupted
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the corrupted store");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seed(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_c196, TARGET, m);
  assert.equal(r.placeable, true, `loc_c196 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
