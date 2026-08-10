// SPDX-License-Identifier: GPL-3.0-only
/**
 * decrementObjectStateThenFlyAtSlowestSpeed — memory-equivalent to the frozen oracle at ROM 0x2BB4.
 *
 * GATE: strict unit-capture replayed over every dispatch of the shared coin -> start tape, plus an
 *   exhaustive crafted sweep over the byte the routine counts down, plus teeth. Two instructions:
 *   one decrement and one transfer that never comes back, so everything downstream of the transfer
 *   is part of what this gate compares.
 *
 * What it exercises, with the holes stated:
 *   1. EQUAL at every real dispatch — the whole state dump is identical, the stack included: the
 *      exclusion window is measured at ZERO bytes and asserted so, which also says the transfer is
 *      a tail and pushes nothing.
 *   2. NOT VACUOUS — a candidate that does nothing fails the same comparison, on a real cell.
 *   3. EXCLUDED, deliberately — the register set that may differ is BOUNDED by a measured list: a
 *      register diverging outside it fails the arm, and a rewrite diverging on fewer still passes.
 *   4. CORPUS — every dispatch of the session replayed on a clone, not a deduplicated sample.
 *   5. EXHAUSTIVE — all 256 values of the counted byte, crafted onto the real entry state. The
 *      routine does not test that byte, so this arm's real job is to show the decrement wraps
 *      rather than saturates, and the ZERO twin below is what proves the arm can fail.
 *   6. BOTH HALVES MATTER — one twin drops the decrement and one drops the transfer, and both are
 *      caught, so neither half of a two-instruction entry is passing on the other's evidence.
 *   7. TEETH — five twins with exact catch counts over the crafted sweep.
 *
 * HOLE: nothing here reaches the choice the transfer makes. Which velocity table the flight uses
 * is fixed downstream of this entry, and a twin that changed it would be invisible to this gate.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2bb4.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { decrementObjectStateThenFlyAtSlowestSpeed } from "../decrementObjectStateThenFlyAtSlowestSpeed.js";
import { flyAtSlowestSpeed } from "../flyAtSlowestSpeed.js";
import { loc_2bb4 as oracle } from "../../translated/loc_2bb4.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2bb4;
const FRAMES = 2000;
const DISPATCHES = 28;

const STATE = 0;

const SCRATCH_BYTES = 0;
const EXCLUDED = ["a", "f", "d", "e", "h", "l", "sp"];

const STATES = Array.from({ length: 256 }, (_unused, i) => i);

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

const inScratch = (addr, sp) => addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;

function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

let entry = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const states = new Set();
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    if (entry === null) entry = mm.clone();
    states.add(mm.mem8[(mm.regs.ix + STATE) & 0xffff]);
    const sp = mm.regs.sp;
    const b = mm.clone();
    candidate(b);
    const r = oracle(mm);
    if (allDiffs(mm, b).some((d) => !inScratch(d.addr, sp))) caught++;
    return r;
  }]]));
  const frames = host.runFrames(FRAMES);
  assert.equal(host.stoppedBy, null, `session stopped early: ${host.stoppedBy}`);
  assert.equal(frames.length, FRAMES, "session ran short");
  return { dispatches, caught, states };
}

function entryState() {
  if (entry === null) replay(decrementObjectStateThenFlyAtSlowestSpeed);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  return entry;
}

/** A real captured machine with the counted byte forced. */
function craft(state) {
  const m = entryState().clone();
  m.mem8[(m.regs.ix + STATE) & 0xffff] = state;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (const s of STATES) if (unitDiff(candidate, craft(s))) caught++;
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: flies the object and forgets the countdown. */
function brokenNoDecrement(m) {
  flyAtSlowestSpeed(m);
}

/** BUG: counts the wrong way. */
function brokenIncrements(m) {
  const object = m.regs.ix;
  m.mem8[object + STATE] = (m.mem8[object + STATE] + 1) & 0xff;
  flyAtSlowestSpeed(m);
}

/** BUG: counts down and forgets to fly. */
function brokenNoFlight(m) {
  const object = m.regs.ix;
  m.mem8[object + STATE] = (m.mem8[object + STATE] - 1) & 0xff;
}

/** BUG: counts down the wrong byte of the record. */
function brokenWrongByte(m) {
  const object = m.regs.ix;
  m.mem8[object + STATE + 1] = (m.mem8[object + STATE + 1] - 1) & 0xff;
  flyAtSlowestSpeed(m);
}

/** Each twin's exact catch count over the 256 crafted states. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp, 256],
  ["no-decrement", brokenNoDecrement, 256],
  ["increments", brokenIncrements, 256],
  ["no-flight", brokenNoFlight, 256],
  ["wrong-byte", brokenWrongByte, 256],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: decrementObjectStateThenFlyAtSlowestSpeed == oracle over the whole dump", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  decrementObjectStateThenFlyAtSlowestSpeed(b);
  assert.deepEqual(allDiffs(a, b), [], "the dumps must agree byte for byte, the stack included");
  console.log(`  EQUAL: sp=${hex4(entryState().regs.sp)}, no byte differs`);
});

test("NOT VACUOUS: a no-op candidate FAILS the same comparison", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a real cell");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: a bounded register set, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  decrementObjectStateThenFlyAtSlowestSpeed(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}`);
});

test("CORPUS: every dispatch of a real session replays identically", { skip }, () => {
  const r = replay(decrementObjectStateThenFlyAtSlowestSpeed);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, "the rewrite diverged on a real dispatch");
  console.log(`  CORPUS: ${r.dispatches} dispatches, ${r.states.size} distinct counted values`);
});

test("EXHAUSTIVE: all 256 crafted values of the counted byte", { skip }, () => {
  assert.equal(sweepCaught(decrementObjectStateThenFlyAtSlowestSpeed), 0, "the rewrite diverged somewhere in the crafted space");
  const wrapped = craft(0);
  decrementObjectStateThenFlyAtSlowestSpeed(wrapped);
  assert.equal(wrapped.mem8[wrapped.regs.ix + STATE], 255, "the countdown must WRAP, not saturate");
  console.log(`  EXHAUSTIVE: ${STATES.length} values identical, and zero wraps to 255`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted values`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught nowhere at all`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${STATES.length} values`);
  });
}
