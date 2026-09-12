// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_dd29 (ROM 0xdd29-0xdd2a) -- ldx #$f8, then falls through into loc_dd2b. The
// idiomatic side dissolves the fall-through into a direct loc_dd2b(m, y, a, 0xf8) call, marshalling Y/A
// from this caller's register bridge and X from the fixed load. Live-out is memory only, so each arm
// compares RAM (dumpState minus STACK_SCRATCH); registers are NOT asserted.
// Run: node --test games/tempest/idiomatic/test/equivalence-dd29.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_dd29 as oracle } from "../../translated/loc_dd29.js";
import { loc_dd29 } from "../loc_dd29.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { loc_dd2b } from "../loc_dd2b.js";
import { STACK_SCRATCH, loc_35, loc_37, loc_74 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xdd29;
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

test("CAPTURE: real 0xdd29 dispatches -- loc_dd29 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_dd29(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Distinct A/Y and a ($74) cursor into vector RAM so the eight emitted digits land in diffed RAM.
function seedDistinct(m) {
  m.regs.a = 0x11; m.regs.y = 0xb4;
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x22); // ($74) -> 0x2200
}

test("CRAFTED: distinct A/Y -- loc_dd29 == oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o); loc_dd29(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after preset + 8 digit emits");
  assert.equal(c.mem.read8(loc_35), 0x00, "$35 shifted fully out to 0");
  assert.equal(c.mem.read8(loc_37), 0xff, "$37 loop counter ran to 0xff");
});

test("TEETH: a twin that presets the wrong X diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o);
  const brokenDd29 = (m, y = m.regs.y, a = m.regs.a) => loc_dd2b(m, y, a, 0x00); // BUG: X != 0xf8
  brokenDd29(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong preset X");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_dd29, TARGET, m);
  assert.equal(r.placeable, true, `loc_dd29 must be seam-placeable; got: ${r.error}`);
});
