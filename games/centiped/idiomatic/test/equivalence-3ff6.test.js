// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for spinToSelfHalt (ROM 0x3ff6). A self-jump halt trap: it re-enters itself
// forever, ticking the clock each hop so the cycle budget can break the spin. Its body writes
// NOTHING. The self-target is stubbed to break the recursion after one hop; equivalence is that
// oracle and rewrite both re-enter with identical RAM (minus dead stack). A separate teeth lets the
// real trap spin under a finite cycle budget to prove the tick keeps it breakable.
// Run: node --test games/centiped/idiomatic/test/equivalence-3ff6.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3ff6 as oracle } from "../../translated/loc_3ff6.js";
import { spinToSelfHalt } from "../spinToSelfHalt.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x3ff6; // the trap jumps to itself
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

// Run fn on an independent clone whose self-target is stubbed to record the re-entry and return at
// once, breaking the spin after a single hop.
function runToSelf(base, fn) {
  const m = base.clone();
  m.routines = new Map(m.routines);
  let reached = 0;
  m.routines.set(TARGET, () => { reached++; });
  fn(m);
  return { m, reached };
}

// Non-recursive capture: clone the entry state without re-spinning (the trap is a never-reached crash
// vector in normal boot, so this is 0 in practice, but stays safe if it were ever entered).
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); }]]);
  try { new Machine(ROM, { overrides: snap }).runFrames(maxFrames); } catch { /* keep caps before any throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0x3ff6 dispatches -- spinToSelfHalt == oracle re-entering with equal RAM", () => {
  for (const cap of CAPS) {
    const o = runToSelf(cap, oracle);
    const c = runToSelf(cap, spinToSelfHalt);
    assert.equal(o.reached, 1, "oracle re-entered");
    assert.equal(c.reached, 1, "rewrite re-entered");
    assert.equal(ramDiff(o.m, c.m), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: arbitrary seeded RAM is re-entered untouched (one hop, self stubbed)", () => {
  const seeds = [
    [[0x00, 0x11], [0x40, 0x22], [0x86, 0x33]],
    [[0xf9, 0x3d], [0xfa, 0x00], [0x1b5, 0x5a]],
    [],
  ];
  for (const pairs of seeds) {
    const base = new Machine(ROM);
    for (const [a, v] of pairs) base.mem.write8(a, v);
    const o = runToSelf(base, oracle);
    const c = runToSelf(base, spinToSelfHalt);
    assert.equal(o.reached, 1);
    assert.equal(c.reached, 1);
    assert.equal(ramDiff(o.m, c.m), null);
  }
});

test("TEETH: the trap spins and the clock tick lets a finite budget break it", () => {
  for (const fn of [oracle, spinToSelfHalt]) {
    const m = new Machine(ROM, { maxCycles: 300 });
    assert.throws(() => fn(m), "the trap must terminate via the cycle budget");
    assert.ok(m.cycles >= 300, `the clock advanced to the budget (was ${m.cycles})`);
  }
});

test("SP-TOOTH: the self-jump dispatch is seam-placeable", () => {
  const m = new Machine(ROM);
  m.routines = new Map(m.routines);
  m.routines.set(TARGET, () => {}); // stub self so the seam completes without spinning
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0xcd); m.mem.write8(0x01fd, 0xab); // seated caller-return word
  const r = seamPlaceable(withOmittedRet, spinToSelfHalt, TARGET, m);
  assert.equal(r.placeable, true, `spinToSelfHalt must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: self-jump placeable");
});
