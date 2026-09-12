// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b5eb -- sets the run count ($9e=3), then splits on the slot's sign
// ($0283,x): a negative slot preps a coordinate (loc_b634) and builds a segment at corner 0
// (loc_bdcb); otherwise picks a header from a table by the style index ($55) and builds one at the
// slot's corner ($02b9,x) via loc_bda0. All three jsr are dissolved into direct idiomatic calls.
// Output is RAM (X at RTS is incidental -- the else path reloads X from $55), so each arm compares
// the RAM diff (minus the dead stack). The bdcb early-out is seeded so writes stay deterministic.
// Run: node --test games/tempest/idiomatic/test/equivalence-b5eb.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b5eb as oracle } from "../../translated/loc_b5eb.js";
import { loc_b5eb } from "../loc_b5eb.js";
import { loc_bda0 } from "../loc_bda0.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_9e, loc_55, loc_57, loc_5b, loc_5f, loc_283, loc_2b9 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb5eb;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 3000) : [];

const SLOT = 0x03;
// Seed the bdcb early-out so segment emission stays deterministic: $5b bit7 clear and $57 < $5f.
function seatCommon(m) {
  m.mem.write8(loc_5b, 0x00);
  m.mem.write8(loc_57, 0x00);
  m.mem.write8(loc_5f, 0x01);
}
function seatPos(m) {
  m.regs.x = SLOT;
  seatCommon(m);
  m.mem.write8((loc_283 + SLOT) & 0xffff, 0x10);  // bit7 clear -> table/bda0 path
  m.mem.write8((loc_2b9 + SLOT) & 0xffff, 0x02);  // corner
  m.mem.write8(loc_55, 0x03);                      // style index
}
function seatNeg(m) {
  m.regs.x = SLOT;
  seatCommon(m);
  m.mem.write8((loc_283 + SLOT) & 0xffff, 0x80);  // bit7 set -> b634 + bdcb path
  m.mem.write8((loc_2b9 + SLOT) & 0xffff, 0x02);
}

test("CAPTURE: real 0xb5eb dispatches -- loc_b5eb == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b5eb(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: both sign branches -- loc_b5eb == oracle in RAM", () => {
  for (const [name, seat] of [["positive slot", seatPos], ["negative slot", seatNeg]]) {
    const o = new Machine(ROM, OPTS); seat(o);
    const c = new Machine(ROM, OPTS); seat(c);
    oracle(o); loc_b5eb(c);
    assert.equal(ramDiff(o, c), null, name);
    assert.equal(c.mem.read8(loc_9e), 0x03, `${name}: $9e run count`);
  }
});

test("TEETH: a twin that ignores the sign and always builds the table segment diverges", () => {
  const o = new Machine(ROM, OPTS); seatNeg(o);
  const c = new Machine(ROM, OPTS); seatNeg(c);
  oracle(o);
  const broken = (m, x = m.regs.x) => {
    const { mem8 } = m;
    mem8[loc_9e] = 0x03;
    const corner = mem8[(loc_2b9 + x) & 0xffff];
    const style = mem8[loc_55];
    loc_bda0(m, mem8[(0xb60b + style) & 0xffff], corner); // BUG: skips the b634/bdcb negative path
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the ignored sign branch");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seatPos(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_b5eb, TARGET, m);
  assert.equal(r.placeable, true, `loc_b5eb must be seam-placeable; got: ${r.error}`);
});
