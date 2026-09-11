// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_9c21 (ROM 0x9c21) -- per-slot boundary test for slot X: segment = $02b9,x;
// bound = $03ac[segment] (a 0 entry reads as 0xff); flag $010c = (bound >= $02df,x) ? 1 : 0. Live-out is
// RAM only, so each arm compares RAM (dumpState, minus STACK_SCRATCH). X is an input register bridged to a
// param. No POKEY read -> crafted diffs are deterministic.
// Run: node --test games/tempest/idiomatic/test/equivalence-9c21.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_9c21 as oracle } from "../../translated/loc_9c21.js";
import { loc_9c21 } from "../loc_9c21.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_2b9, loc_2df, loc_3ac, loc_10c } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const rd = (n) => new Uint8Array(readFileSync(new URL(n, ROM_DIR)));
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? rd("maincpu.bin") : null;
const opt = (n) => (existsSync(new URL(n, ROM_DIR)) ? rd(n) : undefined);
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x9c21;
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

test("CAPTURE: real 0x9c21 dispatches -- loc_9c21 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    // X is read back from the captured regs on both sides (param default == oracle's regs.x).
    oracle(o); loc_9c21(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

const SENTINEL10C = 0x99;
function seeded(x, seg, boundEntry, coord) {
  const m = new Machine(ROM, OPTS);
  m.regs.x = x;
  m.mem.write8(loc_2b9 + x, seg);
  m.mem.write8(loc_3ac + seg, boundEntry);
  m.mem.write8(loc_2df + x, coord);
  m.mem.write8(loc_10c, SENTINEL10C);
  return m;
}

test("CRAFTED: flag = (bound >= coord); 0-entry reads as 0xff (== oracle, RAM)", () => {
  const cases = [
    { tag: "bound > coord -> 1", x: 0, seg: 0x05, entry: 0x40, coord: 0x30, flag: 1 },
    { tag: "bound < coord -> 0", x: 0, seg: 0x05, entry: 0x40, coord: 0x80, flag: 0 },
    { tag: "bound == coord -> 1 (carry set on equal)", x: 3, seg: 0x02, entry: 0x10, coord: 0x10, flag: 1 },
    { tag: "0-entry -> 0xff -> 1", x: 3, seg: 0x07, entry: 0x00, coord: 0x80, flag: 1 },
  ];
  for (const { tag, x, seg, entry, coord, flag } of cases) {
    const o = seeded(x, seg, entry, coord), c = seeded(x, seg, entry, coord);
    oracle(o); loc_9c21(c);
    assert.equal(ramDiff(o, c), null, tag);
    assert.equal(c.mem.read8(loc_10c), flag, tag);
  }
});

test("TEETH: a twin that skips the 0-entry -> 0xff substitution diverges", () => {
  // seg entry is 0, coord is 0x80: oracle treats bound as 0xff -> flag 1; a twin that uses bound=0 -> flag 0.
  const o = seeded(3, 0x07, 0x00, 0x80);
  oracle(o);
  assert.equal(o.mem.read8(loc_10c), 1, "precondition: oracle set flag via the 0xff substitution");
  const c = seeded(3, 0x07, 0x00, 0x80);
  loc_9c21(c);
  c.mem.write8(loc_10c, 0x00); // BUG: bound left 0, so 0 >= 0x80 is false -> flag 0
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch a missing 0->0xff substitution");
});
