// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b71b -- latches a run flag ($9e = 4 or 0 from $0148's sign) and a
// style byte ($29) picked from table $b755 by $0148's clamped high nibble, then splits on the
// slot's sign ($0283,x): a negative slot preps a coordinate (loc_b634) and builds a segment at
// corner $29 (loc_bdcb); otherwise builds one at the slot's corner ($02b9,x) with A=$29 (loc_bda0).
// All three jsr are dissolved into direct idiomatic calls. Output is RAM, so each arm compares the
// RAM diff (minus dead stack). The bdcb early-out is seeded so segment writes stay deterministic.
// Run: node --test games/tempest/idiomatic/test/equivalence-b71b.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b71b as oracle } from "../../translated/loc_b71b.js";
import { loc_b71b } from "../loc_b71b.js";
import { loc_bda0 } from "../loc_bda0.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_29, loc_9e, loc_148, loc_57, loc_5b, loc_5f, loc_283, loc_2b9 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb71b;
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
function seatCommon(m, c148) {
  m.mem.write8(loc_5b, 0x00);
  m.mem.write8(loc_57, 0x00);
  m.mem.write8(loc_5f, 0x01);
  m.mem.write8(loc_148, c148);
}
function seatPos(m, c148 = 0x30) {
  m.regs.x = SLOT;
  seatCommon(m, c148);
  m.mem.write8((loc_283 + SLOT) & 0xffff, 0x10);  // bit7 clear -> bda0 path
  m.mem.write8((loc_2b9 + SLOT) & 0xffff, 0x02);  // corner
}
function seatNeg(m, c148 = 0xb0) {
  m.regs.x = SLOT;
  seatCommon(m, c148);
  m.mem.write8((loc_283 + SLOT) & 0xffff, 0x80);  // bit7 set -> b634 + bdcb path
  m.mem.write8((loc_2b9 + SLOT) & 0xffff, 0x02);
}

test("CAPTURE: real 0xb71b dispatches -- loc_b71b == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b71b(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: both sign branches, and $0148 minus vs plus for $9e -- loc_b71b == oracle in RAM", () => {
  const cases = [
    { tag: "positive slot, $0148 minus -> $9e=4", seat: (m) => seatPos(m, 0xb0), r9e: 0x04 },
    { tag: "positive slot, $0148 plus -> $9e=0", seat: (m) => seatPos(m, 0x30), r9e: 0x00 },
    { tag: "negative slot, $0148 minus -> $9e=4", seat: (m) => seatNeg(m, 0xb0), r9e: 0x04 },
  ];
  for (const s of cases) {
    const o = new Machine(ROM, OPTS); s.seat(o);
    const c = new Machine(ROM, OPTS); s.seat(c);
    oracle(o); loc_b71b(c);
    assert.equal(ramDiff(o, c), null, s.tag);
    assert.equal(c.mem.read8(loc_9e), s.r9e, `${s.tag}: $9e`);
  }
});

test("TEETH: a twin that inverts the $9e sign latch writes the wrong run flag and diverges", () => {
  const o = new Machine(ROM, OPTS); seatPos(o, 0xb0);   // $0148 minus -> oracle $9e = 4
  const c = new Machine(ROM, OPTS); seatPos(c, 0xb0);
  oracle(o);
  const broken = (m, x = m.regs.x) => {
    const { mem8 } = m;
    mem8[loc_9e] = (mem8[loc_148] & 0x80) ? 0x00 : 0x04;  // BUG: inverted -> $9e = 0
    let idx = ((mem8[loc_148] + 0x40) & 0xff) >> 4;
    if (idx >= 0x05) idx = 0x00;
    mem8[loc_29] = mem8[(0xb755 + idx) & 0xffff];
    const corner = mem8[(loc_2b9 + x) & 0xffff];
    loc_bda0(m, mem8[loc_29], corner);
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the inverted $9e latch");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seatPos(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_b71b, TARGET, m);
  assert.equal(r.placeable, true, `loc_b71b must be seam-placeable; got: ${r.error}`);
});
