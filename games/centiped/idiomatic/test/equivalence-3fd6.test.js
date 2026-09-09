// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_3fd6 (ROM 0x3fd6). A pure tail-jump trampoline into the spine head
// ($3d57): its own body writes NOTHING, it only transfers control. Because the head is the
// non-returning service loop, the successor is stubbed to record the hand-off and break the loop;
// equivalence is that oracle and rewrite reach the head with identical RAM (minus dead stack).
// Run: node --test games/centiped/idiomatic/test/equivalence-3fd6.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3fd6 as oracle } from "../../translated/loc_3fd6.js";
import { loc_3fd6 } from "../loc_3fd6.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x3fd6;
const SUCC = 0x3d57; // the spine head this trampoline jumps to
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

// Run fn on an independent clone whose successor is stubbed to record the hand-off and return at once
// (the head never returns, so a stub is the only way to observe the transfer without spinning).
function runToHead(base, fn) {
  const m = base.clone();
  m.routines = new Map(m.routines);
  let reached = 0;
  m.routines.set(SUCC, () => { reached++; });
  fn(m);
  return { m, reached };
}

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap }).runFrames(maxFrames); } catch { /* keep caps before any throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0x3fd6 dispatches -- loc_3fd6 == oracle reaching the head with equal RAM", () => {
  for (const cap of CAPS) {
    const o = runToHead(cap, oracle);
    const c = runToHead(cap, loc_3fd6);
    assert.equal(o.reached, 1, "oracle reached the head");
    assert.equal(c.reached, 1, "rewrite reached the head");
    assert.equal(ramDiff(o.m, c.m), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: arbitrary seeded RAM is transferred untouched to the head", () => {
  const seeds = [
    [[0x00, 0x11], [0x40, 0x22], [0x86, 0x33]],
    [[0xea, 0xff], [0xeb, 0x00], [0xf9, 0x3d], [0x1b5, 0x5a]],
    [],
  ];
  for (const pairs of seeds) {
    const base = new Machine(ROM);
    for (const [a, v] of pairs) base.mem.write8(a, v);
    const o = runToHead(base, oracle);
    const c = runToHead(base, loc_3fd6);
    assert.equal(o.reached, 1);
    assert.equal(c.reached, 1);
    assert.equal(ramDiff(o.m, c.m), null);
  }
});

test("TEETH: the RAM diff is not blind -- a poked cell after the hand-off diverges", () => {
  const base = new Machine(ROM);
  const o = runToHead(base, oracle);
  const c = runToHead(base, loc_3fd6);
  assert.equal(ramDiff(o.m, c.m), null, "precondition: equal before the poke");
  o.m.mem.write8(0x0040, (o.m.mem8[0x0040] + 1) & 0xff);
  assert.notEqual(ramDiff(o.m, c.m), null, "the RAM diff FAILED to see a divergent cell");
});

test("SP-TOOTH: the tail-jump dispatch is seam-placeable", () => {
  const m = new Machine(ROM);
  m.routines = new Map(m.routines);
  m.routines.set(SUCC, () => {}); // stub the head so the seam completes without recursing
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0xcd); m.mem.write8(0x01fd, 0xab); // seated caller-return word
  const r = seamPlaceable(withOmittedRet, loc_3fd6, TARGET, m);
  assert.equal(r.placeable, true, `loc_3fd6 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: tail-jump placeable");
});
