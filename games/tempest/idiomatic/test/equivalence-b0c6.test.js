// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b0c6 (ROM 0xb0c6-0xb0d0) -- selects a pointer by index X via loc_91b5, then
// tail-emits the three zeropage bytes at $29 through loc_dfb1. The idiomatic side dissolves jsr $91b5 and
// the jmp $dfb1 tail-call into direct loc_91b5(m,x) / loc_dfb1(m,0x29,0x03) calls. Live-out is memory only
// (the pointer slot + emit list; A/X/Y at RTS are incidental), so each arm compares RAM (dumpState minus
// STACK_SCRATCH). Run: node --test games/tempest/idiomatic/test/equivalence-b0c6.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b0c6 as oracle } from "../../translated/loc_b0c6.js";
import { loc_b0c6 } from "../loc_b0c6.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { loc_91b5 } from "../loc_91b5.js";
import { STACK_SCRATCH, loc_2a, loc_2b, loc_74 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb0c6;
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

test("CAPTURE: real 0xb0c6 dispatches -- loc_b0c6 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b0c6(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// A non-zero selector index exercises the table lookup (X->pointer slot $2a/$2b), and a list cursor aimed
// into vector RAM makes the three-byte emit land in the diffed region. X is the input (default bridge).
function seed(m, xVal) {
  m.regs.x = xVal;
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x21); // ($74) -> 0x2100 (vector RAM, diffed)
}

test("CRAFTED: index X=0x02 selects a pointer and emits three bytes -- RAM equal", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x02);
  const c = new Machine(ROM, OPTS); seed(c, 0x02);
  oracle(o); loc_b0c6(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after select + emit");
});

test("CRAFTED: index X=0x00 (non-default seed) -- RAM equal", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x00);
  const c = new Machine(ROM, OPTS); seed(c, 0x00);
  oracle(o); loc_b0c6(c);
  assert.equal(ramDiff(o, c), null, "RAM equal for index 0");
});

test("TEETH: a twin that skips the dfb1 tail-emit diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x02); oracle(o);
  const c = new Machine(ROM, OPTS); seed(c, 0x02);
  const brokenB0c6 = (m, x = m.regs.x) => { loc_91b5(m, x); /* BUG: never emits the run */ };
  brokenB0c6(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped emit");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x21);
  const r = seamPlaceable(withOmittedRet, loc_b0c6, TARGET, m);
  assert.equal(r.placeable, true, `loc_b0c6 must be seam-placeable; got: ${r.error}`);
});
