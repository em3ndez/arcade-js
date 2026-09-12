// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_dded -- a trampoline that runs the shared mask-merge with the fixed mask
// 0x03: $01c6 <- 0xff, $01c7 |= 0x03, $01c8 |= 0x03. Live-out is memory only (A/Y at RTS are incidental,
// the merge leaf treats them as dead), so the arms compare RAM (dumpState, minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-dded.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_dded as oracle } from "../../translated/loc_dded.js";
import { loc_dded } from "../loc_dded.js";
import { loc_ddf3 } from "../loc_ddf3.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_1c6, loc_1c7, loc_1c8 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xdded;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 4000) : [];

test("CAPTURE: real 0xdded dispatches -- loc_dded == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_dded(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: $01c6 <- 0xff, mask 0x03 OR-ed into $01c7/$01c8", () => {
  const seed = (m) => {
    m.regs.s = 0xfb;
    m.mem.write8(loc_1c6, 0x11);
    m.mem.write8(loc_1c7, 0x50);
    m.mem.write8(loc_1c8, 0x88);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_dded(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after run");
  assert.equal(c.mem.read8(loc_1c6), 0xff, "$01c6 <- 0xff");
  assert.equal(c.mem.read8(loc_1c7), 0x50 | 0x03, "$01c7 OR 0x03");
  assert.equal(c.mem.read8(loc_1c8), 0x88 | 0x03, "$01c8 OR 0x03");
});

test("TEETH: a twin that leaves $01c8 untouched (non-default seed) diverges from the oracle", () => {
  const seed = (m) => {
    m.regs.s = 0xfb;
    m.mem.write8(loc_1c6, 0x11);
    m.mem.write8(loc_1c7, 0x50);
    m.mem.write8(loc_1c8, 0x88); // non-default so the skipped OR shows
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m) => {
    const mem = m.mem8;
    mem[loc_1c6] = 0xff;
    mem[loc_1c7] = mem[loc_1c7] | 0x03; // BUG: never touches $01c8
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped OR");
});

test("TEETH: passing the wrong mask (0x00) diverges from the oracle", () => {
  const seed = (m) => {
    m.regs.s = 0xfb;
    m.mem.write8(loc_1c6, 0x11);
    m.mem.write8(loc_1c7, 0x50);
    m.mem.write8(loc_1c8, 0x88);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  loc_ddf3(c, 0x00); // BUG: wrong mask leaves $01c7/$01c8 low bits clear
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong mask");
});

test("SP-TOOTH: the omitted-ret trampoline is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_dded, TARGET, m);
  assert.equal(r.placeable, true, `loc_dded must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret trampoline placeable");
});
