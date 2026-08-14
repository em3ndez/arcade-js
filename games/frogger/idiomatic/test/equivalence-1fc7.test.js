// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fc7 — memory-equivalent to the frozen oracle at ROM 0x1FC7.
 * GATE: crafted-entry. Attract never dispatches this in-play countdown tick (probe: 0 dispatches
 * over ENTRY_FRAMES), so a post-boot attract machine is cloned and its enable flag (0x826C) and
 * counter (0x826A) poked to drive each path — flag-clear no-op, a plain decrement, the decrement
 * that reaches zero and clears the flag, and the 0->255 counter wrap. The routine reads no live
 * register, pushes nothing, and its live-out is memory-only, so registers/SP are not compared.
 * Teeth: three broken twins (no-op, skip-clear, decrement-with-flag-clear).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_1fc7 } from "../loc_1fc7.js";
import { loc_1fc7 as oracle } from "../../translated/loc_1fc7.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const COUNTER = 0x826a;
const FLAG = 0x826c;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with a specific enable flag and counter (a valid entry: this leaf reads both
// from RAM). null == RAM-equivalent; memory-only live-out, so compare RAM, not registers or SP.
function entryWith(flag, counter) {
  const e = seedMachine().clone();
  e.mem8[FLAG] = flag;
  e.mem8[COUNTER] = counter;
  return e;
}
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// [flag, counter, label]
const CASES = [
  [0, 7, "flag clear -> no-op"],
  [1, 5, "decrement, flag stays"],
  [1, 1, "decrement to zero -> clear flag"],
  [7, 1, "any non-zero flag -> clear on zero"],
  [1, 0, "counter 0 -> 255 wrap, flag stays"],
];

// broken twins.
function brokenNoOp() {}
function brokenNoClear(m) { // decrements but never clears the flag
  const { mem8 } = m;
  if (mem8[FLAG] === 0) return;
  mem8[COUNTER] = (mem8[COUNTER] - 1) & 0xff;
}
function brokenAlwaysDec(m) { // drops the flag gate: decrements even while the flag is clear
  const { mem8 } = m;
  const n = (mem8[COUNTER] - 1) & 0xff;
  mem8[COUNTER] = n;
  if (n !== 0) return;
  mem8[FLAG] = 0;
}

test("EQUAL (crafted): loc_1fc7 == oracle on every gate/countdown path", { skip }, () => {
  const entries = CASES.map(([f, c]) => entryWith(f, c));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (let i = 0; i < entries.length; i++) {
    assert.equal(ramDiff(loc_1fc7, entries[i]), null, `crafted entry diverged: ${CASES[i][2]}`);
  }
  // non-vacuous: the no-op twin must diverge on a path that actually writes.
  assert.ok(ramDiff(brokenNoOp, entryWith(1, 1)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted paths, loc_1fc7 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const decToZero = entryWith(1, 1); // decrement reaches zero -> flag cleared
  const flagClear = entryWith(0, 5); // gate must suppress the decrement
  assert.ok(ramDiff(brokenNoOp, decToZero), "the no-op twin escaped");
  assert.ok(ramDiff(brokenNoClear, decToZero), "the skip-clear twin escaped");
  assert.ok(ramDiff(brokenAlwaysDec, flagClear), "the ignore-gate twin escaped");
  console.log("  TEETH: no-op, skip-clear, ignore-gate all caught");
});
